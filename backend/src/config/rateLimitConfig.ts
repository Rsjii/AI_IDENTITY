import { isProd } from './env';
export { isProd };

/**
 * Rate Limiting Configuration
 * Separate production and development limits
 * Production: Strict limits to prevent abuse
 * Development: Loose limits for testing convenience
 */

type LimitConfig = {
  windowMs: number;
  max: number;
};

/**
 * Production rate limits (strict, security-focused)
 * Based on OWASP API Security guidelines, industry best practices, and common SaaS patterns
 * 
 * Industry Standards Reference:
 * - Auth endpoints: 5-10 requests per 15 min (prevents brute force attacks)
 * - OTP endpoints: 3-5 requests per 15 min (prevents abuse and spam)
 * - Resource creation: 5-10 per hour (prevents spam and abuse)
 */
const prodLimits = {
  // Critical auth flows - strict limits (OWASP recommended: 5-10 per 15 min)
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per 15 min per email/IP (stricter for security)
  } as LimitConfig,

  googleOAuth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 8, // 8 Google OAuth GET hits per 15 min per IP (prevents abuse)
  } as LimitConfig,

  otpRequest: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 OTP requests per 15 min per IP/email (OWASP standard: 3-5 per 15 min)
  } as LimitConfig,

  otpVerify: {
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5, // 5 OTP verification attempts per 10 min per email/IP (OWASP standard: 5-10 per 10 min)
  } as LimitConfig,

  changePassword: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1, // 1 password change attempt per hour per user (allows retry with typos)
  } as LimitConfig,

  resetPassword: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1, // 1 password reset attempt per 15 min per email/IP (prevents abuse)
  } as LimitConfig,

  deleteAccount: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // 3 failed delete-account attempts per 15 min per user/IP (prevents brute force)
  } as LimitConfig,

  deleteAccountSuccess: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 1, // ✅ 1 successful deletion per email per 24 hours (prevents abuse: create → delete → create loop)
  } as LimitConfig,

  global: {
    windowMs: 15 * 60 * 1000,
    max: 500, // 500 requests per 15 minutes (prevents abuse)
  } as LimitConfig,

  api: {
    windowMs: 15 * 60 * 1000,
    max: 500,// 500 requests per 15 minutes (prevents abuse)
  } as LimitConfig,

  draftGeneration: {
    windowMs: 30 * 1000, // 30 seconds
    max: 10, // 10 drafts per 30 seconds per user (prevents abuse)
  } as LimitConfig,

  identityCreate: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 identity creations per hour per user
  } as LimitConfig,

  trustConfirm: {
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 confirmations per minute per user
  } as LimitConfig,

  mirrorDaily: {
    windowMs: 30 * 24 * 60 * 60 * 1000, // 30 days (monthly limit)
    max: 200, // Max value (actual limit is 10 for free tier, overridden in middleware)
  } as LimitConfig,

  inviteCreation: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 20, // 20 invites per day per user
  } as LimitConfig,

  // ✅ ADD: Contact form limits
  contactForm: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 2, // 2 submission per hour per IP/email (prevents spam)
  } as LimitConfig,

  contactFormDaily: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 5, // 5 submissions per day per IP (prevents abuse)
  } as LimitConfig,

  widgetChat: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 req/min per IP
  } as LimitConfig,
};

/**
 * Development rate limits (loose, for testing convenience)
 * Much higher limits to avoid blocking during development
 */
const devLimits: typeof prodLimits = {
  // Auth flows - very loose for dev
  login: {
    windowMs: 15 * 60 * 1000,
    max: 1000, // Very high to avoid blocking
  },

  googleOAuth: {
    windowMs: 15 * 60 * 1000,
    max: 1000000, // Very high for dev
  },

  otpRequest: {
    windowMs: 10 * 60 * 1000,
    max: 1000, // Very high for testing
  },

  otpVerify: {
    windowMs: 10 * 60 * 1000,
    max: 1000, // Very high for testing
  },

  changePassword: {
    windowMs: 60 * 60 * 1000,
    max: 1000, // Very high for testing
  },

  resetPassword: {
    windowMs: 15 * 60 * 1000,
    max: 1000, // Very high for testing
  },

  deleteAccount: {
    windowMs: 15 * 60 * 1000,
    max: 1000, // Very high for testing
  },

  deleteAccountSuccess: {
    windowMs: 24 * 60 * 60 * 1000,
    max: 1000, // Very high for testing
  },


  global: {
    windowMs: 15 * 60 * 1000,
    max: 10000000,
  },

  api: {
    windowMs: 15 * 60 * 1000,
    max: 5000000,
  },


  draftGeneration: {
    windowMs: 30 * 1000,
    max: 100, // Keep current testing value
  },

  identityCreate: {
    windowMs: 60 * 60 * 1000,
    max: 1000, // Very high for testing
  },

  trustConfirm: {
    windowMs: 60 * 1000,
    max: 100000, // Very high for testing
  },

  mirrorDaily: {
    windowMs: 30 * 24 * 60 * 60 * 1000, // 30 days (monthly limit)
    max: 100000, // Very high for testing
  },

  inviteCreation: {
    windowMs: 24 * 60 * 60 * 1000,
    max: 50, // Keep current value
  },

  // ✅ ADD: Contact form limits (loose for dev)
  contactForm: {
    windowMs: 15 * 60 * 1000,
    max: 1000, // Very high for testing
  },

  contactFormDaily: {
    windowMs: 24 * 60 * 60 * 1000,
    max: 1000, // Very high for testing
  },

  widgetChat: {
    windowMs: 60 * 1000,
    max: 200,
  },
};

/**
 * Export the appropriate limits based on environment
 */
export const RATE_LIMITS = isProd ? prodLimits : devLimits;

/**
 * Helper to format retry after message
 */
export const formatRetryAfter = (windowMs: number): string => {
  const minutes = Math.floor(windowMs / (60 * 1000));
  if (minutes < 1) {
    const seconds = Math.floor(windowMs / 1000);
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
};

