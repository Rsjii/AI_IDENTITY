import { Request, Response } from 'express';
import { z } from 'zod';
import { db, userQueries, chatSessionQueries } from '../../config/database';
import { createOrder, verifyPaymentSignature } from '../../services/razorpayService';
import { createLemonCheckoutForVariant } from '../../services/lemonSqueezyService';
import { logger } from '../../config/logger';

type BillingCountry = 'IN' | 'OTHER';
type Gateway = 'razorpay' | 'lemonsqueezy';

function getUserId(req: Request): string | null {
  const u: any = (req as any).user;
  return u?.id || u?.userId || null;
}

function isIndiaPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const p = phone.trim();
  return p.startsWith('+91') || p.startsWith('91');
}

async function selectGatewayForViewer(viewerUserId: string, billingCountry?: BillingCountry): Promise<Gateway> {
  if (billingCountry === 'IN') return 'razorpay';
  if (billingCountry === 'OTHER') return 'lemonsqueezy';
  const u = await userQueries.findById(viewerUserId);
  if (isIndiaPhone((u as any)?.phone)) return 'razorpay';
  return 'lemonsqueezy';
}

function appendSessionId(returnUrl: string, sessionId: string) {
  if (!returnUrl) return returnUrl;
  if (returnUrl.includes('sessionId=')) return returnUrl;
  return returnUrl.includes('?')
    ? `${returnUrl}&sessionId=${encodeURIComponent(sessionId)}`
    : `${returnUrl}?sessionId=${encodeURIComponent(sessionId)}`;
}

async function getPayPerChatPrice(creatorId: string): Promise<number> {
  // Stored in marketplace_listings.payPerChatPriceCents
  const r = await db.query(
    `SELECT "payPerChatPriceCents" FROM "marketplace_listings" WHERE "creatorId"=$1 AND "isPublic"=true ORDER BY "createdAt" DESC LIMIT 1`,
    [creatorId]
  );
  const v = r.rows[0]?.payPerChatPriceCents;
  return Number(v || 0) || 0;
}

// Lemon needs fixed variants (cannot do arbitrary prices reliably).
// Map your price to nearest supported tier variant ID.
function lemonVariantForPayPerChat(priceCents: number): string {
  // Example tiers; set env vars accordingly
  const tiers = [
    { cents: 500, env: 'LEMONSQUEEZY_VARIANT_ID_PPC_500' },
    { cents: 1000, env: 'LEMONSQUEEZY_VARIANT_ID_PPC_1000' },
    { cents: 2500, env: 'LEMONSQUEEZY_VARIANT_ID_PPC_2500' },
    { cents: 5000, env: 'LEMONSQUEEZY_VARIANT_ID_PPC_5000' },
  ];

  let best = tiers[0];
  for (const t of tiers) {
    if (Math.abs(t.cents - priceCents) < Math.abs(best.cents - priceCents)) best = t;
  }
  const id = process.env[best.env] || '';
  if (!id) throw new Error(`Missing env: ${best.env}`);
  return id;
}

const intentSchema = z.object({
  creatorId: z.string().min(1),
  sessionId: z.string().optional(),
  billingCountry: z.enum(['IN', 'OTHER']).optional(),
  // returnUrl for Lemon redirect back to chat
  returnUrl: z.string().optional(),
});

export async function createPayPerChatIntent(req: Request, res: Response) {
  const viewerUserId = getUserId(req);
  if (!viewerUserId) return res.status(401).json({ error: 'Unauthorized' });

  const { creatorId, sessionId: providedSessionId, billingCountry, returnUrl } = intentSchema.parse(req.body);

  // Ensure we always have a valid sessionId
  let sessionId = (providedSessionId || '').trim();
  if (!sessionId) {
    const created = await chatSessionQueries.create({
      creatorId,
      userId: viewerUserId,
      visitorId: null,
      platform: 'web',
    });
    sessionId = created.id;
  }

  const priceCents = await getPayPerChatPrice(creatorId);
  if (!priceCents || priceCents <= 0) {
    return res.status(400).json({ error: 'Creator has not enabled pay-per-chat' });
  }

  const gateway = await selectGatewayForViewer(viewerUserId, billingCountry);

  if (gateway === 'lemonsqueezy') {
    const variantId = lemonVariantForPayPerChat(priceCents);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const ru = appendSessionId(returnUrl || '/chat', sessionId);
    const redirectUrl = `${frontendUrl}${ru.startsWith('/') ? ru : '/' + ru}`;

    const co = await createLemonCheckoutForVariant({
      variantId,
      userId: viewerUserId,
      email: String((req as any).user?.email || ''),
      name: null,
      redirectUrl,
      custom: {
        type: 'pay_per_chat',
        creatorId,
        sessionId,
        viewerUserId,
        priceCents,
      },
    });

    return res.json({ gateway: 'lemonsqueezy', url: co.url, sessionId });
  }

  // Razorpay
  // NOTE: Razorpay amounts are in paise. We interpret stored "cents" as paise for India.
  const amountPaise = Math.floor(priceCents);

  const order = await createOrder({
    amount: amountPaise,
    currency: 'INR',
    receipt: `ppc_${sessionId.slice(-6)}_${Date.now().toString(36).slice(-6)}`.slice(0, 40),
    notes: {
      type: 'pay_per_chat',
      creatorId,
      sessionId,
      viewerUserId,
    },
  });

  logger.info({ creatorId, sessionId, gateway: 'razorpay', orderId: order.id }, '[PAY-PER-CHAT] Intent created');

  return res.json({
    gateway: 'razorpay',
    keyId: process.env.RAZORPAY_KEY_ID,
    order: { id: order.id, amount: order.amount, currency: order.currency },
    creatorId,
    sessionId,
  });
}

const confirmSchema = z.object({
  creatorId: z.string().min(1),
  sessionId: z.string().min(1),
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});

export async function confirmPayPerChatRazorpay(req: Request, res: Response) {
  const viewerUserId = getUserId(req);
  if (!viewerUserId) return res.status(401).json({ error: 'Unauthorized' });

  const { creatorId, sessionId, orderId, paymentId, signature } = confirmSchema.parse(req.body);

  const ok = verifyPaymentSignature({ orderId, paymentId, signature });
  if (!ok) {
    logger.warn({ orderId, paymentId }, '[PAY-PER-CHAT] Invalid signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const priceCents = await getPayPerChatPrice(creatorId);
  if (!priceCents || priceCents <= 0) return res.status(400).json({ error: 'Creator has not enabled pay-per-chat' });

  // ✅ Create premium session (24h unlock)
  const premiumId = `ps_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.query(
    `INSERT INTO "premium_sessions" ("id","creatorId","sessionId","stripePaymentId","expiresAt")
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT DO NOTHING`,
    [premiumId, creatorId, sessionId, paymentId, expiresAt.toISOString()]
  );

  // ✅ Ledger row for payout (table name legacy: stripe_payments)
  // We interpret amount as cents for ledger (use priceCents).
  // Currency: Razorpay = INR, Lemon = USD (handled in webhook)
  const amount = Math.floor(priceCents);
  const platformFee = Math.floor(amount * 0.25);
  const creatorEarnings = amount - platformFee;

  const payId = `ppc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await db.query(
    `INSERT INTO "stripe_payments"
     ("id","creatorId","payerUserId","sessionId","amount","currency","status","stripePaymentIntentId","platformFeeCents","creatorEarningsCents","type","createdAt")
     VALUES ($1,$2,$3,$4,$5,'INR','succeeded',$6,$7,$8,'pay_per_chat',NOW())`,
    [payId, creatorId, viewerUserId, sessionId, amount, paymentId, platformFee, creatorEarnings]
  );

  logger.info({ creatorId, sessionId, paymentId, premiumId }, '[PAY-PER-CHAT] Payment confirmed and premium session created');

  return res.json({ success: true, premiumExpiresAt: expiresAt.toISOString() });
}
