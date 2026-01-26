import { Request, Response } from 'express';
import { z } from 'zod';
import { db, userQueries, stripePaymentQueries } from '../../config/database';

function getUserId(req: Request): string | null {
  const u: any = (req as any).user;
  return u?.id || u?.userId || null;
}

export async function dashboard(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const totalR = await db.query(`SELECT COUNT(*)::int AS c FROM "chat_sessions" WHERE "creatorId"=$1`, [userId]);
  const todayR = await db.query(
    `SELECT COUNT(*)::int AS c FROM "chat_sessions" WHERE "creatorId"=$1 AND "createdAt">=date_trunc('day', now())`,
    [userId]
  );
  const weekR = await db.query(
    `SELECT COUNT(*)::int AS c FROM "chat_sessions" WHERE "creatorId"=$1 AND "createdAt">=now()-interval '7 days'`,
    [userId]
  );
  const monthR = await db.query(
    `SELECT COUNT(*)::int AS c FROM "chat_sessions" WHERE "creatorId"=$1 AND "createdAt">=date_trunc('month', now())`,
    [userId]
  );

  const revenueThisMonth = await stripePaymentQueries.sumForCreatorSince(userId, new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

  return res.json({
    success: true,
    chats: {
      total: totalR.rows[0]?.c || 0,
      today: todayR.rows[0]?.c || 0,
      week: weekR.rows[0]?.c || 0,
      month: monthR.rows[0]?.c || 0,
    },
    revenue: { thisMonthCents: revenueThisMonth },
  });
}

export async function earnings(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const r = await db.query(
    `SELECT * FROM "stripe_payments" WHERE "creatorId"=$1 ORDER BY "createdAt" DESC LIMIT 100`,
    [userId]
  );

  return res.json({ success: true, items: r.rows });
}

const pricingSchema = z.object({
  free: z.object({ enabled: z.boolean().default(true) }).passthrough().optional(),
  premium: z.object({ enabled: z.boolean().default(true), amountCents: z.number().int().min(50) }).passthrough().optional(),
  vip: z.object({ enabled: z.boolean().default(true), amountCents: z.number().int().min(50) }).passthrough().optional(),
}).passthrough();

export async function setPricing(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const cfg = pricingSchema.parse(req.body);
  const u = await userQueries.updatePricing(userId, cfg);
  return res.json({ success: true, priceConfig: u.priceConfig });
}

export async function startTrial(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const u = await userQueries.startTrial(userId, 7);
  return res.json({ success: true, trialEndsAt: u.trialEndsAt });
}