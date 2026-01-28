import { db } from '../../config/database';
import { logger } from '../../config/logger';
import { getStripe, getStripePriceId } from '../../services/stripeService';

/**
 * Upgrade subscription plan with pro-rated billing
 */
export async function upgradePlan(
  userId: string,
  newPlan: 'starter' | 'growth' | 'scale'
): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return { success: false, error: 'Stripe not configured' };
    }

    // Get current user subscription
    const userResult = await db.query(
      `SELECT u."planTier", sc."stripeCustomerId", sc."stripeSubscriptionId"
       FROM "User" u
       LEFT JOIN "stripe_customers" sc ON sc."userId" = u.id
       WHERE u.id = $1 LIMIT 1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return { success: false, error: 'User not found' };
    }

    const user = userResult.rows[0];
    const currentPlan = user.planTier || 'free';
    const customerId = user.stripeCustomerId;
    const subscriptionId = user.stripeSubscriptionId;

    // If no subscription exists, create new one
    if (!subscriptionId || !customerId) {
      // Create checkout session for new subscription
      const priceId = getStripePriceId(newPlan);
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId || undefined,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.FRONTEND_URL || 'https://selflyx.com'}/settings?tab=billing&upgraded=1`,
        cancel_url: `${process.env.FRONTEND_URL || 'https://selflyx.com'}/settings?tab=billing`,
        metadata: { userId, tier: newPlan },
      });

      return { success: true, subscriptionId: session.id };
    }

    // Get current subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const currentPriceId = subscription.items.data[0]?.price.id;
    const newPriceId = getStripePriceId(newPlan);

    // Calculate pro-rated amount
    const daysRemaining = Math.ceil(
      (subscription.current_period_end * 1000 - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const daysInPeriod = Math.ceil(
      ((subscription.current_period_end - subscription.current_period_start) * 1000) / (1000 * 60 * 60 * 24)
    );
    const prorationPercent = daysRemaining / daysInPeriod;

    // Get current and new prices
    const currentPrice = await stripe.prices.retrieve(currentPriceId);
    const newPrice = await stripe.prices.retrieve(newPriceId);

    const creditAmount = Math.floor((currentPrice.unit_amount || 0) * prorationPercent);
    const chargeAmount = (newPrice.unit_amount || 0) - creditAmount;

    // Update subscription with new price and proration
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: newPriceId,
      }],
      proration_behavior: 'always_invoice',
      metadata: { userId, tier: newPlan },
    });

    // Update database
    await db.query(
      `UPDATE "User" SET "planTier" = $1 WHERE id = $2`,
      [newPlan, userId]
    );

    await db.query(
      `UPDATE "stripe_customers" SET "stripeSubscriptionId" = $1 WHERE "userId" = $2`,
      [updatedSubscription.id, userId]
    );

    logger.info(`✅ Upgraded user ${userId} from ${currentPlan} to ${newPlan}`);
    return { success: true, subscriptionId: updatedSubscription.id };
  } catch (error: any) {
    logger.error('Upgrade plan error:', error);
    return { success: false, error: error.message || 'Failed to upgrade plan' };
  }
}

/**
 * Downgrade subscription plan
 */
export async function downgradePlan(
  userId: string,
  newPlan: 'starter' | 'growth' | 'free'
): Promise<{ success: boolean; error?: string }> {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return { success: false, error: 'Stripe not configured' };
    }

    // Get current subscription
    const userResult = await db.query(
      `SELECT sc."stripeSubscriptionId" FROM "stripe_customers" sc WHERE sc."userId" = $1 LIMIT 1`,
      [userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].stripeSubscriptionId) {
      // No subscription, just update plan tier
      await db.query(`UPDATE "User" SET "planTier" = $1 WHERE id = $2`, [newPlan, userId]);
      return { success: true };
    }

    const subscriptionId = userResult.rows[0].stripeSubscriptionId;

    if (newPlan === 'free') {
      // Cancel subscription
      await stripe.subscriptions.cancel(subscriptionId);
      await db.query(`UPDATE "User" SET "planTier" = 'free' WHERE id = $1`, [userId]);
      logger.info(`✅ Cancelled subscription for user ${userId}`);
    } else {
      // Downgrade to lower tier (will take effect at end of billing period)
      const newPriceId = getStripePriceId(newPlan);
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      await stripe.subscriptions.update(subscriptionId, {
        items: [{
          id: subscription.items.data[0].id,
          price: newPriceId,
        }],
        proration_behavior: 'none', // No proration for downgrades
        metadata: { userId, tier: newPlan },
      });

      // Schedule plan change for end of period
      await db.query(
        `UPDATE "User" SET "planTier" = $1 WHERE id = $2`,
        [newPlan, userId]
      );

      logger.info(`✅ Scheduled downgrade for user ${userId} to ${newPlan}`);
    }

    return { success: true };
  } catch (error: any) {
    logger.error('Downgrade plan error:', error);
    return { success: false, error: error.message || 'Failed to downgrade plan' };
  }
}

/**
 * Cancel subscription with grace period
 */
export async function cancelSubscription(
  userId: string,
  gracePeriodDays: number = 7
): Promise<{ success: boolean; error?: string }> {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return { success: false, error: 'Stripe not configured' };
    }

    const userResult = await db.query(
      `SELECT sc."stripeSubscriptionId" FROM "stripe_customers" sc WHERE sc."userId" = $1 LIMIT 1`,
      [userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].stripeSubscriptionId) {
      return { success: false, error: 'No active subscription found' };
    }

    const subscriptionId = userResult.rows[0].stripeSubscriptionId;

    // Cancel at period end (grace period)
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    // Update database to mark as cancelling
    await db.query(
      `UPDATE "User" SET "planTier" = 'free', "subscriptionCancellingAt" = NOW() + INTERVAL '${gracePeriodDays} days' WHERE id = $1`,
      [userId]
    );

    logger.info(`✅ Scheduled cancellation for user ${userId} (grace period: ${gracePeriodDays} days)`);
    return { success: true };
  } catch (error: any) {
    logger.error('Cancel subscription error:', error);
    return { success: false, error: error.message || 'Failed to cancel subscription' };
  }
}

