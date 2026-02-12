/**
 * Cron Job Service
 * Handles scheduled tasks for token system maintenance
 * - Monthly quota resets (creator plans)
 * - Subscription period rollovers
 * - Cleanup old token usage records
 */

import cron from 'node-cron';
import db from '../config/db';
import { logger } from '../config/logger';

// =====================================================
// CONFIGURATION
// =====================================================

const ENABLE_CRON_JOBS = process.env.ENABLE_CRON_JOBS !== 'false'; // Enabled by default

// =====================================================
// CRON JOB FUNCTIONS
// =====================================================

/**
 * Reset monthly quotas for all creator plans
 * Runs on the 1st day of each month at 00:00 UTC
 */
async function resetCreatorMonthlyQuotas(): Promise<void> {
  try {
    logger.info('Starting creator monthly quota reset...');

    // Get all creators with active plans
    const result = await db.query(
      `SELECT id, email, plan_tier, plan_token_quota, plan_period_start
       FROM "User"
       WHERE plan_tier != 'free'
       AND plan_status = 'active'
       AND plan_period_end < NOW()`
    );

    const creators = result.rows;
    logger.info(`Found ${creators.length} creators to reset`);

    let resetCount = 0;
    let errorCount = 0;

    for (const creator of creators) {
      try {
        // Update creator's billing period
        await db.query(
          `UPDATE "User"
           SET plan_period_start = NOW(),
               plan_period_end = NOW() + INTERVAL '30 days',
               "updatedAt" = NOW()
           WHERE id = $1`,
          [creator.id]
        );

        // Reset aggregates for new period
        await db.query(
          `UPDATE creator_token_aggregates
           SET current_period_start = NOW(),
               current_period_end = NOW() + INTERVAL '30 days',
               tokens_used_this_period = 0,
               updated_at = NOW()
           WHERE creator_id = $1`,
          [creator.id]
        );

        resetCount++;
        logger.info(`Reset quota for creator ${creator.email} (${creator.plan_tier})`);
      } catch (error) {
        errorCount++;
        logger.error(`Failed to reset quota for creator ${creator.id}:`, error);
      }
    }

    logger.info(`Creator quota reset completed: ${resetCount} success, ${errorCount} errors`);
  } catch (error) {
    logger.error('Creator monthly quota reset failed:', error);
  }
}

/**
 * Reset monthly quotas for marketplace subscriptions
 * Runs on the 1st day of each month at 00:10 UTC
 */
async function resetMarketplaceSubscriptions(): Promise<void> {
  try {
    logger.info('Starting marketplace subscription quota reset...');

    const result = await db.query(
      `SELECT
         ms.id,
         ms."userId" as user_id,
         ml."creatorId" as creator_id
       FROM "marketplace_subscriptions" ms
       JOIN "marketplace_listings" ml ON ml.id = ms."listingId"
       WHERE ms."status" IN ('active','trialing')
         AND ms."currentPeriodEnd" IS NOT NULL
         AND ms."currentPeriodEnd" < NOW()`
    );

    const subscriptions = result.rows;
    logger.info(`Found ${subscriptions.length} subscriptions to reset`);

    let resetCount = 0;
    let errorCount = 0;

    for (const sub of subscriptions) {
      try {
        // Reset subscription period
        await db.query(
          `UPDATE "marketplace_subscriptions"
           SET "currentPeriodStart" = NOW(),
               "currentPeriodEnd" = NOW() + INTERVAL '30 days',
               tokens_used_this_period = 0,
               "updatedAt" = NOW()
           WHERE id = $1`,
          [sub.id]
        );

        // Reset user-creator aggregates
        await db.query(
          `UPDATE user_creator_token_aggregates
           SET current_period_start = NOW(),
               current_period_end = NOW() + INTERVAL '30 days',
               tokens_used_this_period = 0,
               updated_at = NOW()
           WHERE user_id = $1 AND creator_id = $2`,
          [sub.user_id, sub.creator_id]
        );

        resetCount++;
      } catch (error) {
        errorCount++;
        logger.error(`Failed to reset subscription ${sub.id}:`, error);
      }
    }

    logger.info(`Subscription quota reset completed: ${resetCount} success, ${errorCount} errors`);
  } catch (error) {
    logger.error('Marketplace subscription reset failed:', error);
  }
}

/**
 * Clean up old token usage records (keep last 90 days)
 * Runs weekly on Sunday at 02:00 UTC
 */
async function cleanupOldTokenUsage(): Promise<void> {
  try {
    logger.info('Starting token usage cleanup...');

    const result = await db.query(
      `DELETE FROM token_usage
       WHERE created_at < NOW() - INTERVAL '90 days'
       RETURNING id`
    );

    const deletedCount = result.rowCount || 0;
    logger.info(`Deleted ${deletedCount} old token usage records`);
  } catch (error) {
    logger.error('Token usage cleanup failed:', error);
  }
}

/**
 * Update creator aggregate statistics
 * Runs daily at 01:00 UTC
 */
async function updateCreatorAggregates(): Promise<void> {
  try {
    logger.info('Starting creator aggregates update...');

    // Get all creators
    const creators = await db.query(
      `SELECT DISTINCT creator_id FROM token_usage WHERE created_at >= NOW() - INTERVAL '1 day'`
    );

    let updateCount = 0;

    for (const { creator_id } of creators.rows) {
      try {
        // Update total tokens all time
        await db.query(
          `UPDATE creator_token_aggregates
           SET total_tokens_all_time = (
                 SELECT COALESCE(SUM(total_tokens), 0)
                 FROM token_usage
                 WHERE creator_id = $1
               ),
               total_conversations_all_time = (
                 SELECT COUNT(DISTINCT session_id)
                 FROM token_usage
                 WHERE creator_id = $1
               ),
               updated_at = NOW()
           WHERE creator_id = $1`,
          [creator_id]
        );

        updateCount++;
      } catch (error) {
        logger.error(`Failed to update aggregates for creator ${creator_id}:`, error);
      }
    }

    logger.info(`Updated aggregates for ${updateCount} creators`);
  } catch (error) {
    logger.error('Creator aggregates update failed:', error);
  }
}

/**
 * Send usage reports to creators (weekly)
 * Runs on Monday at 09:00 UTC
 */
async function sendWeeklyUsageReports(): Promise<void> {
  try {
    logger.info('Starting weekly usage reports...');

    const result = await db.query(
      `SELECT u.id, u.email, u.name, u.plan_tier, u.plan_token_quota,
              cta.tokens_used_this_period, cta.current_period_start, cta.current_period_end
       FROM "User" u
       JOIN creator_token_aggregates cta ON cta.creator_id = u.id
       WHERE u.plan_tier != 'free'
       AND u.plan_status = 'active'`
    );

    logger.info(`Sending reports to ${result.rows.length} creators`);

    for (const creator of result.rows) {
      const percentage = (creator.tokens_used_this_period / creator.plan_token_quota) * 100;

      logger.info(`Creator ${creator.email}: ${percentage.toFixed(1)}% used`, {
        tokensUsed: creator.tokens_used_this_period,
        quota: creator.plan_token_quota,
        tier: creator.plan_tier,
      });

      // TODO: Send actual email report
      // await emailService.sendWeeklyUsageReport(creator);
    }

    logger.info('Weekly usage reports completed');
  } catch (error) {
    logger.error('Weekly usage reports failed:', error);
  }
}

/**
 * Check for expired token packs and cleanup
 * Token packs never expire, but this checks for orphaned records
 * Runs daily at 03:00 UTC
 */
async function cleanupTokenPacks(): Promise<void> {
  try {
    logger.info('Starting token pack cleanup...');

    // Remove token packs with 0 remaining tokens (fully used)
    // Keep them for history, just log stats
    const result = await db.query(
      `SELECT COUNT(*) as count, SUM(tokens_purchased) as total_tokens
       FROM token_packs
       WHERE tokens_remaining = 0`
    );

    const stats = result.rows[0];
    logger.info(`Found ${stats.count} fully used token packs (${stats.total_tokens} total tokens sold)`);

    // Could optionally archive these to a separate table for analytics
  } catch (error) {
    logger.error('Token pack cleanup failed:', error);
  }
}

// =====================================================
// CRON JOB SCHEDULER
// =====================================================

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs(): void {
  if (!ENABLE_CRON_JOBS) {
    logger.warn('Cron jobs disabled via ENABLE_CRON_JOBS=false');
    return;
  }

  logger.info('Initializing cron jobs...');

  // Monthly quota resets - 1st of month at 00:00 UTC
  cron.schedule('0 0 1 * *', () => {
    logger.info('Cron: Monthly creator quota reset triggered');
    resetCreatorMonthlyQuotas().catch((error) =>
      logger.error('Cron: Creator quota reset error:', error)
    );
  });

  // Marketplace subscription resets - 1st of month at 00:10 UTC
  cron.schedule('10 0 1 * *', () => {
    logger.info('Cron: Marketplace subscription reset triggered');
    resetMarketplaceSubscriptions().catch((error) =>
      logger.error('Cron: Subscription reset error:', error)
    );
  });

  // Daily aggregate updates - Every day at 01:00 UTC
  cron.schedule('0 1 * * *', () => {
    logger.info('Cron: Creator aggregates update triggered');
    updateCreatorAggregates().catch((error) =>
      logger.error('Cron: Aggregates update error:', error)
    );
  });

  // Weekly cleanup - Sunday at 02:00 UTC
  cron.schedule('0 2 * * 0', () => {
    logger.info('Cron: Token usage cleanup triggered');
    cleanupOldTokenUsage().catch((error) =>
      logger.error('Cron: Cleanup error:', error)
    );
  });

  // Token pack cleanup - Daily at 03:00 UTC
  cron.schedule('0 3 * * *', () => {
    logger.info('Cron: Token pack cleanup triggered');
    cleanupTokenPacks().catch((error) =>
      logger.error('Cron: Token pack cleanup error:', error)
    );
  });

  // Weekly usage reports - Monday at 09:00 UTC
  cron.schedule('0 9 * * 1', () => {
    logger.info('Cron: Weekly usage reports triggered');
    sendWeeklyUsageReports().catch((error) =>
      logger.error('Cron: Weekly reports error:', error)
    );
  });

  logger.info('Cron jobs initialized successfully');
  logger.info('Schedule:');
  logger.info('  - Monthly quota reset: 1st of month, 00:00 UTC');
  logger.info('  - Subscription reset: 1st of month, 00:10 UTC');
  logger.info('  - Aggregate updates: Daily, 01:00 UTC');
  logger.info('  - Token usage cleanup: Sunday, 02:00 UTC');
  logger.info('  - Token pack cleanup: Daily, 03:00 UTC');
  logger.info('  - Weekly reports: Monday, 09:00 UTC');
}

/**
 * Manual trigger functions for testing
 */
export const manualTriggers = {
  resetCreatorQuotas: resetCreatorMonthlyQuotas,
  resetSubscriptions: resetMarketplaceSubscriptions,
  cleanupTokenUsage: cleanupOldTokenUsage,
  updateAggregates: updateCreatorAggregates,
  sendWeeklyReports: sendWeeklyUsageReports,
  cleanupTokenPacks: cleanupTokenPacks,
};

export default {
  initializeCronJobs,
  manualTriggers,
};
