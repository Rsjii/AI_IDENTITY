import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../config/logger';
import { AppError } from '../utils/errors';
import { config } from '../config/env';

// ✅ SECURITY: Track session secret hash in session itself to detect changes across restarts
function getSessionSecretHash(): string {
  const secret = config.sessionSecret || '';
  return crypto.createHash('sha256').update(secret).digest('hex').substring(0, 16);
}

// ✅ Generate CSRF token only on GET (HTML pages)
export const generateCSRFToken = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.method !== 'GET') return next();

    if (!req.session) {
      logger.debug('[CSRF] No session available, skipping token generation');
      res.locals.csrfToken = ''; // Set empty token if no session
      return next();
    }

    const currentSecretHash = getSessionSecretHash();
    const sessionSecretHash = (req.session as any).secretHash;

    // ✅ If secret changed (detected via session), invalidate CSRF token
    if (sessionSecretHash && sessionSecretHash !== currentSecretHash) {
      logger.warn('[CSRF] Session secret changed - invalidating CSRF token');
      delete req.session.csrfToken;
      (req.session as any).secretHash = currentSecretHash;
    } else if (!sessionSecretHash) {
      // First time - store current secret hash in session
      (req.session as any).secretHash = currentSecretHash;
    }

    // ✅ Check if existing token is valid
    if (req.session.csrfToken) {
      res.locals.csrfToken = req.session.csrfToken;
      return next();
    }

    // Generate new token
    const newToken = crypto.randomBytes(32).toString('hex');
    req.session.csrfToken = newToken;
    res.locals.csrfToken = newToken;

    // Ensure token persists before render
    req.session.save((err: any) => {
      if (err) {
        logger.error('[CSRF] Error saving session:', err);
        // Don't fail the request, just log and continue with token in res.locals
        return next();
      }
      return next();
    });
  } catch (error: any) {
    logger.error('[CSRF] Error generating token:', {
      error: error.message,
      stack: error.stack,
      path: req.path,
    });
    // Set empty token and continue - don't break the request
    res.locals.csrfToken = '';
    return next();
  }
};

export const validateCSRF = (req: Request, _res: Response, next: NextFunction) => {
  const requestId = req.requestId || null;

  const raw = req.headers['x-csrf-token'];
  const token = Array.isArray(raw) ? raw[0] : raw;
  const sessionToken = req.session?.csrfToken;

  if (!sessionToken) {
    // ✅ No session dump in logs (prod safe)
    logger.warn('CSRF missing in session', { requestId, path: req.path, method: req.method });
    return next(new AppError(403, 'Invalid CSRF token', 'CSRF_MISSING'));
  }

  if (!token || token !== sessionToken) {
    logger.warn('CSRF token mismatch', { requestId, path: req.path, method: req.method });
    return next(new AppError(403, 'Invalid CSRF token', 'CSRF_INVALID'));
  }

  return next();
};

// ✅ Optional CSRF validation - only validates if user is logged in (for anonymous users)
export const validateCSRFOptional = (req: Request, _res: Response, next: NextFunction) => {
  // If no user is logged in, skip CSRF validation (anonymous user)
  if (!req.user) {
    return next();
  }

  // If user is logged in, validate CSRF token
  // But if no session or no token, also skip (might be API call)
  if (!req.session || !req.session.csrfToken) {
    return next();
  }

  // User is logged in and has session token - validate CSRF
  return validateCSRF(req, _res, next);
};