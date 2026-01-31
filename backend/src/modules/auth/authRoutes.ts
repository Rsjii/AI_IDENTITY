import { Router } from 'express';
import { signup, signupVerify, completeProfile, login, loginVerify, forgotPassword, forgotPasswordVerify, resetPassword, logout, changePassword, resendOTP, requestSetPasswordOTP, setPassword, me } from './authController';
import {
    otpRequestRateLimit,
    loginRateLimit,
    otpVerifyRateLimit,
    resetPasswordRateLimit,
    changePasswordRateLimit,
  } from '../../middleware/rateLimit';
import { validateCSRF } from '../../middleware/csrf';
import { sanitizeInput } from '../../middleware/validation';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';

const router = Router();

// ❌ REMOVED: router.use(generateCSRFToken);
// Token generation happens on page routes (authPageRoutes.ts), not API routes

// Signup routes
router.post('/signup', sanitizeInput, otpRequestRateLimit, signup);
router.post('/signup/verify', sanitizeInput, validateCSRF, otpVerifyRateLimit, signupVerify);
router.post('/signup/profile', sanitizeInput, validateCSRF, completeProfile);

// Login routes
router.post('/login', sanitizeInput, validateCSRF, loginRateLimit, login);
router.post('/login/verify', sanitizeInput, validateCSRF, otpVerifyRateLimit, loginVerify);

// Password reset routes
router.post('/forgot-password', sanitizeInput, otpRequestRateLimit, forgotPassword);
router.post('/forgot-password/verify', sanitizeInput, validateCSRF, otpVerifyRateLimit, forgotPasswordVerify);
router.post('/reset-password', sanitizeInput, validateCSRF, resetPasswordRateLimit, resetPassword);

// Change password route (requires authentication)
router.post('/change-password', requireJWTFromCookie, sanitizeInput, validateCSRF, changePasswordRateLimit, changePassword);

// Set password routes (for Google-only users)
router.post('/set-password/request-otp', requireJWTFromCookie, sanitizeInput, validateCSRF, otpRequestRateLimit, requestSetPasswordOTP);
router.post('/set-password', requireJWTFromCookie, sanitizeInput, validateCSRF, otpVerifyRateLimit, setPassword);

// Get current user
router.get('/me', requireJWTFromCookie, me);

// Logout
router.post('/logout', logout);

// Refresh token endpoint
router.post('/refresh', sanitizeInput, async (req, res) => {
  const refreshToken = req.cookies?.['refreshToken'];
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token missing', errorCode: 'REFRESH_TOKEN_MISSING' });
  }

  try {
    const { getSessionByRefreshToken, rotateRefreshToken } = await import('../../services/authSessionService');
    const { generateAccessToken, generateRefreshToken: genRefreshToken } = await import('../../services/jwtService');
    const { userQueries } = await import('../../config/database');
    const { isProd } = await import('../../config/env');

    const session = await getSessionByRefreshToken(refreshToken);
    if (!session) {
      // Invalid/expired refresh token => clear cookies
      res.clearCookie('jwtToken', { httpOnly: true, secure: isProd, sameSite: 'none', path: '/' });
      res.clearCookie('refreshToken', { httpOnly: true, secure: isProd, sameSite: 'none', path: '/' });
      return res.status(401).json({ error: 'Invalid or expired refresh token', errorCode: 'INVALID_REFRESH_TOKEN' });
    }

    const user = await userQueries.findById(session.userId);
    if (!user || !user.active) {
      res.clearCookie('jwtToken', { httpOnly: true, secure: isProd, sameSite: 'none', path: '/' });
      res.clearCookie('refreshToken', { httpOnly: true, secure: isProd, sameSite: 'none', path: '/' });
      return res.status(401).json({ error: 'User not found or inactive', errorCode: 'UNAUTHORIZED' });
    }

    // New access token
    const accessTokenMaxAge = 15 * 60 * 1000;
    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      handle: user.handle || '',
      sessionId: session.id,
    });

    // Rotate refresh token + set new cookie
    const newRefreshToken = genRefreshToken();
    const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await rotateRefreshToken(session.id, newRefreshToken, refreshTokenExpiresAt);

    res.cookie('jwtToken', newAccessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'none',
      maxAge: accessTokenMaxAge,
      path: '/',
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Refresh token error:', error);
    return res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Resend OTP
router.post('/resend-otp', sanitizeInput, otpRequestRateLimit, resendOTP);

// Check email availability (for real-time validation)
router.get('/check-email', async (req, res) => {
  try {
    const email = req.query.email as string;
    if (!email) return res.status(400).json({ error: 'Email required' });
    
    const { userQueries } = await import('../../config/database');
    const user = await userQueries.findByEmail(email.toLowerCase());
    return res.json({ exists: !!user && user.active });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to check email' });
  }
});

export default router;
