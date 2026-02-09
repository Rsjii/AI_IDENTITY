import { Request, Response } from 'express';
import { db } from '../../config/database';

function getUserId(req: Request): string | null {
  const u: any = (req as any).user;
  return u?.id || u?.userId || null;
}

export async function getUserDashboard(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // Subscriptions
  const subsR = await db.query(
    `
    SELECT
      ms.id,
      ms."listingId",
      ms.status,
      ms."currentPeriodEnd" AS "renewsAt",
      ml."subscriptionPriceCents",
      ml.currency,
      u.name AS "creatorName",
      u.handle AS "creatorUsername",
      u."profileImage" AS "creatorAvatar"
    FROM "marketplace_subscriptions" ms
    JOIN "marketplace_listings" ml ON ml.id = ms."listingId"
    JOIN "User" u ON u.id = ml."creatorId"
    WHERE ms."userId" = $1
      AND ms.status IN ('active','trialing','past_due','unpaid')
    ORDER BY ms."createdAt" DESC
    `,
    [userId]
  );

  // Pay-per-chat (derive expiresAt from premium_sessions; fallback = createdAt + 24h)
  const ppcR = await db.query(
    `
    SELECT
      sp.id,
      sp.amount AS "priceCents",
      sp.currency,
      sp."createdAt" AS "purchasedAt",
      COALESCE(ps."expiresAt", sp."createdAt" + interval '24 hours') AS "expiresAt",
      u.name AS "creatorName",
      u.handle AS "creatorUsername",
      u."profileImage" AS "creatorAvatar"
    FROM "stripe_payments" sp
    JOIN "User" u ON u.id = sp."creatorId"
    LEFT JOIN "premium_sessions" ps
      ON ps."creatorId" = sp."creatorId" AND ps."sessionId" = sp."sessionId"
    WHERE sp."payerUserId" = $1
      AND sp.status = 'succeeded'
      AND sp.type = 'pay_per_chat'
    ORDER BY sp."createdAt" DESC
    LIMIT 50
    `,
    [userId]
  );

  // Spend
  const monthSpendR = await db.query(
    `
    SELECT COALESCE(SUM(amount),0)::int AS total
    FROM "stripe_payments"
    WHERE "payerUserId"=$1
      AND status='succeeded'
      AND type IN ('pay_per_chat','marketplace_subscription')
      AND "createdAt">=date_trunc('month', now())
    `,
    [userId]
  );

  const allTimeSpendR = await db.query(
    `
    SELECT COALESCE(SUM(amount),0)::int AS total
    FROM "stripe_payments"
    WHERE "payerUserId"=$1
      AND status='succeeded'
      AND type IN ('pay_per_chat','marketplace_subscription')
    `,
    [userId]
  );

  const subscriptions = subsR.rows.map((x: any) => ({
    id: String(x.id),
    listingId: String(x.listingId),
    creatorName: String(x.creatorName || ''),
    creatorUsername: String(x.creatorUsername || ''),
    creatorAvatar: x.creatorAvatar || undefined,
    priceCents: Number(x.subscriptionPriceCents || 0),
    currency: String(x.currency || 'USD'),
    renewsAt: x.renewsAt ? new Date(x.renewsAt).toISOString() : new Date().toISOString(),
    status: String(x.status) === 'active' ? 'active' : 'cancelled',
  }));

  const payPerChatAccess = ppcR.rows.map((x: any) => ({
    id: String(x.id),
    creatorName: String(x.creatorName || ''),
    creatorUsername: String(x.creatorUsername || ''),
    creatorAvatar: x.creatorAvatar || undefined,
    priceCents: Number(x.priceCents || 0),
    currency: String(x.currency || 'USD'),
    expiresAt: new Date(x.expiresAt).toISOString(),
    purchasedAt: new Date(x.purchasedAt).toISOString(),
  }));

  const now = Date.now();
  const activePayPerChatCount = payPerChatAccess.filter((p: any) => new Date(p.expiresAt).getTime() > now).length;
  const activeSubsCount = subscriptions.filter((s: any) => s.status === 'active').length;

  return res.json({
    subscriptions,
    payPerChatAccess,
    totalSpentThisMonthCents: monthSpendR.rows[0]?.total || 0,
    totalSpentAllTimeCents: allTimeSpendR.rows[0]?.total || 0,
    activeAccessCount: activeSubsCount + activePayPerChatCount,
  });
}

export async function listMySubscriptions(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const r = await db.query(
    `
    SELECT
      ms.id,
      ms."listingId",
      ms."userId",
      ms."stripeSubscriptionId",
      ms.status,
      ms."createdAt",
      ms."updatedAt",
      ml.slug AS "listingSlug",
      ml."subscriptionPriceCents",
      ml.currency,
      ml.category,
      ml.description,
      u.id AS "creatorId",
      u.handle AS "creatorHandle",
      u.name AS "creatorName",
      u."profileImage" AS "creatorAvatar"
    FROM "marketplace_subscriptions" ms
    JOIN "marketplace_listings" ml ON ml.id = ms."listingId"
    JOIN "User" u ON u.id = ml."creatorId"
    WHERE ms."userId" = $1
      AND ms.status IN ('active','trialing','past_due','unpaid')
    ORDER BY ms."createdAt" DESC
    `,
    [userId]
  );

  return res.json({
    success: true,
    items: r.rows.map((x: any) => ({
      id: x.id,
      listingId: x.listingId,
      listingSlug: x.listingSlug,
      status: x.status,
      stripeSubscriptionId: x.stripeSubscriptionId || null,
      createdAt: x.createdAt,
      updatedAt: x.updatedAt,
      subscriptionPriceCents: Number(x.subscriptionPriceCents || 0),
      currency: x.currency || 'USD',
      category: x.category || null,
      description: x.description || '',
      creator: {
        id: x.creatorId,
        handle: x.creatorHandle,
        name: x.creatorName,
        avatarUrl: x.creatorAvatar || null,
      },
    })),
  });
}


