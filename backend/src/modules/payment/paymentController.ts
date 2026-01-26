import { Request, Response } from 'express';
import { z } from 'zod';
import { isFeatureEnabled } from '../../config/featureFlags';
import { createOrder, verifyPaymentSignature } from '../../services/razorpayService';
import { subscriptionQueries } from './subscriptionDao';
import { EventLogger } from '../../services/eventLogger';
import { EVENT_TYPES } from '../../config/constants';

const createOrderSchema = z.object({
  tier: z.enum(['pro', 'teams']),
});

const verifySchema = z.object({
  tier: z.enum(['pro', 'teams']),
  orderId: z.string(),
  paymentId: z.string(),
  signature: z.string(),
});

const PRICES = {
  pro: 99900,
  teams: 499900,
} as const;

export async function createPaymentOrder(req: Request, res: Response) {
  if (!isFeatureEnabled('ENABLE_PAYMENTS')) {
    return res.status(503).json({ success: false, error: 'Payments disabled' });
  }
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const { tier } = createOrderSchema.parse(req.body);

  const existing = await subscriptionQueries.findActiveByUserId(userId);
  if (existing) {
    return res.status(400).json({ success: false, error: 'Already subscribed', tier: existing.tier });
  }

  const order = await createOrder({
    amount: PRICES[tier],
    currency: 'INR',
    receipt: `sub_${userId}_${tier}_${Date.now()}`,
    notes: { userId, tier },
  });

  EventLogger.logUserEvent(userId, EVENT_TYPES.PAYMENT_ORDER_CREATED, { tier, orderId: order.id, amount: order.amount }).catch(() => {});

  return res.json({ success: true, order });
}

export async function verifyPayment(req: Request, res: Response) {
  if (!isFeatureEnabled('ENABLE_PAYMENTS')) {
    return res.status(503).json({ success: false, error: 'Payments disabled' });
  }
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const { tier, orderId, paymentId, signature } = verifySchema.parse(req.body);

  const ok = verifyPaymentSignature({ orderId, paymentId, signature });
  if (!ok) return res.status(400).json({ success: false, error: 'Invalid signature' });

  const sub = await subscriptionQueries.createActive({
    userId,
    tier,
    amount: PRICES[tier],
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
  });

  EventLogger.logUserEvent(userId, EVENT_TYPES.SUBSCRIPTION_CREATED, { tier, subscriptionId: sub.id }).catch(() => {});

  return res.json({ success: true, subscription: sub });
}

export async function getMySubscription(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const sub = await subscriptionQueries.findActiveByUserId(userId);
  return res.json({ success: true, subscription: sub, tier: sub?.tier || 'free' });
}

export async function cancelSubscription(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const sub = await subscriptionQueries.cancelAtPeriodEnd(userId);
  if (!sub) return res.status(404).json({ success: false, error: 'No active subscription' });

  EventLogger.logUserEvent(userId, EVENT_TYPES.SUBSCRIPTION_CANCELLED, { subscriptionId: sub.id, tier: sub.tier }).catch(() => {});
  return res.json({ success: true, message: 'Will cancel at period end' });
}

