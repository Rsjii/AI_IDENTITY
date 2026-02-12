/**
 * Creator Plan Controller
 * Handles creator subscription plans (FREE, STARTER, GROWTH, SCALE)
 * with token quotas and storage limits
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import db from '../../config/db';
import { logger } from '../../config/logger';
import { createOrder } from '../../services/razorpayService';
import { createLemonCheckoutForVariant } from '../../services/lemonSqueezyService';
import { getCreatorUsageStats } from '../../services/tokenService';

// =====================================================
// PLAN CONFIGURATION
// =====================================================

export const CREATOR_PLANS = {
  free: {
    tier: 'free',
    name: 'Free',
    price: 0,
    tokens: 100000, // 100K tokens
    storage: 100, // MB
    features: ['basic_avatar', 'private_sharing'],
  },
  starter: {
    tier: 'starter',
    name: 'Starter',
    price: 1500, // $15 USD or ₹1500 paise (varies by gateway)
    tokens: 5000000, // 5M tokens
    storage: 1024, // 1GB
    features: ['marketplace', 'analytics', 'custom_url', 'subscriptions'],
  },
  growth: {
    tier: 'growth',
    name: 'Growth',
    price: 6000, // $60 USD or ₹6000 paise
    tokens: 25000000, // 25M tokens
    storage: 10240, // 10GB
    features: ['starter', 'voice_cloning', 'priority_listing', 'webhooks', 'branding'],
  },
  scale: {
    tier: 'scale',
    name: 'Scale',
    price: 17500, // $175 USD or ₹17500 paise
    tokens: 100000000, // 100M tokens
    storage: 51200, // 50GB
    features: ['growth', 'api_access', 'white_label', 'team_access', 'priority_support'],
  },
} as const;

export type CreatorPlanTier = keyof typeof CREATOR_PLANS;

// =====================================================
// SCHEMAS
// =====================================================

const checkoutSchema = z.object({
  tier: z.enum(['starter', 'growth', 'scale']),
  billingCountry: z.string().optional(),
  returnUrl: z.string().url().optional(),
});

const verifySchema = z.object({
  tier: z.enum(['starter', 'growth', 'scale']),
  orderId: z.string(),
  paymentId: z.string(),
  signature: z.string(),
});

// =====================================================
// CONTROLLERS
// =====================================================

/**
 * GET /api/billing/creator-plan
 * Get current creator plan details
 */
export async function getCurrentPlan(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await db.query(
      `SELECT plan_tier, plan_token_quota, plan_storage_mb, storage_used_mb,
              plan_period_start, plan_period_end, plan_status
       FROM "User"
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const planTier = (user.plan_tier || 'free') as CreatorPlanTier;
    const planConfig = CREATOR_PLANS[planTier];

    return res.json({
      success: true,
      plan: {
        tier: planTier,
        name: planConfig.name,
        price: planConfig.price,
        tokens: planConfig.tokens,
        storage: planConfig.storage,
        features: planConfig.features,
        status: user.plan_status || 'active',
        periodStart: user.plan_period_start,
        periodEnd: user.plan_period_end,
      },
    });
  } catch (error) {
    logger.error('Error getting creator plan:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/billing/creator-plan/usage
 * Get usage statistics for creator's plan
 */
export async function getPlanUsage(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const stats = await getCreatorUsageStats(userId);

    return res.json({
      success: true,
      usage: {
        tokensUsed: stats.tokensUsed,
        tokensQuota: stats.tokensQuota,
        tokensUsedFormatted: formatTokenCount(stats.tokensUsed),
        tokensRemainingFormatted: formatTokenCount(stats.tokensQuota - stats.tokensUsed),
        percentageUsed: stats.percentageUsed,
        conversations: stats.conversationsThisMonth,
        storageUsedMB: stats.storageUsedMB,
        storageLimitMB: stats.storageLimitMB,
        storagePercentage: stats.storagePercentage,
      },
    });
  } catch (error) {
    logger.error('Error getting plan usage:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/billing/creator-plan/checkout
 * Create checkout session for plan upgrade
 */
export async function createPlanCheckout(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { tier, billingCountry, returnUrl } = checkoutSchema.parse(req.body);

    // Get user info
    const userResult = await db.query(
      `SELECT email, name, phone FROM "User" WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const planConfig = CREATOR_PLANS[tier];

    // Determine gateway (Razorpay for India, LemonSqueezy for international)
    const isIndia =
      billingCountry === 'IN' ||
      user.phone?.startsWith('+91') ||
      user.phone?.startsWith('91');

    logger.info('Creating creator plan checkout', {
      userId,
      tier,
      price: planConfig.price,
      gateway: isIndia ? 'razorpay' : 'lemonsqueezy',
    });

    if (isIndia) {
      // Razorpay checkout
      const receipt = `creator_plan_${tier}_${userId}_${Date.now()}`;
      const order = await createOrder({
        amount: planConfig.price,
        currency: 'INR',
        receipt,
        notes: {
          userId,
          tier,
          type: 'creator_plan',
        },
      });

      // Create billing transaction record
      await db.query(
        `INSERT INTO "billing_transactions"
         ("id","userId","gateway","tier","amount","currency","status","gatewayOrderId","meta","createdAt","updatedAt")
         VALUES ($1,$2,'razorpay',$3,$4,'INR','created',$5,$6,NOW(),NOW())`,
        [
          `bt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          userId,
          tier,
          planConfig.price,
          order.id,
          JSON.stringify({ type: 'creator_plan' }),
        ]
      );

      return res.json({
        success: true,
        gateway: 'razorpay',
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
        },
        keyId: process.env.RAZORPAY_KEY_ID,
      });
    } else {
      // LemonSqueezy checkout
      // NOTE: You need to set up LemonSqueezy variant IDs for each plan tier
      const variantIdMap: Record<string, string> = {
        starter: process.env.LEMONSQUEEZY_VARIANT_ID_CREATOR_STARTER || '',
        growth: process.env.LEMONSQUEEZY_VARIANT_ID_CREATOR_GROWTH || '',
        scale: process.env.LEMONSQUEEZY_VARIANT_ID_CREATOR_SCALE || '',
      };

      const variantId = variantIdMap[tier];

      if (!variantId) {
        return res.status(400).json({
          error: 'Plan variant not configured for LemonSqueezy',
        });
      }

      const checkout = await createLemonCheckoutForVariant({
        variantId,
        userId,
        email: user.email,
        name: user.name || '',
        redirectUrl: returnUrl || `${process.env.FRONTEND_URL}/dashboard?plan_upgraded=true`,
        custom: {
          userId,
          tier,
          type: 'creator_plan',
        },
      });
      const checkoutUrl = checkout.url;

      // Create billing transaction record
      await db.query(
        `INSERT INTO "billing_transactions"
         ("id","userId","gateway","tier","status","gatewayOrderId","meta","createdAt","updatedAt")
         VALUES ($1,$2,'lemonsqueezy',$3,'created',$4,$5,NOW(),NOW())`,
        [
          `bt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          userId,
          tier,
          `ls_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, // placeholder order id
          JSON.stringify({ type: 'creator_plan' }),
        ]
      );

      return res.json({
        success: true,
        gateway: 'lemonsqueezy',
        checkoutUrl,
      });
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    logger.error('Error creating creator plan checkout:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/billing/creator-plan/verify
 * Verify Razorpay payment and activate plan
 */
export async function verifyPlanPayment(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { tier, orderId, paymentId, signature } = verifySchema.parse(req.body);

    // Verify Razorpay signature
    const crypto = require('crypto');
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const generated = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (generated !== signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const planConfig = CREATOR_PLANS[tier];

    // Update user's plan
    await db.query(
      `UPDATE "User"
       SET plan_tier = $1,
           plan_token_quota = $2,
           plan_storage_mb = $3,
           plan_period_start = NOW(),
           plan_period_end = NOW() + INTERVAL '30 days',
           plan_status = 'active'
       WHERE id = $4`,
      [tier, planConfig.tokens, planConfig.storage, userId]
    );

    // Update billing transaction
    await db.query(
      `UPDATE "billing_transactions"
       SET "status" = 'succeeded',
           "gatewayPaymentId" = $1,
           "updatedAt" = NOW()
       WHERE "gatewayOrderId" = $2 AND "userId" = $3`,
      [paymentId, orderId, userId]
    );

    // Initialize creator_token_aggregates if not exists
    await db.query(
      `INSERT INTO creator_token_aggregates
       (creator_id, current_period_start, current_period_end, tokens_used_this_period, total_tokens_all_time)
       VALUES ($1, NOW(), NOW() + INTERVAL '30 days', 0, 0)
       ON CONFLICT (creator_id) DO UPDATE SET
         current_period_start = NOW(),
         current_period_end = NOW() + INTERVAL '30 days'`,
      [userId]
    );

    logger.info('Creator plan upgraded', { userId, tier });

    return res.json({
      success: true,
      message: `Plan upgraded to ${planConfig.name}`,
      plan: {
        tier,
        name: planConfig.name,
        tokens: planConfig.tokens,
        storage: planConfig.storage,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    logger.error('Error verifying creator plan payment:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/billing/creator-plan/cancel
 * Cancel creator plan (downgrade to free at end of period)
 */
export async function cancelPlan(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get current plan
    const userResult = await db.query(
      `SELECT plan_tier, plan_period_end FROM "User" WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentTier = userResult.rows[0].plan_tier;

    if (currentTier === 'free') {
      return res.status(400).json({ error: 'Already on free plan' });
    }

    // Set plan status to cancelled (will downgrade at end of period)
    await db.query(
      `UPDATE "User"
       SET plan_status = 'cancelled'
       WHERE id = $1`,
      [userId]
    );

    logger.info('Creator plan cancelled', { userId, currentTier });

    return res.json({
      success: true,
      message: `Plan will downgrade to Free on ${userResult.rows[0].plan_period_end}`,
      downgrades_at: userResult.rows[0].plan_period_end,
    });
  } catch (error) {
    logger.error('Error cancelling creator plan:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function formatTokenCount(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

// =====================================================
// EXPORTS
// =====================================================

export default {
  getCurrentPlan,
  getPlanUsage,
  createPlanCheckout,
  verifyPlanPayment,
  cancelPlan,
  CREATOR_PLANS,
};
