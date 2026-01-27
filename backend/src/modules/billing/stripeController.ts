import { Request, Response } from 'express';
import { getStripe, getStripePriceId, mustGetStripeWebhookSecret } from '../../services/stripeService';
import { db } from '../../config/database';
import { logger } from '../../config/logger';

function getFrontendUrl(): string {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

export async function createCheckoutSession(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const tier = String(req.body?.tier || '') as 'starter' | 'growth' | 'scale';
  if (!['starter', 'growth', 'scale'].includes(tier)) return res.status(400).json({ error: 'Invalid tier' });

  const stripe = getStripe();

  // Check if customer already exists
  const existing = await db.query(
    `SELECT "stripeCustomerId" FROM "stripe_customers" WHERE "userId"=$1 LIMIT 1`,
    [userId]
  );

  let customerId: string;
  if (existing.rows[0]?.stripeCustomerId) {
    customerId = existing.rows[0].stripeCustomerId;
  } else {
    const customer = await stripe.customers.create({ metadata: { userId } });
    customerId = customer.id;
    await db.query(
      `INSERT INTO "stripe_customers" ("id","userId","stripeCustomerId","createdAt")
       VALUES ($1,$2,$3,now())
       ON CONFLICT ("userId") DO UPDATE SET "stripeCustomerId"=EXCLUDED."stripeCustomerId"`,
      [`sc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, userId, customerId]
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: getStripePriceId(tier), quantity: 1 }],
    success_url: `${getFrontendUrl()}/onboarding/deploy?paid=1`,
    cancel_url: `${getFrontendUrl()}/onboarding/plan?cancelled=1`,
    metadata: { userId, tier },
  });

  return res.json({ url: session.url });
}

export async function stripeWebhook(req: Request, res: Response) {
  const stripe = getStripe();
  const secret = mustGetStripeWebhookSecret();

  const sig = req.headers['stripe-signature'];
  if (!sig || typeof sig !== 'string') return res.status(400).send('Missing stripe-signature');

  let event;
  try {
    // req.body must be Buffer because express.raw
    event = stripe.webhooks.constructEvent(req.body as any, sig, secret);
  } catch (err: any) {
    logger.error('[Stripe Webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Minimal: when subscription created/updated, set User.planTier
  if (event.type === 'checkout.session.completed') {
    const sess: any = event.data.object;
    const userId = sess?.metadata?.userId;
    const tier = sess?.metadata?.tier;

    if (userId && ['starter', 'growth', 'scale'].includes(tier)) {
      await db.query(`UPDATE "User" SET "planTier"=$1 WHERE id=$2`, [tier, userId]);
      logger.info(`[Stripe] Updated user ${userId} to tier ${tier}`);
    }
  }

  return res.json({ received: true });
}


