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

  logger.info({ userId, body: req.body }, '[CHECKOUT-BACKEND] === Checkout request received ===');
  
  const parsed = checkoutSchema.parse(req.body);
  const tier = normalizeTier(String(parsed.tier));
  
  logger.info({ 
    userId, 
    tier, 
    billingCountry: parsed.billingCountry,
    returnUrl: parsed.returnUrl,
    forceGateway: parsed.forceGateway 
  }, '[CHECKOUT-BACKEND] Parsed checkout params');

  // ✅ BEST PRACTICE: checkout-selected country overrides heuristic
  let gateway: Gateway;
  if (parsed.billingCountry === 'IN') {
    gateway = 'razorpay';
    logger.info({ userId }, '[CHECKOUT-BACKEND] ✅ Gateway: Razorpay (explicit billingCountry=IN)');
  } else if (parsed.billingCountry === 'OTHER') {
    gateway = 'lemonsqueezy';
    logger.info({ userId }, '[CHECKOUT-BACKEND] ✅ Gateway: LemonSqueezy (explicit billingCountry=OTHER)');
  } else {
    gateway = await selectGatewayForUser(userId, parsed.forceGateway);
    logger.info({ userId, gateway }, '[CHECKOUT-BACKEND] ✅ Gateway selected via user phone heuristic');
  }

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
  logger.info({ userId, tier, amountPaise }, '[CHECKOUT-BACKEND] 💳 Creating Razorpay order');

  // Razorpay constraint: receipt must be <= 40 characters
  // Format: pl_<last6UserId>_<tier>_<shortTimestamp>
  const shortUserId = userId.slice(-6); // Last 6 chars of userId
  const shortTimestamp = Date.now().toString(36).slice(-6); // Base36 timestamp (last 6 chars)
  const receipt = `pl_${shortUserId}_${tier}_${shortTimestamp}`.slice(0, 40);

  const order = await createOrder({
    amount: amountPaise,
    currency: 'INR',
    receipt: receipt,
    notes: { userId, tier },
  });
  
  logger.info({ userId, orderId: order.id, amount: order.amount }, '[CHECKOUT-BACKEND] ✅ Razorpay order created');

  const transactionId = `bt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await db.query(
    `INSERT INTO "billing_transactions"
     ("id","userId","gateway","tier","amount","currency","status","gatewayOrderId","meta")
     VALUES ($1,$2,'razorpay',$3,$4,'INR','created',$5,$6)`,
    [
      transactionId,
      userId,
      tier,
      amountPaise,
      order.id,
      JSON.stringify({ receipt: `plan_${userId}_${tier}` }),
    ]
  );
  
  logger.info({ userId, transactionId, orderId: order.id }, '[CHECKOUT-BACKEND] 💾 Transaction record created');

  const response = {
    gateway: 'razorpay',
    keyId: process.env.RAZORPAY_KEY_ID,
    order: { id: order.id, amount: order.amount, currency: order.currency },
    tier,
  };
  
  logger.info({ userId, response }, '[CHECKOUT-BACKEND] ✅ Returning Razorpay checkout response');
  return res.json(response);
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

  logger.info({ userId, body: req.body }, '[RAZORPAY-VERIFY] === Payment verification request ===');
  
  const parsed = razorpayVerifySchema.parse(req.body);
  const tier = normalizeTier(String(parsed.tier));
  
  logger.info({ userId, tier, orderId: parsed.orderId, paymentId: parsed.paymentId }, '[RAZORPAY-VERIFY] Verifying payment signature...');

  const ok = verifyPaymentSignature({
    orderId: parsed.orderId,
    paymentId: parsed.paymentId,
    signature: parsed.signature,
  });
  
  if (!ok) {
    logger.error({ userId, orderId: parsed.orderId }, '[RAZORPAY-VERIFY] ❌ Invalid payment signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }
  
  logger.info({ userId }, '[RAZORPAY-VERIFY] ✅ Signature verified, updating user plan...');

  await db.query(`UPDATE "User" SET "planTier"=$1 WHERE id=$2`, [tier, userId]);
  logger.info({ userId, tier }, '[RAZORPAY-VERIFY] ✅ User plan tier updated');

  // ✅ Stripe removed: always go deploy
  try {
    await userQueries.updateOnboardingStep(userId, 'deploy');
    logger.info({ userId }, '[RAZORPAY-VERIFY] ✅ Onboarding step updated to deploy');
  } catch (e: any) {
    logger.warn({ err: e?.message || e }, '[RAZORPAY-VERIFY] ⚠️ Failed to update onboarding step after Razorpay verify');
  }

  await db.query(
    `UPDATE "billing_transactions"
     SET "status"='succeeded', "gatewayPaymentId"=$1, "updatedAt"=now()
     WHERE "userId"=$2 AND "gatewayOrderId"=$3`,
    [parsed.paymentId, userId, parsed.orderId]
  );
  
  logger.info({ userId, tier, orderId: parsed.orderId, paymentId: parsed.paymentId }, '[RAZORPAY-VERIFY] ✅ Transaction status updated to succeeded');
  logger.info({ userId, tier }, '[RAZORPAY-VERIFY] === Payment verification complete ===');
  
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

  // ✅ Handle non-plan Lemon purchases (pay-per-chat / marketplace subscription)
  const type = String(custom?.type || '');

  if (activate && type === 'pay_per_chat') {
    const creatorId = String(custom?.creatorId || '');
    const sessionId = String(custom?.sessionId || '');
    const viewerUserId = String(custom?.viewerUserId || '');
    const priceCents = Number(custom?.priceCents || 0) || 0;

    if (creatorId && sessionId && viewerUserId && priceCents > 0) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const premiumId = `ps_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      await db.query(
        `INSERT INTO "premium_sessions" ("id","creatorId","sessionId","stripePaymentId","expiresAt")
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT DO NOTHING`,
        [premiumId, creatorId, sessionId, subscriptionId || checkoutId || 'lemon', expiresAt.toISOString()]
      );

      const amount = Math.floor(priceCents);
      const platformFee = Math.floor(amount * 0.25);
      const creatorEarnings = amount - platformFee;

      const payId = `ppc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await db.query(
        `INSERT INTO "stripe_payments"
         ("id","creatorId","payerUserId","sessionId","amount","currency","status","stripePaymentIntentId","platformFeeCents","creatorEarningsCents","type","createdAt")
         VALUES ($1,$2,$3,$4,$5,'USD','succeeded',$6,$7,$8,'pay_per_chat',NOW())`,
        [payId, creatorId, viewerUserId, sessionId, amount, String(subscriptionId || checkoutId || ''), platformFee, creatorEarnings]
      );

      logger.info({ creatorId, sessionId, premiumId, paymentId: payId }, '[LEMON-WEBHOOK] Pay-per-chat processed');
    }

    return res.json({ received: true });
  }

  if (activate && type === 'marketplace_subscription') {
    const listingId = String(custom?.listingId || '');
    const creatorId = String(custom?.creatorId || '');
    const viewerUserId = String(custom?.viewerUserId || userId);
    const priceCents = Number(custom?.priceCents || 0) || 0;

    if (listingId && creatorId && viewerUserId && priceCents > 0) {
      // Check if subscription already exists
      const existing = await db.query(
        `SELECT id, "currentPeriodEnd" FROM "marketplace_subscriptions" WHERE "listingId"=$1 AND "userId"=$2 LIMIT 1`,
        [listingId, viewerUserId]
      );

      if (existing.rows.length === 0) {
        // New subscription
        const subId = `ms_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const periodStart = new Date();
        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        await db.query(
          `INSERT INTO "marketplace_subscriptions"
           ("id","listingId","userId","status","currentPeriodStart","currentPeriodEnd","createdAt","updatedAt")
           VALUES ($1,$2,$3,'active',$4,$5,NOW(),NOW())`,
          [subId, listingId, viewerUserId, periodStart.toISOString(), periodEnd.toISOString()]
        );

        // Increment subscriber count
        await db.query(
          `UPDATE "marketplace_listings" SET "totalSubscribers" = "totalSubscribers" + 1 WHERE id=$1`,
          [listingId]
        );

        logger.info({ listingId, creatorId, viewerUserId, subId }, '[LEMON-WEBHOOK] Marketplace subscription created');
      } else {
        // ✅ Auto-extend: Renewal - extend period from now or from existing end date (whichever is later)
        const existingEnd = existing.rows[0].currentPeriodEnd 
          ? new Date(existing.rows[0].currentPeriodEnd)
          : new Date();
        const now = new Date();
        const extendFrom = existingEnd > now ? existingEnd : now;
        const newPeriodEnd = new Date(extendFrom.getTime() + 30 * 24 * 60 * 60 * 1000); // Add 30 days

        await db.query(
          `UPDATE "marketplace_subscriptions"
           SET "status"='active',
               "currentPeriodStart"=$1,
               "currentPeriodEnd"=$2,
               "updatedAt"=NOW(),
               "cancelAtPeriodEnd"=false,
               "cancelledAt"=NULL
           WHERE "listingId"=$3 AND "userId"=$4`,
          [extendFrom.toISOString(), newPeriodEnd.toISOString(), listingId, viewerUserId]
        );

        logger.info({ listingId, viewerUserId, newPeriodEnd }, '[LEMON-WEBHOOK] Marketplace subscription extended');
      }

      // Ledger entry (always create, even on renewal)
      const amount = Math.floor(priceCents);
      const platformFee = Math.floor(amount * 0.25);
      const creatorEarnings = amount - platformFee;

      const payId = `msub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await db.query(
        `INSERT INTO "stripe_payments"
         ("id","creatorId","payerUserId","amount","currency","status","stripePaymentIntentId","platformFeeCents","creatorEarningsCents","type","createdAt")
         VALUES ($1,$2,$3,$4,'USD','succeeded',$5,$6,$7,'marketplace_subscription',NOW())`,
        [payId, creatorId, viewerUserId, amount, String(subscriptionId || checkoutId || ''), platformFee, creatorEarnings]
      );
    }

    return res.json({ received: true });
  }

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