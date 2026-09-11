import { Request, Response, NextFunction } from 'express';
import { userQueries, otpQueries, db, identityQueries } from '../../config/database';
import { EmailService, generateOTP, hashOTP, verifyOTP, hashPassword, verifyPassword , generateInviteCode} from './authService';
import { logger } from '../../config/logger';
import { config, isProd } from '../../config/env';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../middleware/auth';
import { generateJWT } from '../../services/jwtService';
import { createError, ErrorCodes, AppError } from '../../utils/errors';
import { handleErrorWithResponse } from '../../utils/errorHandler';
import { logEvent } from '../../services/eventLogger';
import { EventLogger } from '../../services/eventLogger';
import { EVENT_TYPES, ADMIN_EMAILS } from '../../config/constants';
import { identifyPostHogUser } from '../../services/posthogService';
import { tokenizeId } from '../../utils/idTokenization';
import { createOrUpdateAuthSession } from '../../services/authSessionService';
import { generateRandomHandle } from '../../utils/idGenerator';
import { verifyJWT } from '../../services/jwtService';
import { revokeAuthSession } from '../../services/authSessionService';

const cookieSameSite = isProd ? 'none' : 'lax';

const emailService = new EmailService();

/**
 * Helper: Get redirect URL after login (check if identity exists)
 */
async function getPostLoginRedirect(userId: string): Promise<string> {
  const identity = await identityQueries.findByUserId(userId);
  if (identity) {
    return '/mirror';
  }
  return '/identity/setup';
}

const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .refine((p) => !/\s/.test(p), 'Password must not contain spaces'),
  referralCode: z.string().optional(),
});

const signupVerifySchema = z.object({
  email: z.string().email('Invalid email format'),
  code: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must contain only numbers'),
});

const completeProfileSchema = z.object({
  email: z.string().email('Valid email is required'),
  name: z.string()
    .min(1, 'Name is required')
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name is too long'),
  username: z.string()
    .min(1, 'Username is required')
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .refine((val) => !val.startsWith('_') && !val.endsWith('_'), 'Username cannot start or end with underscore'),
  phone: z.string()
    .optional()
    .refine((value) => {
      // ✅ Optional field - allow empty
      if (!value || value.trim() === '') return true;

      // ✅ MUST start with +
      if (!value.trim().startsWith('+')) {
        return false;
      }

      // ✅ Split by space: +[country code] [phone number]
      const parts = value.trim().split(/\s+/);

      // ✅ Must have exactly 2 parts: [+countryCode] and [phoneNumber]
      if (parts.length !== 2) {
        return false;
      }

      const countryCodePart = parts[0]; // e.g. "+91"
      const phoneNumberPart = parts[1];  // e.g. "1234567890"

      // ✅ Country code part: must be + followed by 1-3 digits
      if (!/^\+[1-9]\d{0,2}$/.test(countryCodePart)) {
        return false; // +1, +91, +123 valid; +0, +01, +0123 invalid
      }

      // ✅ Phone number part: must be exactly 10 digits
      if (!/^\d{10}$/.test(phoneNumberPart)) {
        return false;
      }

      return true;
    }, 'Phone number must be in format: +[country code] [10 digits] (e.g. +91 1234567890 or +1 1234567890)'),
  profileImage: z.string().nullable().optional(),
  timeZone: z.string().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

// Schema for forgot-password/verify (includes OTP code)
const forgotPasswordVerifySchema = z.object({
  email: z.string().email('Invalid email format'),
  code: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must contain only numbers'),
});

// Schema for reset-password (no code needed, already verified)
const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .refine((p) => !/\s/.test(p), 'Password must not contain spaces'),
});

export const signup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, referralCode } = signupSchema.parse(req.body);
    
    logger.info({ email: String(email).toLowerCase() }, 'Attempting signup');
    
    // Check if user already exists
    let existingUser;
    try {
      existingUser = await userQueries.findByEmail(email.toLowerCase());
    } catch (dbError: any) {
      logger.error({ err: dbError }, 'Failed to check existing user');
      // If we can't check, fail safe - don't allow signup
      return res.status(500).json({
        error: 'Database error. Please try again later.',
        errorCode: 'DATABASE_ERROR'
      });
    }
    if (existingUser) {
      // ✅ IMPROVED: If user exists but NOT active, allow resend OTP instead of deleting
      if (!existingUser.active) {
        logger.info(`User ${email} exists but not verified. Allowing OTP resend.`);
        
        // Generate new OTP (don't delete user)
        const otp = generateOTP(config.otp.codeLength);
        const hashedOTP = await hashOTP(otp);
        const expiryMinutes = Number.isFinite(config.otp.expiryMinutes) ? config.otp.expiryMinutes : 10;
        const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
        
        // Delete old OTP and create new one
        await otpQueries.deleteByEmail(email.toLowerCase(), 'signup');
        await otpQueries.create(email.toLowerCase(), hashedOTP, expiresAt, 'signup');
        
        const emailSent = await emailService.sendOTP(email, otp, 'signup');
        
        if (isProd) {
          if (!emailSent) {
            return res.status(500).json({
              error: 'Failed to send verification email. Please check your email configuration or try again later.',
              errorCode: 'EMAIL_SEND_FAILED',
            });
          }
        } else {
          logger.info(`📧 [SIGNUP] Development mode: OTP ${otp} generated (not sent via email)`);
        }
        
        return res.json({ 
          message: 'OTP resent to your email',
          redirect: '/signup/verify?email=' + encodeURIComponent(email)
        });
      } else {
        // User exists and is active (verified)
        // ✅ FIX: If OAuth account exists, allow password linking
        if (existingUser.googleId && !existingUser.passwordHash) {
          // OAuth-only account - allow password linking
          logger.info(`Linking password to existing OAuth account: ${email}`);
          const passwordHash = await hashPassword(password);
          await userQueries.updatePassword(email.toLowerCase(), passwordHash);
          
          // Get updated user
          const updatedUser = await userQueries.findByEmail(email.toLowerCase());
          if (!updatedUser) {
            return res.status(500).json({
              error: 'Failed to update account. Please try again.',
              errorCode: 'DATABASE_ERROR'
            });
          }
          
          // Continue with OTP generation for verification (skip user creation)
          // Set user and referrerId for later use
          const user = updatedUser;
          let referrerId = null;
          if (referralCode) {
            const referrer = await userQueries.findByReferralCode(referralCode);
            if (referrer) {
              referrerId = referrer.id;
            }
          }
          
          // Log signup event (for password linking)
          try {
            await EventLogger.logUserEvent(user.id, EVENT_TYPES.PASSWORD_LINKED, {
              flow: 'signup'
            });
          } catch (eventError) {
            logger.warn({ err: eventError }, 'Failed to log password linking event');
          }
          
          // If they were referred, link them
          if (referrerId) {
            const { db } = await import('../../config/database');
            const { generateId } = await import('../../utils/idGenerator');
            
            const inviteId = generateId.invite();
            await db.query(
              'INSERT INTO "Invite" (id, code, "inviterId", "acceptedBy") VALUES ($1, $2, $3, $4)',
              [inviteId, referralCode, referrerId, user.id]
            );
            
            await EventLogger.logInviteAccepted(user.id, referralCode, referrerId);
          }
          
          // Generate OTP for password verification
          const otp = generateOTP(config.otp.codeLength);
          const hashedOTP = await hashOTP(otp);
          const expiryMinutes = Number.isFinite(config.otp.expiryMinutes) ? config.otp.expiryMinutes : 10;
          const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
          
          await otpQueries.create(email.toLowerCase(), hashedOTP, expiresAt, 'signup');
          logger.info(`OTP created for password linking: ${email}`);
          
          const emailSent = await emailService.sendOTP(email, otp, 'signup');
          
          if (isProd) {
            if (!emailSent) {
              logger.error(`❌ [SIGNUP] Email send failed for ${email} in production`);
              return res.status(500).json({
                error: 'Failed to send verification email. Please check your email configuration or try again later.',
                errorCode: 'EMAIL_SEND_FAILED',
              });
            }
          } else {
            logger.info(`📧 [SIGNUP] Development mode: OTP ${otp} generated (not sent via email)`);
          }
          
          return res.json({ 
            message: 'Password linked successfully. OTP sent to your email for verification.',
            redirect: '/signup/verify?email=' + encodeURIComponent(email)
          });
        } else if (existingUser.passwordHash && !existingUser.googleId) {
          // Password account exists - suggest login
          logger.warn(`Signup failed: User already exists and active - ${email}`);
          return res.status(409).json({
            error: 'Account already exists. Please login instead.',
            errorCode: 'USER_ALREADY_EXISTS',
            suggestLogin: true
          });
        } else {
          // Both exist or account already complete
          logger.warn(`Signup failed: User already exists with both auth methods - ${email}`);
          return res.status(409).json({
            error: 'Account already exists. Please login instead.',
            errorCode: 'USER_ALREADY_EXISTS'
          });
        }
      }
    }    
    
    logger.info(`User does not exist, creating new user: ${email}`);
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Generate unique referral code for NEW user
    const userReferralCode = generateInviteCode();
    
    // Check if referral code is valid (find referrer)
    let referrerId = null;
    if (referralCode) {
      const referrer = await userQueries.findByReferralCode(referralCode);
      if (referrer) {
        referrerId = referrer.id;
      }
    }
    
    // Create user with their own referral code
    const user = await userQueries.create(
      email.toLowerCase(), 
      undefined, 
      passwordHash, 
      userReferralCode
    );
    
    logger.info(`User created successfully: ${user.id}`);

    // Log signup event
    try {
      await EventLogger.logSignup(user.id, {
        source: referralCode ? 'referral' : 'direct'
      });
    } catch (eventError) {
      logger.warn({ err: eventError }, 'Failed to log signup event');
    }

    // ✅ Identify user in PostHog
    identifyPostHogUser(user.id, {
      handle: user.handle,
      createdAt: user.createdAt ? (typeof user.createdAt === 'string' ? user.createdAt : user.createdAt.toISOString()) : new Date().toISOString()
    });

// If they were referred, link them
if (referrerId) {
  const { db } = await import('../../config/database');
  const { generateId } = await import('../../utils/idGenerator');
  
  // Create invite record linking them
  const inviteId = generateId.invite();
  await db.query(
    'INSERT INTO "Invite" (id, code, "inviterId", "acceptedBy") VALUES ($1, $2, $3, $4)',
    [inviteId, referralCode, referrerId, user.id]
  );
  
  // Log event
  await EventLogger.logInviteAccepted(user.id, referralCode, referrerId);
}    
    
  // Generate OTP
    const otp = generateOTP(config.otp.codeLength);
    const hashedOTP = await hashOTP(otp);
    
    // ✅ FIX: Ensure expiryMinutes is valid, use default if not
    const expiryMinutes = Number.isFinite(config.otp.expiryMinutes) ? config.otp.expiryMinutes : 10;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    
    await otpQueries.create(email.toLowerCase(), hashedOTP, expiresAt, 'signup');
    logger.info(`OTP created for ${email}`);
    
    // ✅ Send OTP via email (only in production)
    const emailSent = await emailService.sendOTP(email, otp, 'signup');
    
    if (isProd) {
      if (!emailSent) {
        logger.error(`❌ [SIGNUP] Email send failed for ${email} in production`);
        return res.status(500).json({
          error: 'Failed to send verification email. Please check your email configuration or try again later.',
          errorCode: 'EMAIL_SEND_FAILED',
        });
      }
    } else {
      // Development: OTP is fixed, no email needed
      logger.info(`📧 [SIGNUP] Development mode: OTP ${otp} generated (not sent via email)`);
    }
    
    res.json({ 
      message: 'OTP sent to your email',
      // ✅ REMOVED: otp: otp (never send OTP in response)
      redirect: '/signup/verify?email=' + encodeURIComponent(email)
    });
  } catch (error: any) {
    logger.error({
      err: error,
      message: error?.message || 'Unknown signup error',
      stack: error?.stack,
      name: error?.name,
      path: req.path,
      method: req.method,
    }, '❌ SIGNUP ERROR - Full details:');
    
    // Handle Zod validation errors with proper messages
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: error.errors[0]?.message || 'Validation failed',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        details: error.errors
      });
    }
    
    // Handle other errors
    handleErrorWithResponse(error, res, 'Failed to signup. Please try again.');
  }
};

export const signupVerify = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code } = signupVerifySchema.parse(req.body);
    
    // ✅ Check if user already exists and is active (verified)
    let existingUser;
    try {
      existingUser = await userQueries.findByEmail(email.toLowerCase());
    } catch (dbError: any) {
      logger.error('Failed to check existing user in signupVerify:', dbError);
      // If we can't check, fail safe - don't allow verification
      return res.status(500).json({
        error: 'Database error. Please try again later.',
        errorCode: 'DATABASE_ERROR'
      });
    }
    if (existingUser && existingUser.active) {
      return res.status(409).json({
        error: 'Account already exists. Please login instead.',
        errorCode: 'USER_ALREADY_EXISTS'
      });
    }
    
    // Find valid OTP
    const otpRecord = await otpQueries.findByEmail(email.toLowerCase(), 'signup');
    
    if (!otpRecord) {
      return res.status(400).json({
        error: 'Invalid or expired OTP',
        errorCode: 'INVALID_OTP'
      });
    }
    
    // ✅ Check if OTP is expired (robust Date parsing with timezone support)
    const nowMs = Date.now();
    const expiresAtMs = otpRecord.expiresAt instanceof Date
      ? otpRecord.expiresAt.getTime()
      : new Date(String(otpRecord.expiresAt)).getTime();
    
    // If expiresAt is invalid -> treat as expired (and log)
    if (!Number.isFinite(expiresAtMs) || expiresAtMs < nowMs) {
      logger.warn(`OTP expired for ${email}. ExpiresAt: ${otpRecord.expiresAt}, Now: ${new Date(nowMs).toISOString()}, ExpiresAtMs: ${expiresAtMs}, NowMs: ${nowMs}`);
      return res.status(400).json({
        error: 'OTP has expired. Please request a new one.',
        errorCode: 'OTP_EXPIRED'
      });
    }
    
    // ✅ Check if OTP is already used
    if (otpRecord.used) {
      logger.warn(`OTP already used for ${email}`);
      return res.status(400).json({
        error: 'This OTP has already been used. Please request a new one.',
        errorCode: 'OTP_ALREADY_USED'
      });
    }
    
    // Verify OTP
    const isValid = await verifyOTP(code, otpRecord.codeHash);
    if (!isValid) {
      return res.status(400).json({
        error: 'Invalid OTP code',
        errorCode: 'INVALID_OTP'
      });
    }
    
    // Mark OTP as used
    await otpQueries.markAsUsed(otpRecord.id);
    
    // Activate user account
    await userQueries.activateUser(email.toLowerCase());
    
    // ✅ Set emailVerified flag
    await db.query(
      `UPDATE "User" SET "emailVerified" = true, "emailVerifiedAt" = CURRENT_TIMESTAMP WHERE email = $1`,
      [email.toLowerCase()]
    );
    
    // ✅ IMPORTANT: Issue JWT cookie so user can access ProtectedRoute onboarding
    const user = await userQueries.findByEmail(email.toLowerCase());
    if (user) {
      // ✅ NEW: Generate access + refresh tokens
      const { generateAccessToken, generateRefreshToken } = await import('../../services/jwtService');
      const refreshToken = generateRefreshToken();
      const accessTokenMaxAge = 15 * 60 * 1000; // 15 minutes
      const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      const expiresAt = new Date(Date.now() + accessTokenMaxAge);

      // Create auth session first to get sessionId.
      // ✅ IMPORTANT: If session creation fails (DB constraints/pooler glitches), do NOT block account activation.
      // Users must be able to proceed; session tracking is best-effort.
      const ipAddress =
        req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.connection.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';
      let sessionId: string | undefined;
      try {
        sessionId = await createOrUpdateAuthSession({
          userId: user.id,
          deviceInfo: userAgent,
          ipAddress,
          userAgent,
          expiresAt,
          refreshToken,
          refreshTokenExpiresAt,
        });
      } catch (sessionErr: any) {
        logger.warn(
          { err: sessionErr, userId: user.id, ipAddress, userAgent },
          'Auth session creation failed during signupVerify; continuing without sessionId'
        );
        sessionId = undefined;
      }
      
      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        handle: user.handle || '',
        ...(sessionId ? { sessionId } : {})
      });

      res.cookie('jwtToken', accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: cookieSameSite,
        maxAge: accessTokenMaxAge,
        path: '/',
      });
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: cookieSameSite,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: '/',
      });
      if (req.session) {
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.userHandle = user.handle;
      }
    }
    
    res.json({ 
      message: 'Account activated successfully', 
      redirect: `/signup/profile?email=${encodeURIComponent(email)}`
    });
  } catch (error: any) {
    // ✅ Ensure Error is serialized (message/stack) so we can see root cause in logs
    logger.error({ err: error }, 'Signup verify error');
    
    // Handle Zod validation errors with proper messages
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: error.errors[0]?.message || 'Validation failed',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        details: error.errors
      });
    }
    
    // Handle other errors
    handleErrorWithResponse(error, res, 'Failed to verify signup. Please try again.');
  }
};

export const completeProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ✅ OPTIMIZATION: Validate username length FIRST before any DB queries
    // This prevents slow DB queries for invalid usernames
    const rawData = req.body;
    if (rawData.username && rawData.username.length < 3) {
      return res.status(400).json({
        error: 'Validation failed',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        fieldErrors: {
          username: 'Username must be at least 3 characters',
        },
      });
    }

    const { email, name, username, phone, profileImage, timeZone } = completeProfileSchema.parse(req.body);

    // Check if username is already taken
    const existingUser = await userQueries.findByHandle(username.toLowerCase());
    if (existingUser) {
      // Log username conflict event
      try {
        const user = await userQueries.findByEmail(email.toLowerCase()).catch(() => null);
        if (user) {
          await EventLogger.logUserEvent(user.id, EVENT_TYPES.ERROR, {
            errorType: 'USERNAME_TAKEN',
            errorMessage: 'Username already taken during profile completion',
            attemptedUsername: username.toLowerCase(),
          });
        }
      } catch (eventError) {
        logger.warn('Failed to log USERNAME_TAKEN event:', eventError);
      }
      
      return res.status(409).json({
        error: 'Username is already taken',
        errorCode: 'USERNAME_TAKEN',
        fieldErrors: {
          username: 'This username is already taken. Please choose another.',
        },
      });
    }

    // Update user profile with user-provided username
    await userQueries.updateProfile(
      email.toLowerCase(),
      name,
      username.toLowerCase(), // handle - user provided username
      null, // dob - not used
      phone || '',
      '', // bio - not used
      profileImage || null,
      timeZone || null
    );

    // Find user and generate JWT
    const user = await userQueries.findByEmail(email.toLowerCase());
    if (!user) {
      logger.error('Complete profile: User not found after update');
      throw createError.notFound('User not found');
    }
    
    // ✅ Profile exists via User.handle - no TwinProfile needed
    // Profile URL /@handle works immediately after signup
    
    // Generate JWT token
    const token = generateJWT({
      userId: user.id,
      email: user.email,
      handle: user.handle || ''
    });
    
    // Set JWT token in cookie
    res.cookie('jwtToken', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: cookieSameSite,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    });

    // Log profile completed event
    try {
      await EventLogger.logUserEvent(user.id, EVENT_TYPES.PROFILE_COMPLETED, { 
        name: user.name || name,
        handle: user.handle || ''
      });
    } catch (eventError) {
      logger.warn('Failed to log profile_completed event:', eventError);
    }

    // Get redirect URL - let user choose visitor or creator
    const redirectUrl = '/choose-type';

    res.json({ 
      message: 'Profile completed successfully', 
      redirect: redirectUrl,
      token: token,
      user: {
        id: user.id,
        email: user.email,
        handle: user.handle,
        name: user.name
      }
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Complete profile error');

    // ✅ 1) Zod validation errors → fieldErrors map (already there)
    if (error instanceof z.ZodError) {
      // Log validation error event
      try {
        const email = req.body?.email;
        if (email) {
          const user = await userQueries.findByEmail(email.toLowerCase()).catch(() => null);
          if (user) {
            await EventLogger.logUserEvent(user.id, EVENT_TYPES.ERROR, {
              errorType: 'PROFILE_VALIDATION_ERROR',
              errorMessage: 'Profile completion validation failed',
              validationErrors: error.errors.map(e => ({ field: e.path[0], message: e.message })),
            });
          }
        }
      } catch (eventError) {
        logger.warn('Failed to log profile validation error event:', eventError);
      }

      // Format errors for frontend
      const fieldErrors: Record<string, string> = {};
      error.errors.forEach((err) => {
        const field = err.path[0] as string;
        if (!fieldErrors[field]) {
          fieldErrors[field] = err.message;
        }
      });
      
      return res.status(400).json({
        error: 'Validation failed',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        details: error.errors,
        fieldErrors: fieldErrors,
      });
    }

    // ✅ 2) NEW: duplicate username / handle (unique constraint)
    if (error?.code === '23505' && error?.constraint === 'User_handle_key') {
      return res.status(409).json({
        error: 'Username is already taken',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        fieldErrors: {
          handle: 'This username is already taken. Please choose another.',
        },
      });
    }

    // ✅ 3) Fallback: other errors
    handleErrorWithResponse(error, res, 'Failed to complete profile. Please try again.');
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    
    // Check if user exists
    const user = await userQueries.findByEmail(email.toLowerCase());
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        errorCode: 'USER_NOT_FOUND'
      });
    }
    
    // ✅ OAuth-only user → guide them to Google login
    if (!user.passwordHash && user.googleId) {
      return res.status(400).json({
        error: 'This account uses Google login. Please login with Google instead.',
        errorCode: 'OAUTH_ONLY_ACCOUNT',
        suggestGoogleLogin: true
      });
    }
    
    // Generate OTP for password reset
    const otp = generateOTP(config.otp.codeLength);
    const hashedOTP = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + config.otp.expiryMinutes * 60 * 1000);
    
    // Store OTP
    await otpQueries.create(email.toLowerCase(), hashedOTP, expiresAt, 'forgot');
    
    // ✅ Send OTP via email (only in production)
    const emailSent = await emailService.sendOTP(email, otp, 'forgot');
    
    if (isProd) {
      if (!emailSent) {
        logger.error(`Email send failed for ${email} in production`);
        return res.status(500).json({
          error: 'Failed to send verification email. Please check your email configuration or try again later.',
          errorCode: 'EMAIL_SEND_FAILED',
        });
      }
    } else {
      logger.info(`Development mode: OTP ${otp} generated (not sent via email)`);
    }
    
    res.json({ 
      message: 'OTP sent to your email',
      // ✅ REMOVED: otp: otp
      redirect: '/forgot-password/reset?email=' + encodeURIComponent(email)
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    
    // Handle Zod validation errors with proper messages
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: error.errors[0]?.message || 'Validation failed',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        details: error.errors
      });
    }
    
    // Handle other errors
    handleErrorWithResponse(error, res, 'Failed to process forgot password. Please try again.');
  }
};

export const forgotPasswordVerify = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code } = forgotPasswordVerifySchema.parse(req.body);
    
    // Find valid OTP
    const otpRecord = await otpQueries.findByEmail(email.toLowerCase(), 'forgot');
    
    if (!otpRecord) {
      return res.status(400).json({
        error: 'Invalid or expired OTP',
        errorCode: 'INVALID_OTP'
      });
    }
    
    // ✅ Check if OTP is expired (robust Date parsing with timezone support)
    const nowMs = Date.now();
    const expiresAtMs = otpRecord.expiresAt instanceof Date
      ? otpRecord.expiresAt.getTime()
      : new Date(String(otpRecord.expiresAt)).getTime();
    
    // If expiresAt is invalid -> treat as expired (and log)
    if (!Number.isFinite(expiresAtMs) || expiresAtMs < nowMs) {
      logger.warn(`OTP expired for ${email}. ExpiresAt: ${otpRecord.expiresAt}, Now: ${new Date(nowMs).toISOString()}, ExpiresAtMs: ${expiresAtMs}, NowMs: ${nowMs}`);
      return res.status(400).json({
        error: 'OTP has expired. Please request a new one.',
        errorCode: 'OTP_EXPIRED'
      });
    }
    
    // ✅ Check if OTP is already used
    if (otpRecord.used) {
      logger.warn(`OTP already used for ${email}`);
      return res.status(400).json({
        error: 'This OTP has already been used. Please request a new one.',
        errorCode: 'OTP_ALREADY_USED'
      });
    }
    
    // Verify OTP
    const isValid = await verifyOTP(code, otpRecord.codeHash);
    if (!isValid) {
      return res.status(400).json({
        error: 'Invalid OTP code',
        errorCode: 'INVALID_OTP'
      });
    }
    
    // Mark OTP as used
    await otpQueries.markAsUsed(otpRecord.id);
    
    res.json({ 
      message: 'OTP verified successfully', 
      redirect: '/reset-password?email=' + encodeURIComponent(email)
    });
  } catch (error) {
    logger.error('Forgot password verify error:', error);
    
    // Handle Zod validation errors with proper messages
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: error.errors[0]?.message || 'Validation failed',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        details: error.errors
      });
    }
    
    // Handle other errors
    handleErrorWithResponse(error, res, 'Failed to verify forgot password. Please try again.');
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ✅ Use resetPasswordSchema instead of inline schema for consistency
    const { email, password } = resetPasswordSchema.parse(req.body);

    // ✅ SECURITY FIX: Require OTP verification before allowing password reset
    // Check if a verified OTP exists for this email (must be marked as used)
    const otpRecord = await otpQueries.findByEmail(email.toLowerCase(), 'forgot');
    if (!otpRecord || !otpRecord.used) {
      return res.status(400).json({
        error: 'OTP verification required. Please verify OTP first.',
        errorCode: 'OTP_REQUIRED'
      });
    }

    // ✅ Check if OTP has expired (robust Date parsing with timezone support)
    const nowMs = Date.now();
    const expiresAtMs = otpRecord.expiresAt instanceof Date
      ? otpRecord.expiresAt.getTime()
      : new Date(String(otpRecord.expiresAt)).getTime();
    
    // If expiresAt is invalid -> treat as expired
    if (!Number.isFinite(expiresAtMs) || expiresAtMs < nowMs) {
      return res.status(400).json({
        error: 'OTP has expired. Please request a new one.',
        errorCode: 'OTP_EXPIRED'
      });
    }

    // Check if user exists
    const user = await userQueries.findByEmail(email.toLowerCase());
    if (!user) {
      throw createError.notFound('User not found', ErrorCodes.USER_NOT_FOUND);
    }

     // Check if user has a password set
     if (user.passwordHash) {
      const isSamePassword = await verifyPassword(password, user.passwordHash);
      if (isSamePassword) {
        throw createError.validation('Password is same as current password', ErrorCodes.VALIDATION_ERROR);
      }
    }
    
    // Hash new password
    const passwordHash = await hashPassword(password);
    
    // Update password
    await userQueries.updatePassword(email.toLowerCase(), passwordHash);
    
    // ✅ SECURITY: Delete OTP after successful password reset (prevent reuse)
    await otpQueries.deleteByEmail(email.toLowerCase(), 'forgot');
    
    res.json({ 
      message: 'Password reset successfully', 
      redirect: '/auth'
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    
    // Handle Zod validation errors with proper messages
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: error.errors[0]?.message || 'Validation failed',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        details: error.errors
      });
    }
    
    // Handle other errors
    handleErrorWithResponse(error, res, 'Failed to reset password. Please try again.');
  }
};

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

const loginVerifySchema = z.object({
  email: z.string().email('Invalid email format'),
  code: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must contain only numbers'),
});

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, rememberMe } = loginSchema.parse(req.body);
    
    // Find user
    const user = await userQueries.findByEmail(email.toLowerCase());
    
    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password',
        errorCode: 'UNAUTHORIZED'
      });
    }

    if (!user.passwordHash && user.googleId) {
      return res.status(400).json({
        error: 'This email uses Google login. Please continue with Google.',
        errorCode: 'OAUTH_ONLY_ACCOUNT',
        suggestGoogleLogin: true
      });
    }

    if (!user.passwordHash) {
      return res.status(401).json({
        error: 'Invalid email or password',
        errorCode: 'UNAUTHORIZED'
      });
    }

    if (user.deletedAt || user.deletionScheduledAt) {
      return res.status(403).json({
        error: 'Account deletion requested. Login is disabled.',
        errorCode: 'ACCOUNT_DELETION_REQUESTED',
      });
    }
    
    // Check if user is active
    if (!user.active) {
      // Log the login attempt failure
      try {
        await EventLogger.logUserEvent(user.id, EVENT_TYPES.ERROR, {
          errorType: 'ACCOUNT_NOT_VERIFIED',
          errorMessage: 'Login attempt with unverified account',
          email: user.email,
        });
      } catch (eventError) {
        logger.warn('Failed to log ACCOUNT_NOT_VERIFIED event:', eventError);
      }
      
      return res.status(403).json({
        error: 'Your account is not verified. Please check your email for the verification code and complete signup, or signup again to receive a new code.',
        errorCode: 'ACCOUNT_NOT_VERIFIED',
        message: 'Please verify your email to continue. Check your inbox for the OTP code.',
      });
    }
    
    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid email or password',
        errorCode: 'UNAUTHORIZED'
      });
    }
    
    // ✅ NEW: Generate short-lived access token (15 min) + refresh token (30 days)
    const { generateAccessToken, generateRefreshToken } = await import('../../services/jwtService');
    const refreshToken = generateRefreshToken();
    
    const accessTokenMaxAge = 15 * 60 * 1000; // 15 minutes
    const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const expiresAt = new Date(Date.now() + accessTokenMaxAge);
    
    // Create auth session first to get sessionId
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.connection.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const sessionId = await createOrUpdateAuthSession({
      userId: user.id,
      deviceInfo: userAgent,
      ipAddress,
      userAgent,
      expiresAt,
      refreshToken,
      refreshTokenExpiresAt,
    });
    
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      handle: user.handle || '',
      sessionId: sessionId
    });
    
    // Set access token in cookie
    res.cookie('jwtToken', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: cookieSameSite,
      maxAge: accessTokenMaxAge,
      path: '/'
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: cookieSameSite,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });

    // ✅ Log login event in background (non-blocking)
    EventLogger.logLogin(user.id, {
      source: 'direct'
    }).catch((eventError) => {
      logger.warn({ err: eventError }, 'Failed to log login event');
    });

    // ✅ Identify user in PostHog (optional - can do on first login only)
    identifyPostHogUser(user.id, {
      handle: user.handle
    });

    // Get redirect URL
    let nextRedirect: string;

    // ✅ STEP 1: Check if profile is completed first (mandatory)
    if (!user.profileCompleted) {
      nextRedirect = `/signup/profile?email=${encodeURIComponent(user.email)}`;
    }
    // ✅ STEP 2: Profile done, check userType and onboarding status
    else {
      const userType = (user as any).userType;

      if (!userType) {
        nextRedirect = '/choose-type';
      } else if (userType === 'visitor') {
        nextRedirect = '/explore';
      } else {
        // creator path - NEW FLOW: use 'start' as default, handle legacy steps
        const isOnboardingDone = user.onboardingStep === 'done';
        if (isOnboardingDone) {
          nextRedirect = '/dashboard';
        } else {
          // ✅ NEW FLOW: Default to 'start', but allow legacy steps for backward compatibility
          const raw = String((user as any).onboardingStep || '');
          const newFlowSteps = ['start', 'upload', 'preview', 'complete'];
          const step = newFlowSteps.includes(raw) ? raw : 'start';
          nextRedirect = `/onboarding/${step}`;
        }
      }
    }

  res.json({
    message: 'Login successful',
    redirect: nextRedirect,
    token: accessToken,
    user: {
      id: user.id,
      email: user.email,
      handle: user.handle,
      name: user.name
    }
  });
  } catch (error) {
    logger.error('Login error:', error);
    
    // Handle Zod validation errors with proper messages
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: error.errors[0]?.message || 'Validation failed',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        details: error.errors
      });
    }
    
    // Handle other errors
    handleErrorWithResponse(error, res, 'Failed to login. Please try again.');
  }
};

export const loginVerify = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code } = loginVerifySchema.parse(req.body);
    
    // Find valid OTP
    const otpRecord = await otpQueries.findByEmail(email.toLowerCase(), 'login');
    
    if (!otpRecord) {
      return res.status(400).json({
        error: 'Invalid or expired OTP',
        errorCode: 'INVALID_OTP'
      });
    }
    
    // ✅ Check if OTP is expired (robust Date parsing with timezone support)
    const nowMs = Date.now();
    const expiresAtMs = otpRecord.expiresAt instanceof Date
      ? otpRecord.expiresAt.getTime()
      : new Date(String(otpRecord.expiresAt)).getTime();
    
    // If expiresAt is invalid -> treat as expired (and log)
    if (!Number.isFinite(expiresAtMs) || expiresAtMs < nowMs) {
      logger.warn(`OTP expired for ${email}. ExpiresAt: ${otpRecord.expiresAt}, Now: ${new Date(nowMs).toISOString()}, ExpiresAtMs: ${expiresAtMs}, NowMs: ${nowMs}`);
      return res.status(400).json({
        error: 'OTP has expired. Please request a new one.',
        errorCode: 'OTP_EXPIRED'
      });
    }
    
    // ✅ Check if OTP is already used
    if (otpRecord.used) {
      logger.warn(`OTP already used for ${email}`);
      return res.status(400).json({
        error: 'This OTP has already been used. Please request a new one.',
        errorCode: 'OTP_ALREADY_USED'
      });
    }
    
    // Verify OTP
    const isValid = await verifyOTP(code, otpRecord.codeHash);
    if (!isValid) {
      return res.status(400).json({
        error: 'Invalid OTP code',
        errorCode: 'INVALID_OTP'
      });
    }
    
    // Mark OTP as used
    await otpQueries.markAsUsed(otpRecord.id);
    
    // ✅ FIX: Find user - DO NOT CREATE IF NOT FOUND (security fix)
    let user = await userQueries.findByEmail(email.toLowerCase());
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found. Please signup first.',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    if (user.deletedAt || user.deletionScheduledAt) {
      return res.status(403).json({
        error: 'Account deletion requested. Login is disabled.',
        errorCode: 'ACCOUNT_DELETION_REQUESTED',
      });
    }
    
    // Check if user is active
    if (!user.active) {
      return res.status(403).json({
        error: 'Account not activated. Please complete signup first.',
        errorCode: 'ACCOUNT_NOT_VERIFIED'
      });
    }
    
    // ✅ NEW: Generate access + refresh tokens
    const { generateAccessToken, generateRefreshToken } = await import('../../services/jwtService');
    
    // Create auth session first to get sessionId
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.connection.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const accessTokenMaxAge = 15 * 60 * 1000; // 15 minutes
    const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const expiresAt = new Date(Date.now() + accessTokenMaxAge);
    const refreshToken = generateRefreshToken();
    
    // Create session to get sessionId
    const sessionId = await createOrUpdateAuthSession({
      userId: user.id,
      deviceInfo: userAgent,
      ipAddress,
      userAgent,
      expiresAt,
      refreshToken,
      refreshTokenExpiresAt,
    });
    
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      handle: user.handle || '',
      sessionId: sessionId
    });
    // Set access token in cookie
    res.cookie('jwtToken', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: cookieSameSite,
      maxAge: accessTokenMaxAge,
      path: '/'
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: cookieSameSite,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    
    // Also create session for backward compatibility
    req.session!.userId = user.id;
    req.session!.userEmail = user.email;
    req.session!.userHandle = user.handle;

    // ✅ Log login event in background (non-blocking)
    EventLogger.logLogin(user.id, {
      source: 'direct'
    }).catch((eventError) => {
      logger.warn({ err: eventError }, 'Failed to log login event');
    });

    // Get redirect URL
    let nextRedirect: string;

    // ✅ STEP 1: Check if profile is completed first (mandatory)
    if (!user.profileCompleted) {
      nextRedirect = `/signup/profile?email=${encodeURIComponent(user.email)}`;
    }
    // ✅ STEP 2: Profile done, check userType and onboarding status
    else {
      const userType = (user as any).userType;

      if (!userType) {
        nextRedirect = '/choose-type';
      } else if (userType === 'visitor') {
        nextRedirect = '/explore';
      } else {
        // creator path - NEW FLOW: use 'start' as default, handle legacy steps
        const isOnboardingDone = user.onboardingStep === 'done';
        if (isOnboardingDone) {
          nextRedirect = '/dashboard';
        } else {
          // ✅ NEW FLOW: Default to 'start', but allow legacy steps for backward compatibility
          const raw = String((user as any).onboardingStep || '');
          const newFlowSteps = ['start', 'upload', 'preview', 'complete'];
          const step = newFlowSteps.includes(raw) ? raw : 'start';
          nextRedirect = `/onboarding/${step}`;
        }
      }
    }

  res.json({
    message: 'Login successful',
    redirect: nextRedirect,
    token: accessToken,
    user: {
      id: user.id,
      email: user.email,
      handle: user.handle,
      name: user.name
    }
  });
  } catch (error) {
    logger.error({ err: error }, 'Login verify error');
    
    // Handle Zod validation errors with proper messages
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: error.errors[0]?.message || 'Validation failed',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        details: error.errors
      });
    }
    
    // Handle other errors
    handleErrorWithResponse(error, res, 'Failed to verify login. Please try again.');
  }
};

const changePasswordSchema = z.object({
  // ✅ currentPassword: NO length validation - just check if it's not empty
  // Wrong password will be caught by verifyPassword() check below
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .refine((p) => !/\s/.test(p), 'Password must not contain spaces'),  
});

export const changePassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    
    // Check if user is logged in
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        errorCode: ErrorCodes.UNAUTHORIZED
      });
    }
    
    // Find user
    const user = await userQueries.findByEmail(req.user.email);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        errorCode: ErrorCodes.USER_NOT_FOUND
      });
    }
    
    // ✅ OAuth-only users cannot change password (they don't have one)
    if (!user.passwordHash) {
      return res.status(400).json({
        error: 'This account uses Google login and does not have a password. To set a password, please use the "Set Password" option.',
        errorCode: 'OAUTH_ONLY_ACCOUNT',
        suggestSetPassword: true
      });
    }
    
    // Verify current password
    const isValidPassword = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      return res.status(400).json({
        error: 'Current password is incorrect',
        errorCode: ErrorCodes.VALIDATION_ERROR
      });
    }
    
    // Check if new password is same as current password
    const isSamePassword = await verifyPassword(newPassword, user.passwordHash);
    if (isSamePassword) {
      return res.status(400).json({
        error: 'New password must be different from current password',
        errorCode: ErrorCodes.VALIDATION_ERROR
      });
    }
    
    // Hash new password
    const passwordHash = await hashPassword(newPassword);
    
    // Update password
    await userQueries.updatePassword(user.email, passwordHash);
    
    logger.info(`Password changed for user: ${user.email}`);
    
    return res.json({ 
      success: true,
      message: 'Password changed successfully' 
    });
  } catch (error) {
    logger.error({ err: error }, 'Change password error');
    
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: error.errors[0]?.message || 'Validation failed',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        details: error.errors
      });
    }
    
    // Handle other errors
    handleErrorWithResponse(error, res, 'Failed to change password. Please try again.');
  }
};

const setPasswordSchema = z.object({
  otpCode: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must contain only numbers'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .refine((p) => !/\s/.test(p), 'Password must not contain spaces'),
});

/**
 * Request OTP for setting password (Google-only users)
 * POST /api/auth/set-password/request-otp
 */
export const requestSetPasswordOTP = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        errorCode: ErrorCodes.UNAUTHORIZED
      });
    }

    const user = await userQueries.findByEmail(req.user.email);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        errorCode: ErrorCodes.USER_NOT_FOUND
      });
    }

    // Only allow OTP request for users without password (Google-only)
    if (user.passwordHash) {
      return res.status(400).json({
        error: 'You already have a password. Use "Change Password" instead.',
        errorCode: ErrorCodes.VALIDATION_ERROR
      });
    }

    // Delete old OTP
    await otpQueries.deleteByEmail(user.email.toLowerCase(), 'set_password');
    
    // Generate new OTP
    const otp = generateOTP(config.otp.codeLength);
    const hashedOTP = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + config.otp.expiryMinutes * 60 * 1000);
    
    // Store OTP
    await otpQueries.create(user.email.toLowerCase(), hashedOTP, expiresAt, 'set_password');
    
    logger.info(`Set password OTP created for ${user.email}`);
    
    // Send OTP via email
    const emailSent = await emailService.sendOTP(user.email, otp, 'set_password');
    
    if (isProd) {
      if (!emailSent) {
        logger.error(`Email send failed for ${user.email} in production`);
        return res.status(500).json({
          error: 'Failed to send verification email. Please check your email configuration or try again later.',
          errorCode: 'EMAIL_SEND_FAILED',
        });
      }
    } else {
      logger.info(`Development mode: Set password OTP ${otp} generated (not sent via email)`);
    }
    
    res.json({ 
      success: true,
      message: 'OTP sent to your email'
    });
  } catch (error: any) {
    logger.error('Request set password OTP error:', error);
    
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        errorCode: error.errorCode || ErrorCodes.INTERNAL_ERROR
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to send set password OTP. Please try again.',
      errorCode: ErrorCodes.INTERNAL_ERROR
    });
  }
};

/**
 * Set password for Google-only users (after OTP verification)
 * POST /api/auth/set-password
 */
export const setPassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        errorCode: ErrorCodes.UNAUTHORIZED
      });
    }

    const { otpCode, newPassword } = setPasswordSchema.parse(req.body);

    const user = await userQueries.findByEmail(req.user.email);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        errorCode: ErrorCodes.USER_NOT_FOUND
      });
    }

    // Only allow setting password for users without password
    if (user.passwordHash) {
      return res.status(400).json({
        error: 'You already have a password. Use "Change Password" instead.',
        errorCode: ErrorCodes.VALIDATION_ERROR
      });
    }

    // Find valid OTP
    const otpRecord = await otpQueries.findByEmail(user.email.toLowerCase(), 'set_password');
    
    if (!otpRecord) {
      return res.status(400).json({
        error: 'No OTP found. Please request a new OTP code.',
        errorCode: 'INVALID_OTP'
      });
    }

    // ✅ Check if OTP is expired (robust Date parsing with timezone support)
    const nowMs = Date.now();
    const expiresAtMs = otpRecord.expiresAt instanceof Date
      ? otpRecord.expiresAt.getTime()
      : new Date(String(otpRecord.expiresAt)).getTime();
    
    // If expiresAt is invalid -> treat as expired
    if (!Number.isFinite(expiresAtMs) || expiresAtMs < nowMs) {
      return res.status(400).json({
        error: 'OTP has expired. Please request a new one.',
        errorCode: 'OTP_EXPIRED'
      });
    }

    // Check if OTP is already used
    if (otpRecord.used) {
      return res.status(400).json({
        error: 'This OTP has already been used. Please request a new one.',
        errorCode: 'OTP_ALREADY_USED'
      });
    }

    // Verify OTP
    const isValid = await verifyOTP(otpCode, otpRecord.codeHash);
    if (!isValid) {
      return res.status(400).json({
        error: 'Invalid OTP code',
        errorCode: 'INVALID_OTP'
      });
    }

    // Mark OTP as used
    await otpQueries.markAsUsed(otpRecord.id);

    // Hash new password
    const passwordHash = await hashPassword(newPassword);
    
    // Update password
    await userQueries.updatePassword(user.email, passwordHash);
    
    // Delete OTP after successful password set
    await otpQueries.deleteByEmail(user.email.toLowerCase(), 'set_password');
    
    logger.info(`Password set for Google-only user: ${user.email}`);
    
    return res.json({ 
      success: true,
      message: 'Password set successfully' 
    });
  } catch (error: any) {
    logger.error('Set password error:', error);
    
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: error.errors[0]?.message || 'Validation failed',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        details: error.errors
      });
    }
    
    // Handle other errors
    handleErrorWithResponse(error, res, 'Failed to set password. Please try again.');
  }
};

export const me = async (req: Request, res: Response) => {
  if (!req.user?.email) {
    return res.status(401).json({ error: 'Authentication required', errorCode: 'UNAUTHORIZED' });
  }

  const user = await userQueries.findByEmail(String(req.user.email).toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Authentication required', errorCode: 'UNAUTHORIZED' });
  }

  const isAdmin = ADMIN_EMAILS.includes(String(user.email).toLowerCase());

  return res.json({
    success: true,
    user: {
      id: user.id,
      publicId: tokenizeId(user.id, 'user'),
      email: user.email,
      handle: user.handle,
      name: user.name,
      bio: user.bio,
      dob: user.dob,
      phone: user.phone,
      profileImage: user.profileImage,
      profileCompleted: user.profileCompleted,
      active: user.active,
      onboardingStep: (user as any).onboardingStep,
      onboardingCompleted: (user as any).onboardingCompleted,
      userType: (user as any).userType || null,
      isAdmin,
      hasPassword: Boolean(user.passwordHash),
      hasGoogle: Boolean(user.googleId),
      timeZone: (user as any).timeZone || null,
      planTier: (user as any).planTier || 'free',
      trialEndsAt: (user as any).trialEndsAt || null,
    },
  });
};

const setUserTypeSchema = z.object({
  userType: z.enum(['creator', 'visitor']),
});

export const setUserType = async (req: any, res: Response) => {
  const viewerUserId = req.user?.id || req.user?.userId;
  if (!viewerUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { userType } = setUserTypeSchema.parse(req.body);

  // Load current type (enforce one-way upgrade)
  const cur = await db.query(`SELECT "userType" FROM "User" WHERE id=$1 LIMIT 1`, [viewerUserId]);
  const currentType = (cur.rows[0]?.userType || null) as null | 'creator' | 'visitor';

  // ✅ No downgrade allowed
  if (currentType === 'creator' && userType === 'visitor') {
    return res.status(400).json({ error: 'Creators cannot downgrade to visitor.' });
  }

  // ✅ Visitor -> Creator upgrade should restart onboarding (NEW FLOW: 'start' not 'quiz')
  const r = await db.query(
    `
    UPDATE "User"
    SET
      "userType" = $1,
      "onboardingStep" = CASE WHEN $1 = 'creator' THEN 'start' ELSE "onboardingStep" END,
      "onboardingCompleted" = CASE WHEN $1 = 'creator' THEN false ELSE "onboardingCompleted" END,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING "userType", "onboardingStep", "onboardingCompleted"
    `,
    [userType, viewerUserId]
  );

  return res.json({
    success: true,
    userType: r.rows[0]?.userType || userType,
    onboardingStep: r.rows[0]?.onboardingStep,
    onboardingCompleted: r.rows[0]?.onboardingCompleted,
  });
};

export const logout = async (req: any, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.['jwtToken'];
    let decoded: any = null;

    if (token) {
      try {
        decoded = verifyJWT(token);
      } catch {
        decoded = null;
      }
    }

    const userId = decoded?.userId || req.session?.userId || null;
    const sessionId = decoded?.sessionId || null;

    // ✅ Revoke current auth_session (so "active sessions" stays correct)
    if (userId && sessionId) {
      revokeAuthSession(sessionId, userId).catch(() => {});
    }

    // Log logout event (if userId available)
    if (userId) {
      EventLogger.logUserEvent(userId, EVENT_TYPES.LOGOUT, {}).catch((eventError) => {
        logger.warn('Failed to log logout event:', eventError);
      });
    }

   // Clear JWT cookie
   // ✅ Must match the attributes used when setting the cookie (sameSite/secure),
   // otherwise the browser won't recognize it as the same cookie and won't clear it.
   res.clearCookie('jwtToken', {
    httpOnly: true,
    secure: isProd,
    sameSite: cookieSameSite,
    path: '/'
  });

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: isProd,
    sameSite: cookieSameSite,
    path: '/',
  });
    
    // Also clear session if it exists (for backward compatibility)
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          logger.error('Session destruction error:', err);
        }
      });
    }
    
    res.json({ message: 'Logged out successfully', redirect: '/auth' });
  } catch (error) {
    logger.error('Failed to logout:', error);
    return next(error);
  }
};

// ✅ ADD: Resend OTP Schema
const resendOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  type: z.enum(['signup', 'login', 'forgot']).optional()
});

// ✅ ADD: Resend OTP Function
export const resendOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, type = 'signup' } = resendOtpSchema.parse(req.body);
    
    logger.info(`Resend OTP request for: ${email}, type: ${type}`);
    
    // Check if user exists (for signup/login)
    if (type === 'signup' || type === 'login') {
      const user = await userQueries.findByEmail(email.toLowerCase());
      
      if (type === 'signup') {
        // For signup: user should exist but not verified
        if (!user) {
          return res.status(404).json({
            error: 'No signup request found for this email. Please signup first.',
            errorCode: 'NO_SIGNUP_REQUEST'
          });
        }
        if (user.active) {
          return res.status(409).json({
            error: 'Account already verified. Please login instead.',
            errorCode: 'ALREADY_VERIFIED'
          });
        }
      } else if (type === 'login') {
        // For login: user should exist
        if (!user) {
          return res.status(404).json({
            error: 'User not found. Please signup first.',
            errorCode: 'USER_NOT_FOUND'
          });
        }
      }
    } else if (type === 'forgot') {
      // For forgot password: user must exist
      const user = await userQueries.findByEmail(email.toLowerCase());
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          errorCode: 'USER_NOT_FOUND'
        });
      }
    }
    
    // Delete old OTP
    await otpQueries.deleteByEmail(email.toLowerCase(), type);
    
    // Generate new OTP
    const otp = generateOTP(config.otp.codeLength);
    const hashedOTP = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + config.otp.expiryMinutes * 60 * 1000);
    
    // Store OTP
    await otpQueries.create(email.toLowerCase(), hashedOTP, expiresAt, type);
    
    logger.info(`OTP created for ${email}`);
    
    // ✅ Send OTP via email (only in production)
    const emailSent = await emailService.sendOTP(email, otp, type);
    
    if (isProd) {
      if (!emailSent) {
        logger.error(`Email send failed for ${email} in production`);
        return res.status(500).json({
          error: 'Failed to send verification email. Please check your email configuration or try again later.',
          errorCode: 'EMAIL_SEND_FAILED',
        });
      }
    } else {
      logger.info(`Development mode: OTP ${otp} generated (not sent via email)`);
    }
    
    res.json({ 
      message: 'OTP sent to your email'
    });
  } catch (error) {
    logger.error('Resend OTP error:', error);
    
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: error.errors[0]?.message || 'Validation failed',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        details: error.errors
      });
    }
    
    handleErrorWithResponse(error, res, 'Failed to resend OTP. Please try again.');
  }
};
