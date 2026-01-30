import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../config/database';
import { generateId } from '../../utils/idGenerator';

function getUserId(req: Request): string | null {
  const u: any = (req as any).user;
  return u?.id || u?.userId || null;
}

const createReviewSchema = z.object({
  listingId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export async function createReview(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const data = createReviewSchema.parse(req.body);

  // Prevent duplicate reviews by same user
  const existing = await db.query(
    `SELECT id FROM "marketplace_reviews" WHERE "listingId"=$1 AND "userId"=$2 LIMIT 1`,
    [data.listingId, userId]
  );
  if (existing.rows[0]) {
    return res.status(409).json({ error: 'Review already exists' });
  }

  const id = generateId.marketplaceReview();
  await db.query(
    `INSERT INTO "marketplace_reviews" ("id","listingId","userId","rating","comment","createdAt")
     VALUES ($1,$2,$3,$4,$5,now())`,
    [id, data.listingId, userId, data.rating, data.comment || null]
  );

  // Update listing rating (simple average)
  const agg = await db.query(
    `SELECT AVG("rating")::numeric(10,2) AS avg_rating, COUNT(*)::int AS count
     FROM "marketplace_reviews" WHERE "listingId"=$1`,
    [data.listingId]
  );
  const rating = agg.rows[0]?.avg_rating || null;
  await db.query(
    `UPDATE "marketplace_listings" SET "rating"=$1 WHERE id=$2`,
    [rating, data.listingId]
  );

  return res.json({ success: true });
}

export async function listReviews(req: Request, res: Response) {
  const listingId = String(req.params.listingId || '').trim();
  const r = await db.query(
    `SELECT r.*, u.handle, u.name, u."profileImage"
     FROM "marketplace_reviews" r
     JOIN "User" u ON u.id = r."userId"
     WHERE r."listingId"=$1
     ORDER BY r."createdAt" DESC
     LIMIT 200`,
    [listingId]
  );

  return res.json({
    items: r.rows.map((row: any) => ({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.createdAt,
      user: {
        handle: row.handle,
        name: row.name,
        profileImage: row.profileImage || null,
      },
    })),
  });
}

