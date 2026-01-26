import { Request, Response } from 'express';
import { z } from 'zod';
import { userQueries, stripePaymentQueries } from '../../config/database';
import Stripe from 'stripe';
import { logger } from '../../config/logger';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  logger.warn('STRIPE_SECRET_KEY not configured');
}
const stripe = stripeSecret ? new Stripe(stripeSecret, {}) : null;

const createPaymentIntentSchema = z.object({
  creatorId: z.string().min(1),
  tier: z.enum(['premium', 'vip']),
  visitorId: z.string().optional(),
  sessionId: z.string().optional(),
});

const confirmPaymentSchema = z.object({
  paymentIntentId: z.string().min(1),
  creatorId: z.string().min(1),
  sessionId: z.string().optional(),
  tier: z.enum(['premium', 'vip']),
});

export async function createPaymentIntent(req: Request, res: Response) {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' });
    }
    const { creatorId, tier, visitorId, sessionId } = createPaymentIntentSchema.parse(req.body);

    const creator = await userQueries.findById(creatorId);
    if (!creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const pricing = (creator.priceConfig as any) || {
      premium: { amountCents: 500 },
      vip: { amountCents: 5000 },
    };

    const amount = tier === 'vip' ? pricing.vip?.amountCents || 5000 : pricing.premium?.amountCents || 500;

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: {
        creatorId,
        tier,
        visitorId: visitorId || '',
        sessionId: sessionId || '',
      },
    });

    return res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    logger.error({ error }, 'Payment intent error');
    return res.status(400).json({ error: error.message || 'Failed to create payment intent' });
  }
}

export async function confirmPayment(req: Request, res: Response) {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' });
    }
    const { paymentIntentId, creatorId, sessionId, tier } = confirmPaymentSchema.parse(req.body);

    // Verify payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // ✅ Trust Stripe amount, not client
    const amount = paymentIntent.amount;

    // Calculate platform fee (25%)
    const PLATFORM_FEE_PERCENT = 0.25;
    const platformFee = Math.floor(amount * PLATFORM_FEE_PERCENT);
    const creatorEarnings = amount - platformFee;

    // Record payment
    await stripePaymentQueries.create({
      creatorId,
      sessionId: sessionId || null,
      amount,
      status: 'succeeded',
      stripePaymentIntentId: paymentIntentId,
      platformFeeCents: platformFee,
      creatorEarningsCents: creatorEarnings,
      type: 'pay_per_chat',
    });

    return res.json({ success: true });
  } catch (error: any) {
    logger.error({ error }, 'Confirm payment error');
    return res.status(400).json({ error: error.message || 'Failed to confirm payment' });
  }
}

