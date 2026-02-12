/**
 * Token Service
 * Handles all token tracking, estimation, deduction, and usage analytics
 * Part of the token-based pricing system
 */

import db from '../config/db';
import { logger } from '../config/logger';

// =====================================================
// TYPES & INTERFACES
// =====================================================

export interface TokenUsageRecord {
  userId: string;
  creatorId: string;
  sessionId: string;
  messageId: string;
  inputTokens: number;
  outputTokens: number;
  systemTokens: number;
  modelUsed: string;
  accessType: 'subscription' | 'token_pack' | 'free';
}

export interface TokenAccessResult {
  allowed: boolean;
  reason?: string;
  accessType?: 'subscription' | 'token_pack' | 'free';
  tokensAvailable?: number;
  rateLimitHit?: boolean;
  needsPayment?: boolean;
  estimatedTokensNeeded?: number;
}

export interface UserUsageStats {
  percentageUsed: number;
  tokensUsed: number;
  tokensLimit: number;
  accessType: string;
}

export interface CreatorUsageStats {
  tokensUsed: number;
  tokensQuota: number;
  percentageUsed: number;
  conversationsThisMonth: number;
  storageUsedMB: number;
  storageLimitMB: number;
  storagePercentage: number;
}

// =====================================================
// TOKEN ESTIMATION
// =====================================================

/**
 * Estimate tokens needed for a message
 * Conservative estimate: input + expected output + system prompt
 */
export function estimateTokens(messageLength: number): number {
  // Conservative estimate:
  // - Input: message length / 4 * 1.3 (accounting for tokenization overhead)
  // - Output: Assume average 500 tokens response
  // - System: ~200 tokens for system prompts

  const inputTokens = Math.ceil((messageLength / 4) * 1.3);
  const outputTokens = 500; // Average expected response
  const systemTokens = 200; // System prompt overhead

  return inputTokens + outputTokens + systemTokens;
}

/**
 * Calculate estimated cost based on tokens and model
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  modelUsed: string
): number {
  // Cost per 1M tokens (update these based on actual pricing)
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 2.5, output: 10 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4-turbo': { input: 10, output: 30 },
    'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
    'claude-3-opus': { input: 15, output: 75 },
    'claude-3-sonnet': { input: 3, output: 15 },
    'claude-3-haiku': { input: 0.25, output: 1.25 },
    default: { input: 2.5, output: 10 }, // Default to GPT-4o pricing
  };

  const modelPricing = pricing[modelUsed] || pricing.default;

  const inputCost = (inputTokens * modelPricing.input) / 1000000;
  const outputCost = (outputTokens * modelPricing.output) / 1000000;

  return inputCost + outputCost;
}

// =====================================================
// ACCESS CHECKING HELPERS
// =====================================================

/**
 * Get active subscription for user with a creator
 */
export async function getActiveSubscription(
  userId: string,
  creatorId: string
): Promise<{
  id: string;
  token_limit: number;
  tokens_used_this_period: number;
  period_start: Date;
  period_end: Date;
} | null> {
  try {
    const result = await db.query(
      `SELECT
         ms.id,
         ms.token_limit,
         ms.tokens_used_this_period,
         ms."currentPeriodStart" as period_start,
         ms."currentPeriodEnd" as period_end
       FROM "marketplace_subscriptions" ms
       JOIN "marketplace_listings" ml ON ml.id = ms."listingId"
       WHERE ms."userId" = $1
         AND ml."creatorId" = $2
         AND ms."status" IN ('active','trialing')
         AND (ms."currentPeriodEnd" IS NULL OR ms."currentPeriodEnd" > NOW())
       LIMIT 1`,
      [userId, creatorId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    logger.error('Error getting active subscription:', error);
    return null;
  }
}

/**
 * Get token pack balance for user with a creator
 */
export async function getTokenPackBalance(
  userId: string,
  creatorId: string
): Promise<{
  total_remaining: number;
  oldest_pack_id?: string;
} | null> {
  try {
    const result = await db.query(
      `SELECT
         SUM(tokens_remaining) as total_remaining,
         (SELECT id FROM token_packs
          WHERE user_id = $1 AND creator_id = $2 AND tokens_remaining > 0
          ORDER BY purchased_at ASC LIMIT 1) as oldest_pack_id
       FROM token_packs
       WHERE user_id = $1
       AND creator_id = $2
       AND tokens_remaining > 0`,
      [userId, creatorId]
    );

    if (!result.rows[0]?.total_remaining) {
      return null;
    }

    return {
      total_remaining: parseInt(result.rows[0].total_remaining),
      oldest_pack_id: result.rows[0].oldest_pack_id,
    };
  } catch (error) {
    logger.error('Error getting token pack balance:', error);
    return null;
  }
}

/**
 * Get free tier usage for user with a creator this month
 */
export async function getFreeUsageThisPeriod(
  userId: string,
  creatorId: string
): Promise<number> {
  try {
    const result = await db.query(
      `SELECT COALESCE(tokens_used_this_period, 0) as usage
       FROM user_creator_token_aggregates
       WHERE user_id = $1
       AND creator_id = $2
       AND current_period_start = DATE_TRUNC('month', NOW())`,
      [userId, creatorId]
    );

    return parseInt(result.rows[0]?.usage || '0');
  } catch (error) {
    logger.error('Error getting free usage:', error);
    return 0;
  }
}

/**
 * Check creator's platform quota
 */
export async function checkCreatorQuota(
  creatorId: string
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const result = await db.query(
      `SELECT u.plan_tier, u.plan_token_quota, u.plan_status,
              COALESCE(cta.tokens_used_this_period, 0) as tokens_used
       FROM "User" u
       LEFT JOIN creator_token_aggregates cta ON cta.creator_id = u.id
       WHERE u.id = $1`,
      [creatorId]
    );

    if (result.rows.length === 0) {
      return { allowed: false, reason: 'Creator not found' };
    }

    const { plan_token_quota, tokens_used, plan_status } = result.rows[0];

    // Check if plan is active
    if (plan_status !== 'active') {
      return { allowed: false, reason: 'Creator plan is not active' };
    }

    // Allow 20% overage for all plans
    const maxAllowed = plan_token_quota * 1.2;

    if (tokens_used >= maxAllowed) {
      return {
        allowed: false,
        reason: 'Creator has exceeded their monthly token quota',
      };
    }

    return { allowed: true };
  } catch (error) {
    logger.error('Error checking creator quota:', error);
    return { allowed: false, reason: 'Error checking creator quota' };
  }
}

/**
 * Check rate limiting for user
 */
export async function checkRateLimit(
  userId: string,
  creatorId: string
): Promise<boolean> {
  try {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);

    // Determine user's access level
    const hasSubscription = await getActiveSubscription(userId, creatorId);
    const hasPack = await getTokenPackBalance(userId, creatorId);

    // Different rate limits based on access
    let messagesPerMinute: number;
    if (hasSubscription) {
      messagesPerMinute = 10; // Subscribers: 10 per minute
    } else if (hasPack && hasPack.total_remaining > 0) {
      messagesPerMinute = 5; // Token pack users: 5 per minute
    } else {
      messagesPerMinute = 1; // Free tier: 1 per minute
    }

    // Check recent messages from rate_limits table
    const recentCount = await db.query(
      `SELECT COUNT(*) as count FROM token_usage
       WHERE user_id = $1
       AND creator_id = $2
       AND created_at > $3`,
      [userId, creatorId, oneMinuteAgo]
    );

    const count = parseInt(recentCount.rows[0]?.count || '0');

    if (count >= messagesPerMinute) {
      return false; // Rate limit hit
    }

    return true;
  } catch (error) {
    logger.error('Error checking rate limit:', error);
    return false;
  }
}

// =====================================================
// TOKEN RECORDING & DEDUCTION
// =====================================================

/**
 * Record token usage and deduct from appropriate source
 * Uses atomic transaction to ensure consistency
 */
export async function recordTokenUsage(
  record: TokenUsageRecord
): Promise<void> {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const {
      userId,
      creatorId,
      sessionId,
      messageId,
      inputTokens,
      outputTokens,
      systemTokens,
      modelUsed,
      accessType,
    } = record;

    const totalTokens = inputTokens + outputTokens + systemTokens;

    // Calculate cost
    const estimatedCost = calculateCost(inputTokens, outputTokens, modelUsed);

    // 1. Insert detailed usage record
    await client.query(
      `INSERT INTO token_usage
       (user_id, creator_id, session_id, message_id, input_tokens, output_tokens,
        system_tokens, model_used, access_type, estimated_cost_usd)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        userId,
        creatorId,
        sessionId,
        messageId,
        inputTokens,
        outputTokens,
        systemTokens,
        modelUsed,
        accessType,
        estimatedCost,
      ]
    );

    // 2. Update creator's aggregate (platform quota)
    await client.query(
      `INSERT INTO creator_token_aggregates
       (creator_id, current_period_start, current_period_end,
        tokens_used_this_period, total_tokens_all_time, total_conversations_all_time, updated_at)
       VALUES ($1, DATE_TRUNC('month', NOW()),
               DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
               $2, $2, 1, NOW())
       ON CONFLICT (creator_id) DO UPDATE SET
         tokens_used_this_period = CASE
           WHEN creator_token_aggregates.current_period_start = DATE_TRUNC('month', NOW())
           THEN creator_token_aggregates.tokens_used_this_period + $2
           ELSE $2
         END,
         current_period_start = DATE_TRUNC('month', NOW()),
         current_period_end = DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
         total_tokens_all_time = creator_token_aggregates.total_tokens_all_time + $2,
         total_conversations_all_time = creator_token_aggregates.total_conversations_all_time + 1,
         updated_at = NOW()`,
      [creatorId, totalTokens]
    );

    // 3. Deduct from user's access method
    if (accessType === 'subscription') {
      // Deduct from subscription quota
      await client.query(
        `UPDATE "marketplace_subscriptions" ms
         SET tokens_used_this_period = COALESCE(ms.tokens_used_this_period, 0) + $1
         WHERE ms."userId" = $2
           AND ms."status" IN ('active','trialing')
           AND EXISTS (
             SELECT 1
             FROM "marketplace_listings" ml
             WHERE ml.id = ms."listingId"
               AND ml."creatorId" = $3
           )`,
        [totalTokens, userId, creatorId]
      );
    } else if (accessType === 'token_pack') {
      // Deduct from token pack (FIFO - oldest pack first)
      let remainingToDeduct = totalTokens;

      while (remainingToDeduct > 0) {
        const packResult = await client.query(
          `SELECT id, tokens_remaining FROM token_packs
           WHERE user_id = $1 AND creator_id = $2 AND tokens_remaining > 0
           ORDER BY purchased_at ASC
           LIMIT 1`,
          [userId, creatorId]
        );

        if (packResult.rows.length === 0) {
          logger.warn(
            `No token packs available for user ${userId} but accessType was token_pack`
          );
          break;
        }

        const pack = packResult.rows[0];
        const deductAmount = Math.min(remainingToDeduct, pack.tokens_remaining);

        await client.query(
          `UPDATE token_packs
           SET tokens_remaining = tokens_remaining - $1
           WHERE id = $2`,
          [deductAmount, pack.id]
        );

        remainingToDeduct -= deductAmount;
      }
    } else if (accessType === 'free') {
      // Update user-creator aggregate for free tier tracking
      await client.query(
        `INSERT INTO user_creator_token_aggregates
         (user_id, creator_id, current_period_start, current_period_end,
          tokens_used_this_period, total_tokens_all_time, updated_at)
         VALUES ($1, $2, DATE_TRUNC('month', NOW()),
                 DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
                 $3, $3, NOW())
         ON CONFLICT (user_id, creator_id) DO UPDATE SET
           tokens_used_this_period = CASE
             WHEN user_creator_token_aggregates.current_period_start = DATE_TRUNC('month', NOW())
             THEN user_creator_token_aggregates.tokens_used_this_period + $3
             ELSE $3
           END,
           current_period_start = DATE_TRUNC('month', NOW()),
           current_period_end = DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
           total_tokens_all_time = user_creator_token_aggregates.total_tokens_all_time + $3,
           updated_at = NOW()`,
        [userId, creatorId, totalTokens]
      );
    }

    // 4. Check for warnings (80%, 90% usage)
    await checkAndTriggerWarnings(userId, creatorId, accessType, client);

    await client.query('COMMIT');

    logger.info('Token usage recorded successfully', {
      userId,
      creatorId,
      totalTokens,
      accessType,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Token deduction error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// =====================================================
// WARNING SYSTEM
// =====================================================

/**
 * Check if warnings need to be triggered
 */
async function checkAndTriggerWarnings(
  userId: string,
  creatorId: string,
  accessType: string,
  client: any
): Promise<void> {
  try {
    // Check user subscription/pack usage
    if (accessType === 'subscription') {
      const sub = await client.query(
        `SELECT token_limit, tokens_used_this_period
         FROM "marketplace_subscriptions" ms
         WHERE ms."userId" = $1
           AND ms."status" IN ('active','trialing')
           AND EXISTS (
             SELECT 1
             FROM "marketplace_listings" ml
             WHERE ml.id = ms."listingId"
               AND ml."creatorId" = $2
           )
         LIMIT 1`,
        [userId, creatorId]
      );

      if (sub.rows[0]) {
        const { token_limit, tokens_used_this_period } = sub.rows[0];
        // Skip warnings if token_limit is null (unlimited)
        if (token_limit == null) return;
        const percentage = (tokens_used_this_period / token_limit) * 100;

        if (percentage >= 80 && percentage < 90) {
          await queueWarningNotification(userId, 'subscription_80', {
            percentage: 80,
            tokensUsed: tokens_used_this_period,
            tokenLimit: token_limit,
          });
        } else if (percentage >= 90) {
          await queueWarningNotification(userId, 'subscription_90', {
            percentage: 90,
            tokensUsed: tokens_used_this_period,
            tokenLimit: token_limit,
          });
        }
      }
    }

    // Check creator quota usage
    const creatorUsage = await client.query(
      `SELECT u.plan_token_quota, COALESCE(c.tokens_used_this_period, 0) as tokens_used_this_period
       FROM "User" u
       LEFT JOIN creator_token_aggregates c ON c.creator_id = u.id
       WHERE u.id = $1`,
      [creatorId]
    );

    if (creatorUsage.rows[0]) {
      const { plan_token_quota, tokens_used_this_period } =
        creatorUsage.rows[0];
      const percentage = (tokens_used_this_period / plan_token_quota) * 100;

      if (percentage >= 80) {
        await queueCreatorWarning(creatorId, percentage);
      }
    }
  } catch (error) {
    logger.error('Error checking warnings:', error);
    // Don't throw - warnings are non-critical
  }
}

/**
 * Queue warning notification for user
 * (In production, this would integrate with email service)
 */
async function queueWarningNotification(
  userId: string,
  type: string,
  data: any
): Promise<void> {
  try {
    // Log warning
    logger.warn('User usage warning', { userId, type, data });

    // Send email notification
    const { sendTokenWarning, sendTokenQuotaExceeded } = await import('./emailService');

    if (type === 'subscription_80' || type === 'token_pack_80' || type === 'free_tier_80') {
      await sendTokenWarning(userId, 80, data.accessType || 'free');
    } else if (type === 'subscription_90' || type === 'token_pack_90' || type === 'free_tier_90') {
      await sendTokenWarning(userId, 90, data.accessType || 'free');
    } else if (type === 'subscription_exceeded' || type === 'free_tier_exceeded') {
      await sendTokenQuotaExceeded(userId, data.accessType || 'free');
    }
  } catch (error) {
    logger.error('Error queueing warning notification:', error);
  }
}

/**
 * Queue warning notification for creator
 */
async function queueCreatorWarning(
  creatorId: string,
  percentage: number
): Promise<void> {
  try {
    logger.warn('Creator quota warning', { creatorId, percentage });

    // Get creator's plan tier
    const result = await db.query(
      `SELECT plan_tier FROM "User" WHERE id = $1`,
      [creatorId]
    );

    if (result.rows.length === 0) {
      return;
    }

    const planTier = result.rows[0].plan_tier || 'free';

    // Send email notification
    const { sendTokenWarning, sendTokenQuotaExceeded } = await import('./emailService');

    if (percentage >= 100) {
      await sendTokenQuotaExceeded(creatorId, planTier);
    } else if (percentage >= 90) {
      await sendTokenWarning(creatorId, 90, planTier);
    } else if (percentage >= 80) {
      await sendTokenWarning(creatorId, 80, planTier);
    }
  } catch (error) {
    logger.error('Error queueing creator warning:', error);
  }
}

// =====================================================
// STATS RETRIEVAL
// =====================================================

/**
 * Get user's usage stats for display
 */
export async function getUserUsageStats(
  userId: string,
  creatorId: string,
  accessType: string
): Promise<UserUsageStats> {
  try {
    if (accessType === 'subscription') {
      const sub = await db.query(
        `SELECT token_limit, tokens_used_this_period
         FROM "marketplace_subscriptions" ms
         WHERE ms."userId" = $1
           AND ms."status" IN ('active','trialing')
           AND EXISTS (
             SELECT 1
             FROM "marketplace_listings" ml
             WHERE ml.id = ms."listingId"
               AND ml."creatorId" = $2
           )
         LIMIT 1`,
        [userId, creatorId]
      );

      if (sub.rows[0]) {
        const { token_limit, tokens_used_this_period } = sub.rows[0];
        // Handle null token_limit (unlimited subscription)
        if (token_limit == null) {
          return {
            percentageUsed: 0,
            tokensUsed: tokens_used_this_period || 0,
            tokensLimit: 0, // 0 means unlimited
            accessType: 'subscription',
          };
        }
        return {
          percentageUsed: Math.round(
            (tokens_used_this_period / token_limit) * 100
          ),
          tokensUsed: tokens_used_this_period,
          tokensLimit: token_limit,
          accessType: 'subscription',
        };
      }
    }

    if (accessType === 'token_pack') {
      const pack = await getTokenPackBalance(userId, creatorId);

      if (pack) {
        // For display, show percentage of most recent pack usage
        const packDetail = await db.query(
          `SELECT tokens_purchased, tokens_remaining
           FROM token_packs
           WHERE user_id = $1 AND creator_id = $2 AND tokens_remaining > 0
           ORDER BY purchased_at DESC
           LIMIT 1`,
          [userId, creatorId]
        );

        if (packDetail.rows[0]) {
          const { tokens_purchased, tokens_remaining } = packDetail.rows[0];
          const tokensUsed = tokens_purchased - tokens_remaining;

          return {
            percentageUsed: Math.round((tokensUsed / tokens_purchased) * 100),
            tokensUsed,
            tokensLimit: tokens_purchased,
            accessType: 'token_pack',
          };
        }
      }
    }

    if (accessType === 'free') {
      const FREE_LIMIT = 10000;
      const tokensUsed = await getFreeUsageThisPeriod(userId, creatorId);

      return {
        percentageUsed: Math.round((tokensUsed / FREE_LIMIT) * 100),
        tokensUsed,
        tokensLimit: FREE_LIMIT,
        accessType: 'free',
      };
    }

    return {
      percentageUsed: 0,
      tokensUsed: 0,
      tokensLimit: 0,
      accessType: 'unknown',
    };
  } catch (error) {
    logger.error('Error getting user usage stats:', error);
    return {
      percentageUsed: 0,
      tokensUsed: 0,
      tokensLimit: 0,
      accessType: 'unknown',
    };
  }
}

/**
 * Get creator's usage stats for dashboard
 */
export async function getCreatorUsageStats(
  creatorId: string
): Promise<CreatorUsageStats> {
  try {
    const result = await db.query(
      `SELECT
         u.plan_token_quota,
         u.plan_storage_mb,
         u.storage_used_mb,
         COALESCE(cta.tokens_used_this_period, 0) as tokens_used,
         COALESCE(cta.total_conversations_all_time, 0) as conversations
       FROM "User" u
       LEFT JOIN creator_token_aggregates cta ON cta.creator_id = u.id
       WHERE u.id = $1`,
      [creatorId]
    );

    if (result.rows.length === 0) {
      throw new Error('Creator not found');
    }

    const {
      plan_token_quota,
      plan_storage_mb,
      storage_used_mb,
      tokens_used,
      conversations,
    } = result.rows[0];

    return {
      tokensUsed: parseInt(tokens_used),
      tokensQuota: plan_token_quota,
      percentageUsed: Math.round((tokens_used / plan_token_quota) * 100),
      conversationsThisMonth: parseInt(conversations),
      storageUsedMB: storage_used_mb || 0,
      storageLimitMB: plan_storage_mb,
      storagePercentage: Math.round(
        ((storage_used_mb || 0) / plan_storage_mb) * 100
      ),
    };
  } catch (error) {
    logger.error('Error getting creator usage stats:', error);
    throw error;
  }
}

// =====================================================
// EXPORTS
// =====================================================

export default {
  estimateTokens,
  calculateCost,
  getActiveSubscription,
  getTokenPackBalance,
  getFreeUsageThisPeriod,
  checkCreatorQuota,
  checkRateLimit,
  recordTokenUsage,
  getUserUsageStats,
  getCreatorUsageStats,
};
