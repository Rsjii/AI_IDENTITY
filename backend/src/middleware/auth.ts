import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    handle?: string;
  };
}

// ✅ REMOVED: requireAuth and optionalAuth functions (unused - app uses JWT cookie auth via requireJWTFromCookie)
// Only AuthenticatedRequest type is kept for TypeScript type safety
