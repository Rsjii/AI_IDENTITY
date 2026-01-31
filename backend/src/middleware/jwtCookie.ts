import { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '../services/jwtService';
import { logger } from '../config/logger';
import { isProd } from '../config/env';

export const extractJWTFromCookie = (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokenFromCookie = req.cookies?.['jwtToken'];

    if (tokenFromCookie) {
      try {
        const decoded = verifyJWT(tokenFromCookie);
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          handle: decoded.handle,
          id: decoded.userId,
        };

        if (!req.user.email) {
          logger.warn({ decoded }, 'JWT decoded but email missing');
          req.user = undefined;
        }
      } catch (error) {
        logger.warn({ err: error }, 'Invalid JWT token in cookie');
        res.clearCookie('jwtToken', {
          httpOnly: true,
          secure: isProd,
          sameSite: 'lax',
          path: '/',
        });
      }
    }

    next();
  } catch (error) {
    logger.error({ err: error }, 'JWT cookie extraction error');
    next();
  }
};

export const requireJWTFromCookie = async (req: Request, res: Response, next: NextFunction) => {
  const isApiRequest = req.originalUrl.startsWith('/api/');
  try {
    const tokenFromCookie = req.cookies?.['jwtToken'];

    if (!tokenFromCookie) {
      if (isApiRequest) {
        return res.status(401).json({ error: 'Authentication required', errorCode: 'UNAUTHORIZED' });
      }
      return res.redirect('/auth');
    }

    try {
      const decoded = verifyJWT(tokenFromCookie);
      
      // ✅ NEW: Update session activity (non-blocking)
      if (decoded.sessionId) {
        try {
          const { updateAuthSessionActivity } = await import('../services/authSessionService');
          updateAuthSessionActivity(decoded.sessionId).catch((err) => {
            logger.warn('Failed to update session activity:', err);
          });
        } catch (sessionError) {
          // Non-blocking - don't fail request if activity update fails
          logger.warn('Session activity update failed:', sessionError);
        }
      }
      
      // ✅ NEW: Check if current session is revoked
      if (decoded.sessionId) {
        try {
          const { db } = await import('../config/database');
          const sessionCheck = await db.query(
            `SELECT "revokedAt" FROM "auth_sessions"
             WHERE id = $1 AND "userId" = $2`,
            [decoded.sessionId, decoded.userId]
          );
          const isRevoked = sessionCheck.rows[0]?.revokedAt !== null;
          
          if (isRevoked) {
            logger.warn({ userId: decoded.userId, sessionId: decoded.sessionId }, 'Session revoked');
            res.clearCookie('jwtToken', {
              httpOnly: true,
              secure: isProd,
              sameSite: 'lax',
              path: '/',
            });
            if (isApiRequest) {
              return res.status(401).json({ error: 'Session expired or revoked', errorCode: 'SESSION_REVOKED' });
            }
            return res.redirect('/auth');
          }
        } catch (sessionError) {
          // If session check fails, log but don't block the request
          logger.warn('Session revocation check failed, allowing request:', sessionError);
        }
      }

      // ✅ NEW: Auto-refresh if token expires in < 5 minutes (non-blocking)
      const expiresIn = decoded.exp ? (decoded.exp * 1000 - Date.now()) : 0;
      if (expiresIn > 0 && expiresIn < 5 * 60 * 1000) {
        // Token expires soon - trigger background refresh (don't block request)
        setImmediate(async () => {
          try {
            const { db } = await import('../config/database');
            const { generateAccessToken, generateRefreshToken: genRefreshToken } = await import('../services/jwtService');
            const { rotateRefreshToken } = await import('../services/authSessionService');
            
            // Find active session with refresh token
            const result = await db.query(
              `SELECT * FROM "auth_sessions"
               WHERE "userId" = $1
                 AND "revokedAt" IS NULL
                 AND "refreshTokenExpiresAt" > NOW()
               ORDER BY "lastActiveAt" DESC
               LIMIT 1`,
              [decoded.userId]
            );

            if (result.rows[0]?.refreshToken) {
              const session = result.rows[0];
              // Generate new access token
              const newAccessToken = generateAccessToken({
                userId: decoded.userId,
                email: decoded.email,
                handle: decoded.handle || ''
              });

              // Rotate refresh token
              const newRefreshToken = genRefreshToken();
              const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              await rotateRefreshToken(session.id, newRefreshToken, refreshTokenExpiresAt);

              logger.debug('Token auto-refreshed in background');
            }
          } catch (refreshError) {
            logger.warn('Auto-refresh failed:', refreshError);
          }
        });
      }

      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        handle: decoded.handle,
        id: decoded.userId,
        sessionId: decoded.sessionId, // ✅ Add sessionId for session management
      };
      return next();
    } catch (error) {
      logger.warn({ err: error }, 'Invalid JWT token in cookie');
      res.clearCookie('jwtToken', {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
      });

      if (isApiRequest) {
        return res.status(401).json({ error: 'Invalid token', errorCode: 'INVALID_TOKEN' });
      }
      return res.redirect('/auth');
    }
  } catch (error) {
    logger.error({ err: error }, 'JWT cookie verification error');
    if (isApiRequest) {
      return res.status(401).json({ error: 'Authentication required', errorCode: 'UNAUTHORIZED' });
    }
    return res.redirect('/auth');
  }
};
