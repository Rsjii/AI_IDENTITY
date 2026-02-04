import { Request, Response } from 'express';
import { db } from '../../config/database';

function getUserId(req: Request): string | null {
  const u: any = (req as any).user;
  return u?.id || u?.userId || null;
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


