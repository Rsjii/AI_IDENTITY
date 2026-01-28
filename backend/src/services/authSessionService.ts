import { db } from '../config/database';
import { generateId } from '../utils/idGenerator';
import { logger } from '../config/logger';

export interface AuthSessionData {
  userId: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
}

/**
 * Create or update an auth session for a user
 * Returns the session ID
 */
export async function createOrUpdateAuthSession(data: AuthSessionData): Promise<string> {
  try {
    const sessionId = generateId.session();
    const now = new Date();
    
    // Try to find existing active session for this user/device/IP
    const existing = await db.query(
      `SELECT id FROM "auth_sessions"
       WHERE "userId" = $1 
         AND "ipAddress" = $2
         AND "userAgent" = $3
         AND "revokedAt" IS NULL
         AND "expiresAt" > NOW()
       ORDER BY "lastActiveAt" DESC
       LIMIT 1`,
      [data.userId, data.ipAddress || null, data.userAgent || null]
    );

    if (existing.rows.length > 0) {
      // Update existing session
      const existingId = existing.rows[0].id;
      await db.query(
        `UPDATE "auth_sessions"
         SET "lastActiveAt" = NOW(),
             "expiresAt" = $1
         WHERE id = $2`,
        [data.expiresAt, existingId]
      );
      return existingId;
    }

    // Create new session
    await db.query(
      `INSERT INTO "auth_sessions" (id, "userId", "deviceInfo", "ipAddress", "userAgent", "expiresAt", "createdAt", "lastActiveAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [sessionId, data.userId, data.deviceInfo || null, data.ipAddress || null, data.userAgent || null, data.expiresAt, now]
    );

    return sessionId;
  } catch (error) {
    logger.error('Failed to create/update auth session:', error);
    throw error;
  }
}

/**
 * Update last active time for an auth session
 */
export async function updateAuthSessionActivity(sessionId: string): Promise<void> {
  try {
    await db.query(
      `UPDATE "auth_sessions" SET "lastActiveAt" = NOW() WHERE id = $1 AND "revokedAt" IS NULL`,
      [sessionId]
    );
  } catch (error) {
    logger.warn('Failed to update auth session activity:', error);
  }
}

/**
 * Revoke an auth session
 */
export async function revokeAuthSession(sessionId: string, userId: string): Promise<void> {
  try {
    await db.query(
      `UPDATE "auth_sessions" SET "revokedAt" = NOW() WHERE id = $1 AND "userId" = $2`,
      [sessionId, userId]
    );
  } catch (error) {
    logger.error('Failed to revoke auth session:', error);
    throw error;
  }
}

/**
 * Get all active auth sessions for a user
 */
export async function getUserAuthSessions(userId: string): Promise<any[]> {
  try {
    const result = await db.query(
      `SELECT id, "deviceInfo", "ipAddress", "userAgent", "lastActiveAt", "createdAt", "expiresAt"
       FROM "auth_sessions"
       WHERE "userId" = $1 AND "revokedAt" IS NULL AND "expiresAt" > NOW()
       ORDER BY "lastActiveAt" DESC`,
      [userId]
    );
    return result.rows;
  } catch (error) {
    logger.error('Failed to get user auth sessions:', error);
    throw error;
  }
}

/**
 * Clean up expired sessions (can be called by a cron job)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await db.query(
      `DELETE FROM "auth_sessions" WHERE "expiresAt" < NOW() OR "revokedAt" IS NOT NULL`
    );
    return result.rowCount || 0;
  } catch (error) {
    logger.error('Failed to cleanup expired sessions:', error);
    throw error;
  }
}

