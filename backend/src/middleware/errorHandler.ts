import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCodes } from '../utils/errors';
import { logger } from '../config/logger';
import { EventLogger } from '../services/eventLogger';
import { EVENT_TYPES } from '../config/constants';
import { isProd, config } from '../config/env';
import { logError } from '../modules/admin/adminDao';

/**
 * Async wrapper utility to catch errors from async route handlers
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const errorHandlerMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  const isApiRequest = req.originalUrl.startsWith('/api/');
  const requestId = req.requestId || null;

  if (err instanceof AppError) {
    // ✅ Enhanced logging with structured context
    const userId = req.user?.userId || req.user?.id || null;
    
    // ✅ ENHANCED: Log AppError with full context
    logger.warn({
      err: err,
      errorCode: err.errorCode,
      statusCode: err.statusCode,
      message: err.message,
      path: req.path,
      method: req.method,
      userId,
      requestId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      ...(err.details && { details: err.details }), // ✅ Always log details (not exposed to user)
    }, '⚠️ APP_ERROR caught:');

    // ✅ A1: Log to database error_logs table
    try {
      const severity = err.statusCode >= 500 ? 'critical' : err.statusCode >= 400 ? 'error' : 'warning';
      logError({
        message: err.message,
        stack: err.stack,
        source: 'backend',
        severity,
        userId: userId || undefined,
        meta: {
          errorCode: err.errorCode,
          statusCode: err.statusCode,
          path: req.path,
          method: req.method,
          requestId,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          ...(err.details && { details: err.details }),
        },
      }).catch(() => {
        // Silently fail if DB logging fails
      });
    } catch {
      // swallow logging errors
    }

    // ✅ Event logging - include details for debugging
    try {
      const meta = {
        path: req.path,
        method: req.method,
        statusCode: err.statusCode,
        errorCode: err.errorCode,
        requestId,
        ...(err.details && { details: err.details }), // ✅ Add details to event log
      };

      if (userId) {
        EventLogger.logUserEvent(userId, EVENT_TYPES.API_ERROR, meta).catch(() => {});
      } else {
        EventLogger.logSystemEvent(EVENT_TYPES.API_ERROR, meta).catch(() => {});
      }
    } catch {
      // swallow logging errors
    }

    if (isApiRequest) {
      // ✅ SECURITY: Remove requestId from JSON body, add to header only
      if (requestId) {
        res.setHeader('X-Request-Id', requestId);
      }
      const response: any = {
        error: err.message,
        errorCode: err.errorCode,
      };
      // ✅ Include validation details for frontend error handling
      if (err.details && Array.isArray(err.details)) {
        response.details = err.details.map((detail: any) => ({
          field: detail.path?.join('.') || detail.field || '',
          message: detail.message || 'Invalid value',
        }));
      }
      res.status(err.statusCode).json(response);
      return;
    }

    // ✅ In production, return JSON for non-API requests (React app handles pages)
    if (isProd) {
      if (requestId) {
        res.setHeader('X-Request-Id', requestId);
      }
      res.status(err.statusCode).json({
        error: err.message,
        errorCode: err.errorCode,
        frontend: config.frontendUrl || 'https://selflyx.com'
      });
      return;
    }

    // ✅ Only render views in development
    if (err.statusCode === 404) {
      return res.status(404).render('errors/404', {
        title: 'Page Not Found',
        message: err.message,
        user: req.user || null,
        csrfToken: res.locals.csrfToken || '',
      });
    }

    if (err.statusCode === 403) {
      return res.status(403).render('errors/403', {
        title: 'Access Denied',
        message: err.message,
        user: req.user || null,
        csrfToken: res.locals.csrfToken || '',
      });
    }

    return res.status(err.statusCode).render('errors/error', {
      title: 'Error',
      message: err.message,
      errorCode: err.errorCode,
      user: req.user || null,
      csrfToken: res.locals['csrfToken'] || '',
    });
  }

  // ✅ Enhanced unhandled error logging
  const userId = req.user?.userId || req.user?.id || null;
  
  // ✅ ENHANCED: Log with error object for better formatting
  logger.error({
    err: err,
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId,
    requestId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    body: isProd ? undefined : req.body, // Only in dev
    query: isProd ? undefined : req.query, // Only in dev
  }, '❌ UNHANDLED ERROR - Full stack trace:');

  // ✅ A1: Log to database error_logs table (critical severity for unhandled errors)
  try {
    logError({
      message: err.message || 'Unhandled error',
      stack: err.stack,
      source: 'backend',
      severity: 'critical',
      userId: userId || undefined,
      meta: {
        name: err.name,
        path: req.path,
        method: req.method,
        requestId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        body: isProd ? undefined : req.body,
        query: isProd ? undefined : req.query,
      },
    }).catch(() => {
      // Silently fail if DB logging fails
    });
  } catch {
    // ignore logging failures
  }

  // ✅ Event logging for unhandled errors
  try {
    const meta = {
      path: req.path,
      method: req.method,
      message: err.message,
      name: err.name,
      requestId,
    };

    if (userId) {
      EventLogger.logUserEvent(userId, EVENT_TYPES.ERROR, meta).catch(() => {});
    } else {
      EventLogger.logSystemEvent(EVENT_TYPES.ERROR, meta).catch(() => {});
    }
  } catch {
    // ignore event logging failures
  }

  if (isApiRequest) {
    // ✅ SECURITY: Remove requestId from JSON body, add to header only
    if (requestId) {
      res.setHeader('X-Request-Id', requestId);
    }
    res.status(500).json({
      error: 'Internal server error',
      errorCode: ErrorCodes.INTERNAL_ERROR,
    });
    return;
  }

  // ✅ In production, return JSON for non-API requests
  if (isProd) {
    if (requestId) {
      res.setHeader('X-Request-Id', requestId);
    }
    res.status(500).json({
      error: 'Internal server error',
      errorCode: ErrorCodes.INTERNAL_ERROR,
    });
    return;
  }

  return res.status(500).render('errors/error', {
    title: 'Error',
    message: 'An unexpected error occurred',
    errorCode: ErrorCodes.INTERNAL_ERROR,
    user: req.user || null,
    csrfToken: res.locals['csrfToken'] || '',
  });
};