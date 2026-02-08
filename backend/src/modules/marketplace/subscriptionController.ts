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
  return res.status(501).json({
    error: 'Marketplace subscriptions are disabled (Stripe removed).',
    errorCode: 'SUBSCRIPTIONS_DISABLED',
  });
}

