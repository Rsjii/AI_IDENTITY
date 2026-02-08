import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../config/database';
import { generateId } from '../../utils/idGenerator';

function getUserId(req: Request): string | null {
  const u: any = (req as any).user;
  return u?.id || u?.userId || null;
}

const startSubscriptionSchema = z.object({
  listingId: z.string().min(1),
});

const checkoutSchema = z.object({
  listingId: z.string().min(1),
  billingCountry: z.enum(['IN', 'OTHER']).optional(),
  successUrl: z.string().min(1).optional(),
  cancelUrl: z.string().min(1).optional(),
});

export async function startSubscription(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const data = startSubscriptionSchema.parse(req.body);
  const listing = await db.query(
    `SELECT * FROM "marketplace_listings" WHERE id=$1 AND "isPublic"=true LIMIT 1`,
    [data.listingId]
  );
  if (!listing.rows[0]) return res.status(404).json({ error: 'Listing not found' });

  const existing = await db.query(
    `SELECT * FROM "marketplace_subscriptions" WHERE "listingId"=$1 AND "userId"=$2 LIMIT 1`,
    [data.listingId, userId]
  );
  if (existing.rows[0]) return res.json({ item: existing.rows[0] });

  const id = generateId.marketplaceSubscription();
  const status = listing.rows[0].freeTrialQuestions > 0 ? 'trialing' : 'active';
  const r = await db.query(
    `INSERT INTO "marketplace_subscriptions"
     ("id","listingId","userId","status","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,now(),now())
     RETURNING *`,
    [id, data.listingId, userId, status]
  );

  // Increment subscriber count
  await db.query(
    `UPDATE "marketplace_listings" SET "totalSubscribers" = "totalSubscribers" + 1 WHERE id=$1`,
    [data.listingId]
  );

  return res.json({ item: r.rows[0] });
}

export async function getSubscriptionStatus(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const listingId = String(req.query.listingId || '').trim();
  if (!listingId) return res.status(400).json({ error: 'listingId required' });

  const r = await db.query(
    `SELECT * FROM "marketplace_subscriptions" WHERE "listingId"=$1 AND "userId"=$2 LIMIT 1`,
    [listingId, userId]
  );
  return res.json({ item: r.rows[0] || null });
}

export async function cancelSubscription(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const listingId = String(req.body?.listingId || '').trim();
  if (!listingId) return res.status(400).json({ error: 'listingId required' });

  const subRes = await db.query(
    `SELECT * FROM "marketplace_subscriptions" WHERE "listingId"=$1 AND "userId"=$2 LIMIT 1`,
    [listingId, userId]
  );
  const sub = subRes.rows[0];
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });

  // Stripe removed - subscriptions disabled

  const r = await db.query(
    `UPDATE "marketplace_subscriptions"
     SET "cancelAtPeriodEnd"=true, "cancelledAt"=NOW(), "updatedAt"=CURRENT_TIMESTAMP
     WHERE "listingId"=$1 AND "userId"=$2
     RETURNING *`,
    [listingId, userId]
  );
  return res.json({ item: r.rows[0] || null });
}

export async function createSubscriptionCheckout(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const data = checkoutSchema.parse(req.body);

  const listingRes = await db.query(
    `SELECT ml.*, u.id as "creatorId", u.handle as "creatorHandle"
     FROM "marketplace_listings" ml
     JOIN "User" u ON u.id = ml."creatorId"
     WHERE ml.id=$1 AND ml."isPublic"=true LIMIT 1`,
    [data.listingId]
  );
  const listing = listingRes.rows[0];
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const priceCents = Number(listing.subscriptionPriceCents || 0);
  if (!priceCents || priceCents <= 0) {
    return res.status(400).json({ error: 'This listing does not have a paid subscription price' });
  }

  // Decide gateway based on billingCountry param (consistent with plan checkout)
  const billingCountry = data.billingCountry;
  let gateway: 'razorpay' | 'lemonsqueezy' = 'lemonsqueezy';
  
  if (billingCountry === 'IN') {
    gateway = 'razorpay';
  } else if (!billingCountry) {
    // Fallback to phone heuristic if not provided
    const viewer = await db.query(`SELECT phone FROM "User" WHERE id=$1 LIMIT 1`, [userId]);
    const phone = String(viewer.rows[0]?.phone || '');
    if (phone.startsWith('+91') || phone.startsWith('91')) gateway = 'razorpay';
  }

  const viewer = await db.query(`SELECT email, name FROM "User" WHERE id=$1 LIMIT 1`, [userId]);

  if (gateway === 'lemonsqueezy') {
    // Needs fixed variant mapping (same idea as pay-per-chat); add your env var + mapping.
    const variantId = process.env.LEMONSQUEEZY_VARIANT_ID_MARKETPLACE_SUB || '';
    if (!variantId) return res.status(500).json({ error: 'Missing env: LEMONSQUEEZY_VARIANT_ID_MARKETPLACE_SUB' });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const successUrl = data.successUrl || `/chat/${encodeURIComponent(String(listing.creatorHandle || ''))}?subscribed=1`;
    const redirectUrl = `${frontendUrl}${successUrl.startsWith('/') ? successUrl : '/' + successUrl}`;

    const { createLemonCheckoutForVariant } = await import('../../services/lemonSqueezyService');
    const co = await createLemonCheckoutForVariant({
      variantId,
      userId,
      email: String(viewer.rows[0]?.email || ''),
      name: viewer.rows[0]?.name || null,
      redirectUrl,
      custom: {
        type: 'marketplace_subscription',
        listingId: data.listingId,
        creatorId: String(listing.creatorId),
        viewerUserId: userId,
        priceCents,
      },
    });

    return res.json({ gateway: 'lemonsqueezy', url: co.url });
  }

  // Razorpay: interpret cents as paise for India
  const amountPaise = Math.floor(priceCents);
  const { createOrder } = await import('../../services/razorpayService');

  const order = await createOrder({
    amount: amountPaise,
    currency: 'INR',
    receipt: `sub_${data.listingId.slice(-6)}_${Date.now().toString(36).slice(-6)}`.slice(0, 40),
    notes: { type: 'marketplace_subscription', listingId: data.listingId, viewerUserId: userId },
  });

  return res.json({
    gateway: 'razorpay',
    keyId: process.env.RAZORPAY_KEY_ID,
    order: { id: order.id, amount: order.amount, currency: order.currency },
    listingId: data.listingId,
  });
}

const verifySubscriptionSchema = z.object({
  listingId: z.string().min(1),
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});

export async function verifySubscriptionCheckout(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { listingId, orderId, paymentId, signature } = verifySubscriptionSchema.parse(req.body);

  const { verifyPaymentSignature } = await import('../../services/razorpayService');
  const ok = verifyPaymentSignature({ orderId, paymentId, signature });
  if (!ok) return res.status(400).json({ error: 'Invalid signature' });

  // Get listing details
  const listingRes = await db.query(
    `SELECT ml.*, u.id as "creatorId"
     FROM "marketplace_listings" ml
     JOIN "User" u ON u.id = ml."creatorId"
     WHERE ml.id=$1 AND ml."isPublic"=true LIMIT 1`,
    [listingId]
  );
  const listing = listingRes.rows[0];
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const priceCents = Number(listing.subscriptionPriceCents || 0);
  if (!priceCents || priceCents <= 0) {
    return res.status(400).json({ error: 'This listing does not have a paid subscription price' });
  }

  // Check if subscription already exists
  const existing = await db.query(
    `SELECT id, "currentPeriodEnd" FROM "marketplace_subscriptions" WHERE "listingId"=$1 AND "userId"=$2 LIMIT 1`,
    [listingId, userId]
  );

  if (existing.rows.length === 0) {
    // New subscription
    const subId = generateId.marketplaceSubscription();
    const periodStart = new Date();
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.query(
      `INSERT INTO "marketplace_subscriptions"
       ("id","listingId","userId","status","currentPeriodStart","currentPeriodEnd","createdAt","updatedAt")
       VALUES ($1,$2,$3,'active',$4,$5,NOW(),NOW())`,
      [subId, listingId, userId, periodStart.toISOString(), periodEnd.toISOString()]
    );

    // Increment subscriber count
    await db.query(
      `UPDATE "marketplace_listings" SET "totalSubscribers" = "totalSubscribers" + 1 WHERE id=$1`,
      [listingId]
    );
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
      [extendFrom.toISOString(), newPeriodEnd.toISOString(), listingId, userId]
    );
  }

    // Ledger entry
    // Currency: Razorpay = INR, Lemon = USD (handled in webhook)
    const amount = Math.floor(priceCents);
    const platformFee = Math.floor(amount * 0.25);
    const creatorEarnings = amount - platformFee;

    const payId = `msub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await db.query(
      `INSERT INTO "stripe_payments"
       ("id","creatorId","payerUserId","amount","currency","status","stripePaymentIntentId","platformFeeCents","creatorEarningsCents","type","createdAt")
       VALUES ($1,$2,$3,$4,'INR','succeeded',$5,$6,$7,'marketplace_subscription',NOW())`,
      [payId, String(listing.creatorId), userId, amount, paymentId, platformFee, creatorEarnings]
    );

  return res.json({ success: true });
}

