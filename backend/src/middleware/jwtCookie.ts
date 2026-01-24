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
          sameSite: isProd ? 'lax' : 'strict',
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

export const requireJWTFromCookie = (req: Request, res: Response, next: NextFunction) => {
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
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        handle: decoded.handle,
        id: decoded.userId,
      };
      return next();
    } catch (error) {
      logger.warn({ err: error }, 'Invalid JWT token in cookie');
      res.clearCookie('jwtToken', {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'lax' : 'strict',
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
