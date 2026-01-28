import rateLimit from 'express-rate-limit';
import { RATE_LIMITS, formatRetryAfter } from '../config/rateLimitConfig';
import { EVENT_TYPES } from '../config/constants';
import { PostgreSQLRateLimitStore } from '../config/rateLimitStore';
import { EventLogger } from '../services/eventLogger';
import { logger } from '../config/logger';
import { db } from '../config/database';

/**
 * Rate Limiting Configuration
 * All limiters now use PostgreSQL store for persistence across restarts
 * See: backend/src/config/rateLimitConfig.ts
 */

/**
 * Create a store instance for a specific rate limiter
 * Each store instance knows its default windowMs for new keys
 */
function createRateLimitStore(windowMs: number): any {
  return new PostgreSQLRateLimitStore(windowMs) as any;
}

/**
 * ✅ Helper functions for rate limit key generation with prefixes
 * Prevents key collisions between different limiters in the same rate_limits table
 */
const rlKey = (prefix: string, raw: string) => `${prefix}:${raw || 'unknown'}`;

const getUserOrIp = (req: any) =>
  req.user?.id || req.user?.userId || req.ip || req.socket?.remoteAddress || 'unknown';

const getEmailOrIp = (req: any) => {
  const email = (req.body?.email || '').toLowerCase();
  return email || req.ip || req.socket?.remoteAddress || 'unknown';
};

/**
 * Helper function to log rate limit violations as events
 */
function logRateLimitViolation(
  req: any,
  limiterName: string,
  key: string,
  limit: number,
  windowMs: number
): void {
  try {
    const userId = req.user?.id || req.user?.userId || null;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    
    // Log to console/logger
    logger.warn({
      type: 'RATE_LIMIT_EXCEEDED',
      limiter: limiterName,
      key: key.substring(0, 100),
      limit,
      windowMs,
      path: req.path,
      method: req.method,
      ip,
      userId: userId || 'anonymous',
    }, `[RATE_LIMIT] ⚠️ ${limiterName} EXCEEDED - ${req.method} ${req.path} - IP: ${ip}`);
    
    const meta = {
      limiterName,
      key: key.substring(0, 100), // Limit key length for logging
      limit,
      windowMs,
      path: req.path,
      method: req.method,
      ip,
      userAgent: req.get('user-agent') || null,
    };

    if (userId) {
      EventLogger.logUserEvent(userId, EVENT_TYPES.RATE_LIMIT_EXCEEDED, meta).catch(() => {});
    } else {
      EventLogger.logSystemEvent(EVENT_TYPES.RATE_LIMIT_EXCEEDED, meta).catch(() => {});
    }
  } catch (error) {
    // Silent fail - don't break rate limiting if event logging fails
  }
}

/**
 * Get user subscription tier from database
 * Returns: 'free' | 'pro' | 'teams' | null
 */
async function getUserSubscriptionTier(userId: string): Promise<'free' | 'pro' | 'teams' | null> {
  try {
    const r = await db.query(
      `SELECT "tier","status" FROM "subscriptions"
       WHERE "userId"=$1 AND "status"='active'
       ORDER BY "createdAt" DESC
       LIMIT 1`,
      [userId]
    );

    if (r.rows[0]?.tier) return r.rows[0].tier;
    return 'free';
  } catch (e) {
    logger.error({ err: e }, 'Failed to read subscription tier; defaulting to free');
    return 'free';
  }
}

// Global rate limiter (applied to all routes)
// ✅ CRITICAL: Uses PostgreSQL store for DDoS protection (persists across restarts, works with horizontal scaling)
const globalRateLimitStore = createRateLimitStore(RATE_LIMITS.global.windowMs);

export const globalRateLimit = rateLimit({
  store: globalRateLimitStore, // ✅ Use PostgreSQL store with windowMs
  windowMs: RATE_LIMITS.global.windowMs,
  max: RATE_LIMITS.global.max,
  keyGenerator: (req) => rlKey('global', req.ip || req.socket?.remoteAddress || 'unknown'),
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: formatRetryAfter(RATE_LIMITS.global.windowMs)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // ✅ Skip global limiter for routes that have their own specific rate limiters
    // to prevent ERR_ERL_DOUBLE_COUNT errors
    const path = req.path || '';
    
    // ✅ Skip static files (CSS, JS, images, uploads, fonts) - these shouldn't be rate limited
    const isStatic = path.startsWith('/css/') ||
                     path.startsWith('/js/') ||
                     path.startsWith('/images/') ||
                     path.startsWith('/uploads/') ||
                     path.startsWith('/utils/') ||
                     path.startsWith('/favicon') ||
                     path.endsWith('.png') ||
                     path.endsWith('.jpg') ||
                     path.endsWith('.jpeg') ||
                     path.endsWith('.svg') ||
                     path.endsWith('.ico') ||
                     path.endsWith('.woff') ||
                     path.endsWith('.woff2') ||
                     path.endsWith('.ttf') ||
                     path.endsWith('.css') ||
                     path.endsWith('.js');
    
    // ✅ Skip routes with specific rate limiters
    const hasSpecificLimiter = path.startsWith('/api/auth') ||
           path.startsWith('/api/identity') ||
           path.startsWith('/api/widget');
    
    return isStatic || hasSpecificLimiter;
  },
  handler: (req, res) => {
    const key = rlKey('global', req.ip || req.socket?.remoteAddress || 'unknown');
    logRateLimitViolation(req, 'global', key, RATE_LIMITS.global.max, RATE_LIMITS.global.windowMs);
    return res.status(429).json({
      success: false,
      error: 'Too many requests from this IP, please try again later.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter: formatRetryAfter(RATE_LIMITS.global.windowMs)
    });
  },
});


// Draft generation rate limiter
export const draftGenerationRateLimit = rateLimit({
  store: createRateLimitStore(RATE_LIMITS.draftGeneration.windowMs), // ✅ Use PostgreSQL store with windowMs
  windowMs: RATE_LIMITS.draftGeneration.windowMs,
  max: RATE_LIMITS.draftGeneration.max,
  keyGenerator: (req) => rlKey('draftGeneration', getUserOrIp(req)),
  message: {
    error: `Draft generation limit exceeded. Please slow down.`,
    retryAfter: formatRetryAfter(RATE_LIMITS.draftGeneration.windowMs)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const key = rlKey('draftGeneration', getUserOrIp(req));
    logRateLimitViolation(req, 'draftGeneration', key, RATE_LIMITS.draftGeneration.max, RATE_LIMITS.draftGeneration.windowMs);
    return res.status(429).json({
      success: false,
      error: 'Draft generation limit exceeded. Please slow down.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter: formatRetryAfter(RATE_LIMITS.draftGeneration.windowMs)
    });
  },
});

// OTP request rate limiter
export const otpRequestRateLimit = rateLimit({
  store: createRateLimitStore(RATE_LIMITS.otpRequest.windowMs), // ✅ Use PostgreSQL store with windowMs
  windowMs: RATE_LIMITS.otpRequest.windowMs,
  max: RATE_LIMITS.otpRequest.max,
  keyGenerator: (req: any) => rlKey('otpRequest', getEmailOrIp(req)),
  message: {
    error: 'Too many OTP requests. Please wait before trying again.',
    retryAfter: formatRetryAfter(RATE_LIMITS.otpRequest.windowMs)
  },
  standardHeaders: true,
  legacyHeaders: false,
  // ✅ FIX: Only count when OTP request actually succeeds (OTP sent successfully)
  skipFailedRequests: true,
  handler: (req, res) => {
    const key = rlKey('otpRequest', getEmailOrIp(req));
    logRateLimitViolation(req, 'otpRequest', key, RATE_LIMITS.otpRequest.max, RATE_LIMITS.otpRequest.windowMs);
    return res.status(429).json({
      success: false,
      error: 'Too many OTP requests. Please wait before trying again.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter: formatRetryAfter(RATE_LIMITS.otpRequest.windowMs)
    });
  },
});

// Invite creation rate limiter (still used for referral system)
export const inviteCreationRateLimit = rateLimit({
  store: createRateLimitStore(RATE_LIMITS.inviteCreation.windowMs), // ✅ Use PostgreSQL store with windowMs
  windowMs: RATE_LIMITS.inviteCreation.windowMs,
  max: RATE_LIMITS.inviteCreation.max,
  keyGenerator: (req) => rlKey('inviteCreation', getUserOrIp(req)),
  message: {
    error: `Invite creation limit exceeded. You can create ${RATE_LIMITS.inviteCreation.max} invites per day.`,
    retryAfter: formatRetryAfter(RATE_LIMITS.inviteCreation.windowMs)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const key = rlKey('inviteCreation', getUserOrIp(req));
    logRateLimitViolation(req, 'inviteCreation', key, RATE_LIMITS.inviteCreation.max, RATE_LIMITS.inviteCreation.windowMs);
    return res.status(429).json({
      success: false,
      error: `Invite creation limit exceeded. You can create ${RATE_LIMITS.inviteCreation.max} invites per day.`,
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter: formatRetryAfter(RATE_LIMITS.inviteCreation.windowMs)
    });
  },
});

// Identity creation rate limiter
export const identityCreateRateLimit = rateLimit({
  store: createRateLimitStore((RATE_LIMITS as any).identityCreate.windowMs),
  windowMs: (RATE_LIMITS as any).identityCreate.windowMs,
  max: (RATE_LIMITS as any).identityCreate.max,
  keyGenerator: (req) => rlKey('identityCreate', getUserOrIp(req)),
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  handler: (req, res) => {
    const key = rlKey('identityCreate', getUserOrIp(req));
    logRateLimitViolation(req, 'identityCreate', key, (RATE_LIMITS as any).identityCreate.max, (RATE_LIMITS as any).identityCreate.windowMs);
    return res.status(429).json({
      success: false,
      error: 'Identity creation limit exceeded. Please try again later.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter: formatRetryAfter((RATE_LIMITS as any).identityCreate.windowMs),
    });
  },
});

// Trust confirmation rate limiter
export const trustConfirmRateLimit = rateLimit({
  store: createRateLimitStore((RATE_LIMITS as any).trustConfirm.windowMs),
  windowMs: (RATE_LIMITS as any).trustConfirm.windowMs,
  max: (RATE_LIMITS as any).trustConfirm.max,
  keyGenerator: (req) => rlKey('trustConfirm', getUserOrIp(req)),
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  handler: (req, res) => {
    const key = rlKey('trustConfirm', getUserOrIp(req));
    logRateLimitViolation(req, 'trustConfirm', key, (RATE_LIMITS as any).trustConfirm.max, (RATE_LIMITS as any).trustConfirm.windowMs);
    return res.status(429).json({
      success: false,
      error: 'Too many confirmations. Please slow down.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter: formatRetryAfter((RATE_LIMITS as any).trustConfirm.windowMs),
    });
  },
});

// Daily mirror rate limiter (with subscription tier support)
export const mirrorDailyRateLimit = rateLimit({
  store: createRateLimitStore((RATE_LIMITS as any).mirrorDaily.windowMs),
  windowMs: (RATE_LIMITS as any).mirrorDaily.windowMs,
  max: async (req: any) => {
    // Check subscription tier
    if (req.user?.id) {
      const tier = await getUserSubscriptionTier(req.user.id);
      if (tier === 'pro' || tier === 'teams') {
        return 1000000; // Unlimited (very high limit)
      }
    }
    return 10; // Free tier: 10 mirrors/month
  },
  keyGenerator: (req) => rlKey('mirrorDaily', getUserOrIp(req)),
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  handler: (req, res) => {
    const key = rlKey('mirrorDaily', getUserOrIp(req));
    logRateLimitViolation(req, 'mirrorDaily', key, 10, (RATE_LIMITS as any).mirrorDaily.windowMs);
    return res.status(429).json({
      success: false,
      error: 'Free tier limit: 10 mirrors/month. Upgrade to Pro for unlimited.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter: formatRetryAfter((RATE_LIMITS as any).mirrorDaily.windowMs),
      upgradeUrl: '/pricing',
    });
  },
});

// API rate limiter (for general API endpoints)
export const apiRateLimit = rateLimit({
  store: createRateLimitStore(RATE_LIMITS.api.windowMs), // ✅ Use PostgreSQL store with windowMs
  windowMs: RATE_LIMITS.api.windowMs,
  max: RATE_LIMITS.api.max,
  keyGenerator: (req) => rlKey('api', getUserOrIp(req)),
  message: {
    error: 'API rate limit exceeded. Please slow down your requests.',
    retryAfter: formatRetryAfter(RATE_LIMITS.api.windowMs)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const key = rlKey('api', getUserOrIp(req));
    logRateLimitViolation(req, 'api', key, RATE_LIMITS.api.max, RATE_LIMITS.api.windowMs);
    return res.status(429).json({
      success: false,
      error: 'API rate limit exceeded. Please slow down your requests.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter: formatRetryAfter(RATE_LIMITS.api.windowMs)
    });
  },
});

// Widget chat rate limiter (public endpoint, per IP)
export const widgetChatRateLimit = rateLimit({
  store: createRateLimitStore((RATE_LIMITS as any).widgetChat.windowMs),
  windowMs: (RATE_LIMITS as any).widgetChat.windowMs,
  max: (RATE_LIMITS as any).widgetChat.max,
  keyGenerator: (req: any) => rlKey('widgetChat', req.ip || req.socket?.remoteAddress || 'unknown'),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const key = rlKey('widgetChat', req.ip || req.socket?.remoteAddress || 'unknown');
    logRateLimitViolation(req, 'widgetChat', key, (RATE_LIMITS as any).widgetChat.max, (RATE_LIMITS as any).widgetChat.windowMs);
    return res.status(429).json({
      success: false,
      error: 'Widget rate limit exceeded. Please try again in a minute.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter: formatRetryAfter((RATE_LIMITS as any).widgetChat.windowMs),
    });
  },
});

// ✅ ADD: Public chat rate limiter (more reasonable limits)
export const publicChatRateLimit = rateLimit({
  store: createRateLimitStore((RATE_LIMITS as any).publicChat.windowMs),
  windowMs: (RATE_LIMITS as any).publicChat.windowMs,
  max: (RATE_LIMITS as any).publicChat.max,
  keyGenerator: (req: any) => {
    // Use session ID + IP for better tracking
    const sessionId = (req.body as any)?.sessionId || req.headers['x-session-id'];
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    return rlKey('publicChat', sessionId ? `${sessionId}:${ip}` : ip);
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const sessionId = (req.body as any)?.sessionId || req.headers['x-session-id'];
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const key = rlKey('publicChat', sessionId ? `${sessionId}:${ip}` : ip);
    logRateLimitViolation(req, 'publicChat', key, (RATE_LIMITS as any).publicChat.max, (RATE_LIMITS as any).publicChat.windowMs);
    return res.status(429).json({
      success: false,
      error: 'Too many messages. Please wait a few minutes before trying again.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter: formatRetryAfter((RATE_LIMITS as any).publicChat.windowMs),
    });
  },
});

// Login attempts limiter (per email/IP)
export const loginRateLimit = rateLimit({
  store: createRateLimitStore(RATE_LIMITS.login.windowMs), // ✅ Use PostgreSQL store with windowMs
  windowMs: RATE_LIMITS.login.windowMs,
  max: RATE_LIMITS.login.max,
  keyGenerator: (req: any) => rlKey('login', getEmailOrIp(req)),
  message: {
    error: 'Too many login attempts. Please try again later.',
    retryAfter: formatRetryAfter(RATE_LIMITS.login.windowMs),
  },
  standardHeaders: true,
  legacyHeaders: false,
  // ✅ FIX: Only count failed login attempts (brute force protection)
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    const key = rlKey('login', getEmailOrIp(req));
    logRateLimitViolation(req, 'login', key, RATE_LIMITS.login.max, RATE_LIMITS.login.windowMs);
    return res.status(429).json({
      success: false,
      error: 'Too many login attempts. Please try again later.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter: formatRetryAfter(RATE_LIMITS.login.windowMs)
    });
  },
});

// Google OAuth GET limiter (init + callback)
export const googleOAuthRateLimit = rateLimit({
  store: createRateLimitStore(RATE_LIMITS.googleOAuth.windowMs),
  windowMs: RATE_LIMITS.googleOAuth.windowMs,
  max: RATE_LIMITS.googleOAuth.max,
  keyGenerator: (req: any) => rlKey('googleOAuth', req.ip || req.socket?.remoteAddress || 'unknown'),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const key = rlKey('googleOAuth', req.ip || req.socket?.remoteAddress || 'unknown');
    logRateLimitViolation(req, 'googleOAuth', key, RATE_LIMITS.googleOAuth.max, RATE_LIMITS.googleOAuth.windowMs);
    // Browser navigation route → redirect back to /auth (so user isn't stuck on JSON)
    return res.redirect('/auth?error=rate_limit_exceeded&details=' + encodeURIComponent('Too many Google login attempts. Please try again later.'));
  },
});

// OTP verification limiter (signup/login/forgot-password verify)
export const otpVerifyRateLimit = rateLimit({
  store: createRateLimitStore(RATE_LIMITS.otpVerify.windowMs), // ✅ Use PostgreSQL store with windowMs
  windowMs: RATE_LIMITS.otpVerify.windowMs,
  max: RATE_LIMITS.otpVerify.max,
  keyGenerator: (req: any) => rlKey('otpVerify', getEmailOrIp(req)),
  message: {
    error: 'Too many OTP verification attempts. Please wait a bit and try again.',
    retryAfter: formatRetryAfter(RATE_LIMITS.otpVerify.windowMs),
  },
  standardHeaders: true,
  legacyHeaders: false,
  // ✅ FIX: Only count failed OTP verification attempts (brute force protection)
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    const key = rlKey('otpVerify', getEmailOrIp(req));
    logRateLimitViolation(req, 'otpVerify', key, RATE_LIMITS.otpVerify.max, RATE_LIMITS.otpVerify.windowMs);
    return res.status(429).json({
      success: false,
      error: 'Too many OTP verification attempts. Please wait a bit and try again.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter: formatRetryAfter(RATE_LIMITS.otpVerify.windowMs)
    });
  },
});

// Change password limiter (per authenticated user)
export const changePasswordRateLimit = rateLimit({
  store: createRateLimitStore(RATE_LIMITS.changePassword.windowMs), // ✅ Use PostgreSQL store with windowMs
  windowMs: RATE_LIMITS.changePassword.windowMs,
  max: RATE_LIMITS.changePassword.max,
  keyGenerator: (req: any) => rlKey('changePassword', getUserOrIp(req)),
  message: {
    error: 'Too many password change attempts. Please try again later.',
    retryAfter: formatRetryAfter(RATE_LIMITS.changePassword.windowMs),
  },
  standardHeaders: true,
  legacyHeaders: false,
  // ✅ FIX: Only count successful password changes (not button clicks or failed attempts)
  skipFailedRequests: true,
  handler: (req, res) => {
    const key = rlKey('changePassword', getUserOrIp(req));
    logRateLimitViolation(req, 'changePassword', key, RATE_LIMITS.changePassword.max, RATE_LIMITS.changePassword.windowMs);
    return res.status(429).json({
      success: false,
      error: 'Too many password change attempts. Please try again later.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter: formatRetryAfter(RATE_LIMITS.changePassword.windowMs)
    });
  },
});

// Reset password limiter (per email/IP) - prevents abuse
export const resetPasswordRateLimit = rateLimit({
  store: createRateLimitStore(RATE_LIMITS.resetPassword.windowMs), // ✅ Use PostgreSQL store with windowMs
  windowMs: RATE_LIMITS.resetPassword.windowMs,
  max: RATE_LIMITS.resetPassword.max,
  keyGenerator: (req: any) => rlKey('resetPassword', getEmailOrIp(req)),
  message: {
    error: 'Too many password reset attempts. Please try again later.',
    retryAfter: formatRetryAfter(RATE_LIMITS.resetPassword.windowMs),
  },
  standardHeaders: true,
  legacyHeaders: false,
  // ✅ FIX: Only count successful password resets (not button clicks or failed attempts)
  skipFailedRequests: true,
  handler: (req, res) => {
    const key = rlKey('resetPassword', getEmailOrIp(req));
    logRateLimitViolation(req, 'resetPassword', key, RATE_LIMITS.resetPassword.max, RATE_LIMITS.resetPassword.windowMs);
    return res.status(429).json({
      success: false,
      error: 'Too many password reset attempts. Please try again later.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter: formatRetryAfter(RATE_LIMITS.resetPassword.windowMs)
    });
  },
});

// ✅ Delete account rate limiter (per user/IP) - prevents brute force on password
export const deleteAccountRateLimit = rateLimit({
  store: createRateLimitStore(RATE_LIMITS.deleteAccount.windowMs), // ✅ Use PostgreSQL store with windowMs
  windowMs: RATE_LIMITS.deleteAccount.windowMs,
  max: RATE_LIMITS.deleteAccount.max,
  keyGenerator: (req: any) => {
    const userId = req.user?.id || req.user?.userId || null;
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    // Prefer userId (authenticated route), fallback to IP
    return `delete_account:${userId || ip}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  // ✅ FIX: Only count failed delete account attempts (wrong password etc.) - brute force protection
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    const userId = req.user?.id || req.user?.userId || null;
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `delete_account:${userId || ip}`;
    logRateLimitViolation(req, 'deleteAccount', key, RATE_LIMITS.deleteAccount.max, RATE_LIMITS.deleteAccount.windowMs);
    // ✅ Custom handler to ensure proper JSON response for frontend error handling
    return res.status(429).json({
      success: false,
      error: 'Too many account deletion attempts. Please try again later.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter: formatRetryAfter(RATE_LIMITS.deleteAccount.windowMs),
    });
  },
});

// ✅ Delete account success cooldown limiter (per email) - prevents create → delete → create abuse loop
export const deleteAccountSuccessRateLimit = rateLimit({
  store: createRateLimitStore(RATE_LIMITS.deleteAccountSuccess.windowMs), // ✅ Use PostgreSQL store with windowMs
  windowMs: RATE_LIMITS.deleteAccountSuccess.windowMs,
  max: RATE_LIMITS.deleteAccountSuccess.max,
  keyGenerator: (req: any) => {
    const email = (req.user?.email || '').toLowerCase();
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    // ✅ Use email as primary key (prevents same email from deleting multiple times in 24h)
    return `delete_account_success:${email || ip}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  // ✅ FIX: Only count SUCCESSFUL deletions (cooldown after successful delete)
  skipFailedRequests: true,
  handler: (req, res) => {
    const email = (req.user?.email || '').toLowerCase();
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `delete_account_success:${email || ip}`;
    logRateLimitViolation(req, 'deleteAccountSuccess', key, RATE_LIMITS.deleteAccountSuccess.max, RATE_LIMITS.deleteAccountSuccess.windowMs);
    // ✅ Custom handler to ensure proper JSON response for frontend error handling
    return res.status(429).json({
      success: false,
      error: 'Account deletion cooldown active. You can delete an account once per 24 hours per email. Please try again later.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter: formatRetryAfter(RATE_LIMITS.deleteAccountSuccess.windowMs),
    });
  },
});

// ✅ Contact form rate limiter (IP + email based)
export const contactFormRateLimit = rateLimit({
  store: createRateLimitStore(RATE_LIMITS.contactForm.windowMs), // ✅ Use PostgreSQL store with windowMs
  windowMs: RATE_LIMITS.contactForm.windowMs,
  max: RATE_LIMITS.contactForm.max,
  keyGenerator: (req: any) => {
    const email = (req.body?.email || '').toLowerCase();
    const raw = email || req.ip || req.socket?.remoteAddress || 'unknown';
    return rlKey('contactForm', raw);
  },
  message: {
    error: 'Too many contact form submissions. Please wait before trying again.',
    retryAfter: formatRetryAfter(RATE_LIMITS.contactForm.windowMs)
  },
  standardHeaders: true,
  legacyHeaders: false,
  // ✅ FIX: Only count when contact form submission actually succeeds
  skipFailedRequests: true,
  handler: (req, res) => {
    const email = (req.body?.email || '').toLowerCase();
    const raw = email || req.ip || req.socket?.remoteAddress || 'unknown';
    const key = rlKey('contactForm', raw);
    logRateLimitViolation(req, 'contactForm', key, RATE_LIMITS.contactForm.max, RATE_LIMITS.contactForm.windowMs);
    return res.status(429).json({
      success: false,
      error: 'Too many contact form submissions. Please wait before trying again.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter: formatRetryAfter(RATE_LIMITS.contactForm.windowMs)
    });
  },
});

// ✅ Daily contact form limit (per IP) - prevents abuse
export const contactFormDailyLimit = rateLimit({
  store: createRateLimitStore(RATE_LIMITS.contactFormDaily.windowMs), // ✅ Use PostgreSQL store with windowMs
  windowMs: RATE_LIMITS.contactFormDaily.windowMs,
  max: RATE_LIMITS.contactFormDaily.max,
  keyGenerator: (req: any) => rlKey('contactFormDaily', req.ip || req.socket?.remoteAddress || 'unknown'),
  standardHeaders: true,
  legacyHeaders: false,
  // ✅ FIX: Only count when contact form submission actually succeeds
  skipFailedRequests: true,
  handler: (req, res) => {
    const key = rlKey('contactFormDaily', req.ip || req.socket?.remoteAddress || 'unknown');
    logRateLimitViolation(req, 'contactFormDaily', key, RATE_LIMITS.contactFormDaily.max, RATE_LIMITS.contactFormDaily.windowMs);
    return res.status(429).json({
      success: false,
      error: 'Daily contact form limit reached. Please try again tomorrow.',
      errorCode: 'DAILY_LIMIT_EXCEEDED',
      retryAfter: formatRetryAfter(RATE_LIMITS.contactFormDaily.windowMs)
    });
  },
});
