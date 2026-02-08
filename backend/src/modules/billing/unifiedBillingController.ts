import { Request, Response } from 'express';
import { z } from 'zod';
import { db, userQueries } from '../../config/database';
import { logger } from '../../config/logger';
import { createOrder, verifyPaymentSignature } from '../../services/razorpayService';
import { createLemonCheckout, extractLemonEvent, verifyLemonWebhookSignature } from '../../services/lemonSqueezyService';

type Tier = 'starter' | 'growth' | 'scale';
type Gateway = 'razorpay' | 'lemonsqueezy';

function normalizeTier(input: string): Tier {
  if (input === 'pro') return 'starter';
  if (input === 'starter' || input === 'growth' || input === 'scale') return input;
  throw new Error('Invalid tier');
}

function getFrontendUrl(): string {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

function isIndiaPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const p = phone.trim();
  return p.startsWith('+91') || p.startsWith('91');
}

async function selectGatewayForUser(userId: string, forceGateway?: Gateway): Promise<Gateway> {
  if (forceGateway) return forceGateway;
  const user = await userQueries.findById(userId);
  if (isIndiaPhone(user?.phone)) return 'razorpay';
  return 'lemonsqueezy';
}

function razorpayAmountForTierPaise(tier: Tier): number {
  const envMap: Record<Tier, string | undefined> = {
    starter: process.env.RAZORPAY_PRICE_STARTER_PAISE,
    growth: process.env.RAZORPAY_PRICE_GROWTH_PAISE,
    scale: process.env.RAZORPAY_PRICE_SCALE_PAISE,
  };

  const v = Number(envMap[tier] || '');
  if (Number.isFinite(v) && v > 0) return Math.floor(v);

  if (tier === 'starter') return 99900;
  if (tier === 'growth') return 199900;
  return 499900;
}

const checkoutSchema = z.object({
  tier: z.string().min(1),
  returnUrl: z.string().optional(),
  billingCountry: z.enum(['IN', 'OTHER']).optional(),
  forceGateway: z.enum(['razorpay', 'lemonsqueezy']).optional(),
});

export async function checkout(req: Request, res: Response) {
  const userId = (req as any).user?.id as string | undefined;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = checkoutSchema.parse(req.body);
  const tier = normalizeTier(String(parsed.tier));

  // ✅ BEST PRACTICE: checkout-selected country overrides heuristic
  const gateway: Gateway =
    parsed.billingCountry === 'IN'
      ? 'razorpay'
      : parsed.billingCountry === 'OTHER'
        ? 'lemonsqueezy'
        : await selectGatewayForUser(userId, parsed.forceGateway);

  if (gateway === 'lemonsqueezy') {
    const frontendUrl = getFrontendUrl();
    const returnUrl = parsed.returnUrl || '/onboarding/deploy?paid=1';
    const redirectUrl = `${frontendUrl}${returnUrl.startsWith('/') ? returnUrl : '/' + returnUrl}`;

    const userResult = await db.query(
      `SELECT id, email, name, phone, "planTier" FROM "User" WHERE id=$1 LIMIT 1`,
      [userId]
    );
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const co = await createLemonCheckout({
      tier,
      userId,
      email: user.email,
      name: user.name || null,
      redirectUrl,
    });

    await db.query(
      `INSERT INTO "billing_transactions"
       ("id","userId","gateway","tier","status","gatewayOrderId","meta")
       VALUES ($1,$2,'lemonsqueezy',$3,'created',$4,$5)`,
      [
        `bt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        userId,
        tier,
        co.checkoutId,
        JSON.stringify({ checkoutUrl: co.url }),
      ]
    );

    return res.json({ gateway: 'lemonsqueezy', url: co.url });
  }

  // Razorpay (India)
  const amountPaise = razorpayAmountForTierPaise(tier);

  const order = await createOrder({
    amount: amountPaise,
    currency: 'INR',
    receipt: `plan_${userId}_${tier}_${Date.now()}`,
    notes: { userId, tier },
  });

  await db.query(
    `INSERT INTO "billing_transactions"
     ("id","userId","gateway","tier","amount","currency","status","gatewayOrderId","meta")
     VALUES ($1,$2,'razorpay',$3,$4,'INR','created',$5,$6)`,
    [
      `bt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userId,
      tier,
      amountPaise,
      order.id,
      JSON.stringify({ receipt: `plan_${userId}_${tier}` }),
    ]
  );

  return res.json({
    gateway: 'razorpay',
    keyId: process.env.RAZORPAY_KEY_ID,
    order: { id: order.id, amount: order.amount, currency: order.currency },
    tier,
  });
}

const razorpayVerifySchema = z.object({
  tier: z.string().min(1),
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});

export async function verifyRazorpayCheckout(req: Request, res: Response) {
  const userId = (req as any).user?.id as string | undefined;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = razorpayVerifySchema.parse(req.body);
  const tier = normalizeTier(String(parsed.tier));

  const ok = verifyPaymentSignature({
    orderId: parsed.orderId,
    paymentId: parsed.paymentId,
    signature: parsed.signature,
  });
  if (!ok) return res.status(400).json({ error: 'Invalid signature' });

  await db.query(`UPDATE "User" SET "planTier"=$1 WHERE id=$2`, [tier, userId]);

  // ✅ Stripe removed: always go deploy
  try {
    await userQueries.updateOnboardingStep(userId, 'deploy');
  } catch (e: any) {
    logger.warn({ err: e?.message || e }, 'Failed to update onboarding step after Razorpay verify');
  }

  await db.query(
    `UPDATE "billing_transactions"
     SET "status"='succeeded', "gatewayPaymentId"=$1, "updatedAt"=now()
     WHERE "userId"=$2 AND "gatewayOrderId"=$3`,
    [parsed.paymentId, userId, parsed.orderId]
  );

  logger.info({ userId, tier, orderId: parsed.orderId, paymentId: parsed.paymentId }, '✅ Razorpay plan payment verified');
  return res.json({ success: true, tier });
}

export async function lemonSqueezyWebhook(req: Request, res: Response) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) return res.status(500).send('Missing webhook secret');

  // ✅ confirm your header name in Lemon dashboard
  const sig = req.headers['x-signature'];
  if (!sig || typeof sig !== 'string') return res.status(400).send('Missing x-signature');

  const rawBody = req.body as Buffer;
  const ok = verifyLemonWebhookSignature({ rawBody, signatureHeader: sig, secret });
  if (!ok) return res.status(400).send('Invalid signature');

  const payload = JSON.parse(rawBody.toString('utf8'));
  const { eventName, custom, variantId, checkoutId, subscriptionId } = extractLemonEvent(payload);

  const userId = String(custom?.userId || custom?.user_id || '');
  let tier = String(custom?.tier || '');

  if (!tier && variantId) {
    if (variantId === String(process.env.LEMONSQUEEZY_VARIANT_ID_STARTER)) tier = 'starter';
    if (variantId === String(process.env.LEMONSQUEEZY_VARIANT_ID_GROWTH)) tier = 'growth';
    if (variantId === String(process.env.LEMONSQUEEZY_VARIANT_ID_SCALE)) tier = 'scale';
  }

  const activate =
    eventName === 'order_created' ||
    eventName === 'subscription_created' ||
    eventName === 'subscription_updated';

  const cancel =
    eventName === 'subscription_cancelled' ||
    eventName === 'subscription_canceled' ||
    eventName === 'subscription_expired';

  if (activate && userId && (tier === 'starter' || tier === 'growth' || tier === 'scale')) {
    await db.query(`UPDATE "User" SET "planTier"=$1 WHERE id=$2`, [tier, userId]);
    try {
      await userQueries.updateOnboardingStep(userId, 'deploy');
    } catch {}

    await db.query(
      `UPDATE "billing_transactions"
       SET "status"='succeeded',
           "gatewayPaymentId"=$1,
           "updatedAt"=now(),
           "meta"=COALESCE("meta",'{}'::jsonb) || $2::jsonb
       WHERE "gateway"='lemonsqueezy'
         AND ("gatewayOrderId"=$3 OR ("userId"=$4 AND "tier"=$5 AND "status"='created'))`,
      [
        subscriptionId,
        JSON.stringify({ eventName, checkoutId, variantId }),
        checkoutId || '',
        userId,
        tier,
      ]
    );

    return res.json({ received: true });
  }

  if (cancel && userId) {
    await db.query(`UPDATE "User" SET "planTier"='free' WHERE id=$1`, [userId]);
    return res.json({ received: true });
  }

  return res.json({ received: true });
}