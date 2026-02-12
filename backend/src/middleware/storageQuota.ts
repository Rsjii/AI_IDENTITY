/**
 * Storage Quota Enforcement Middleware
 * Checks creator's storage quota before allowing file uploads
 */

import { Request, Response, NextFunction } from 'express';
import db from '../config/db';
import { logger } from '../config/logger';

/**
 * Storage quota middleware
 * - Checks user's plan_storage_mb quota
 * - Warns at 80% usage
 * - Blocks at 100% usage
 * - Allows 10% overage for grace period
 */
export async function checkStorageQuota(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's storage quota and current usage
    const result = await db.query(
      `SELECT
         plan_storage_mb,
         storage_used_mb,
         plan_tier
       FROM "User"
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const storageQuotaMB = user.plan_storage_mb || 100; // Default 100MB
    const storageUsedMB = user.storage_used_mb || 0;
    const planTier = user.plan_tier || 'free';

    // Calculate file size from request (if available)
    let fileSizeMB = 0;
    const file = (req as any).file as Express.Multer.File | undefined;
    if (file) {
      fileSizeMB = file.size / (1024 * 1024); // Convert bytes to MB
    }

    // Calculate percentage used
    const currentPercentage = (storageUsedMB / storageQuotaMB) * 100;
    const projectedUsage = storageUsedMB + fileSizeMB;
    const projectedPercentage = (projectedUsage / storageQuotaMB) * 100;

    // Allow 10% overage for grace period
    const OVERAGE_ALLOWANCE = 1.1;
    const maxAllowedMB = storageQuotaMB * OVERAGE_ALLOWANCE;

    logger.info('Storage quota check', {
      userId,
      planTier,
      storageUsedMB,
      storageQuotaMB,
      fileSizeMB,
      currentPercentage: currentPercentage.toFixed(1),
      projectedPercentage: projectedPercentage.toFixed(1),
    });

    // Hard block at 110% (overage exhausted)
    if (projectedUsage > maxAllowedMB) {
      logger.warn('Storage quota exceeded (hard block)', {
        userId,
        planTier,
        storageUsedMB,
        storageQuotaMB,
        fileSizeMB,
        projectedPercentage: projectedPercentage.toFixed(1),
      });

      // Queue warning notification
      queueStorageWarning(userId, planTier, 'quota_exceeded');

      return res.status(402).json({
        error: 'Storage quota exceeded',
        showPaywall: true,
        storageUsed: storageUsedMB,
        storageQuota: storageQuotaMB,
        percentageUsed: currentPercentage,
        needsUpgrade: true,
        message: `Your storage is full (${currentPercentage.toFixed(0)}% used). Please upgrade your plan to upload more files.`,
      });
    }

    // Soft warning at 100% (still allow with overage)
    if (projectedPercentage >= 100 && projectedPercentage <= 110) {
      logger.warn('Storage quota reached (soft warning)', {
        userId,
        planTier,
        currentPercentage: currentPercentage.toFixed(1),
        projectedPercentage: projectedPercentage.toFixed(1),
      });

      // Queue warning notification
      queueStorageWarning(userId, planTier, 'quota_full');

      // Attach warning to response (middleware will add this to response)
      (req as any).storageWarning = {
        level: 'critical',
        percentageUsed: currentPercentage,
        message: `Storage is ${currentPercentage.toFixed(0)}% full. You're using overage allowance.`,
      };
    }

    // Warning at 80%
    if (currentPercentage >= 80 && currentPercentage < 100) {
      logger.info('Storage quota warning (80%)', {
        userId,
        planTier,
        currentPercentage: currentPercentage.toFixed(1),
      });

      // Queue warning notification (only once)
      queueStorageWarning(userId, planTier, 'quota_80');

      (req as any).storageWarning = {
        level: 'warning',
        percentageUsed: currentPercentage,
        message: `Storage is ${currentPercentage.toFixed(0)}% full. Consider upgrading soon.`,
      };
    }

    // Allow upload
    next();
  } catch (error) {
    logger.error('Storage quota check error:', error);
    // Don't block on error, allow upload
    next();
  }
}

/**
 * Update storage usage after successful file upload
 * Call this after file is saved to S3 or disk
 */
export async function updateStorageUsage(
  userId: string,
  fileSizeBytes: number
): Promise<void> {
  try {
    const fileSizeMB = fileSizeBytes / (1024 * 1024);

    const result = await db.query(
      `UPDATE "User"
       SET storage_used_mb = COALESCE(storage_used_mb, 0) + $1,
           "updatedAt" = NOW()
       WHERE id = $2
       RETURNING storage_used_mb, plan_storage_mb`,
      [fileSizeMB, userId]
    );

    if (result.rows.length > 0) {
      const { storage_used_mb, plan_storage_mb } = result.rows[0];
      logger.info('Storage usage updated', {
        userId,
        fileSizeMB: fileSizeMB.toFixed(2),
        totalUsedMB: storage_used_mb?.toFixed(2),
        quotaMB: plan_storage_mb,
        percentageUsed: ((storage_used_mb / plan_storage_mb) * 100).toFixed(1),
      });
    }
  } catch (error) {
    logger.error('Error updating storage usage:', error);
    // Don't throw - this is non-critical
  }
}

/**
 * Decrease storage usage when file is deleted
 */
export async function decreaseStorageUsage(
  userId: string,
  fileSizeBytes: number
): Promise<void> {
  try {
    const fileSizeMB = fileSizeBytes / (1024 * 1024);

    await db.query(
      `UPDATE "User"
       SET storage_used_mb = GREATEST(COALESCE(storage_used_mb, 0) - $1, 0),
           "updatedAt" = NOW()
       WHERE id = $2`,
      [fileSizeMB, userId]
    );

    logger.info('Storage usage decreased', {
      userId,
      fileSizeMB: fileSizeMB.toFixed(2),
    });
  } catch (error) {
    logger.error('Error decreasing storage usage:', error);
  }
}

/**
 * Get current storage stats for a user
 */
export async function getStorageStats(userId: string): Promise<{
  storageUsedMB: number;
  storageQuotaMB: number;
  percentageUsed: number;
  remainingMB: number;
}> {
  const result = await db.query(
    `SELECT
       COALESCE(storage_used_mb, 0) as storage_used_mb,
       plan_storage_mb,
       plan_tier
     FROM "User"
     WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error('User not found');
  }

  const { storage_used_mb, plan_storage_mb } = result.rows[0];
  const storageUsedMB = parseFloat(storage_used_mb || '0');
  const storageQuotaMB = plan_storage_mb || 100;
  const percentageUsed = (storageUsedMB / storageQuotaMB) * 100;
  const remainingMB = Math.max(0, storageQuotaMB - storageUsedMB);

  return {
    storageUsedMB,
    storageQuotaMB,
    percentageUsed,
    remainingMB,
  };
}

/**
 * Queue storage warning notification
 * This logs the warning and sends email notification
 */
async function queueStorageWarning(
  userId: string,
  planTier: string,
  type: string
): Promise<void> {
  try {
    // Log warning
    logger.info('Storage warning queued', {
      userId,
      planTier,
      type,
      timestamp: new Date().toISOString(),
    });

    // Send email notification
    const { sendStorageWarning, sendStorageFull } = await import('../services/emailService');

    // Get current storage stats
    const stats = await getStorageStats(userId);

    if (type === 'quota_exceeded' || type === 'quota_full') {
      await sendStorageFull(userId, stats.storageQuotaMB);
    } else if (type === 'quota_80') {
      await sendStorageWarning(userId, stats.storageUsedMB, stats.storageQuotaMB);
    }
  } catch (error) {
    logger.error('Error queueing storage warning:', error);
  }
}

export default {
  checkStorageQuota,
  updateStorageUsage,
  decreaseStorageUsage,
  getStorageStats,
};
