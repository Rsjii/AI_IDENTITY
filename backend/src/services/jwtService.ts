import jwt from 'jsonwebtoken';
import { logger } from '../config/logger';

// ✅ SECURITY: Fail in production if JWT_SECRET is missing
// Only fail if APP_ENV is explicitly set to 'prod' (not just NODE_ENV=production)
const JWT_SECRET = process.env.JWT_SECRET;
const APP_ENV_EXPLICIT = process.env.APP_ENV;
const isProduction = APP_ENV_EXPLICIT === 'prod';

if (!JWT_SECRET) {
  if (isProduction) {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
}
const JWT_SECRET_FINAL = JWT_SECRET || 'dev-fallback-secret-change-me';
const JWT_EXPIRES_IN = '7d'; // Legacy - will be replaced with short-lived tokens
const JWT_ACCESS_TOKEN_EXPIRES_IN = '15m'; // Short-lived access token
const JWT_REFRESH_TOKEN_EXPIRES_IN = '30d'; // Long-lived refresh token

// Refresh token secret (should be different from access token secret)
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET_FINAL + '-refresh';

export interface JWTPayload {
  userId: string;
  email: string;
  handle: string;
  sessionId?: string; // ✅ Add sessionId for session tracking
  id?: string; // Added for compatibility with middleware
  iat?: number;
  exp?: number;
}

export const generateJWT = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  try {
    const token = jwt.sign(payload, JWT_SECRET_FINAL, { 
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'ai-twin-app'
    });
    logger.debug(`JWT generated for user: ${payload.email}`);
    return token;
  } catch (error) {
    logger.error('JWT generation error:', error);
    throw new Error('Failed to generate JWT token');
  }
};

export const verifyJWT = (token: string): JWTPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET_FINAL) as JWTPayload;
    logger.debug(`JWT verified for user: ${decoded.email}`);
    return decoded;
  } catch (error) {
    logger.error('JWT verification error:', error);
    throw new Error('Invalid or expired JWT token');
  }
};

export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
};

/**
 * Generate short-lived access token (15 minutes)
 * ✅ Now includes sessionId for session tracking
 */
export const generateAccessToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  try {
    const token = jwt.sign(payload, JWT_SECRET_FINAL, { 
      expiresIn: JWT_ACCESS_TOKEN_EXPIRES_IN,
      issuer: 'ai-twin-app'
    });
    logger.debug(`Access token generated for user: ${payload.email}, sessionId: ${payload.sessionId || 'none'}`);
    return token;
  } catch (error) {
    logger.error('Access token generation error:', error);
    throw new Error('Failed to generate access token');
  }
};

/**
 * Generate refresh token (30 days) - stored in DB, not in JWT
 */
export const generateRefreshToken = (): string => {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Verify refresh token (checks if it exists in DB and is valid)
 */
export const verifyRefreshToken = async (refreshToken: string, userId: string): Promise<boolean> => {
  try {
    const { db } = await import('../config/database');
    const result = await db.query(
      `SELECT id FROM "auth_sessions"
       WHERE "refreshToken" = $1 
         AND "userId" = $2
         AND "revokedAt" IS NULL
         AND "refreshTokenExpiresAt" > NOW()`,
      [refreshToken, userId]
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Refresh token verification error:', error);
    return false;
  }
};
