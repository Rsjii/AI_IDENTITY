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

  try {
    // Basic chat counts
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

    // Revenue (separate pay-per-chat earnings from subscription revenue)
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const payPerChatEarnings = await stripePaymentQueries.sumPayPerChatEarningsSince(userId, monthStart);
    const subscriptionRevenue = await stripePaymentQueries.sumSubscriptionRevenueSince(userId, monthStart);
    const totalRevenue = payPerChatEarnings + subscriptionRevenue;

    // Active users (last 5 minutes)
    const activeR = await db.query(
      `SELECT COUNT(DISTINCT "visitorId")::int AS c FROM "active_sessions"
       WHERE "creatorId"=$1 AND "lastActiveAt" > NOW() - INTERVAL '5 minutes'`,
      [userId]
    );

    // Most asked questions (from chat_messages)
    const topQuestionsR = await db.query(
      `SELECT "content", COUNT(*)::int AS count
       FROM "chat_messages" cm
       JOIN "chat_sessions" cs ON cs.id = cm."sessionId"
       WHERE cs."creatorId" = $1 AND cm."role" = 'user'
       GROUP BY "content"
       ORDER BY count DESC
       LIMIT 10`,
      [userId]
    );

    // Response times (from mirror_runs)
    const responseTimeR = await db.query(
      `SELECT
        COALESCE(AVG("latencyMs")::int, 0) as avg,
        COALESCE(MIN("latencyMs")::int, 0) as min,
        COALESCE(MAX("latencyMs")::int, 0) as max
       FROM "mirror_runs" mr
       JOIN "identity_versions" iv ON iv.id = mr."identityVersionId"
       JOIN "identities" i ON i.id = iv."identityId"
       WHERE i."userId" = $1 AND mr."latencyMs" IS NOT NULL`,
      [userId]
    );

    // Satisfaction score (from trust_events)
    const satisfactionR = await db.query(
      `SELECT
        COALESCE(COUNT(*) FILTER (WHERE event = 'confirm_yes')::int, 0) as positive,
        COALESCE(COUNT(*) FILTER (WHERE event = 'confirm_no')::int, 0) as negative
       FROM "trust_events" te
       JOIN "identity_versions" iv ON iv.id = te."identityVersionId"
       JOIN "identities" i ON i.id = iv."identityId"
       WHERE i."userId" = $1`,
      [userId]
    );

    const positive = satisfactionR.rows[0]?.positive || 0;
    const negative = satisfactionR.rows[0]?.negative || 0;
    const total = positive + negative;
    const score = total > 0 ? Math.round((positive / total) * 100) : 0;

    // Peak hours
    const peakHoursR = await db.query(
      `SELECT EXTRACT(HOUR FROM cs."createdAt")::int as hour, COUNT(*)::int as count
       FROM "chat_sessions" cs
       WHERE cs."creatorId" = $1 AND cs."createdAt" >= NOW() - INTERVAL '30 days'
       GROUP BY hour
       ORDER BY hour`,
      [userId]
    );

    // Get user plan info
    const userR = await db.query(`SELECT "planTier", "trialEndsAt" FROM "User" WHERE id=$1 LIMIT 1`, [userId]);
    const planTier = userR.rows[0]?.planTier || 'free';
    const trialEndsAt = userR.rows[0]?.trialEndsAt || null;

    return res.json({
      success: true,
      planTier,
      trialEndsAt,
      chats: {
        total: totalR.rows[0]?.c || 0,
        today: todayR.rows[0]?.c || 0,
        week: weekR.rows[0]?.c || 0,
        month: monthR.rows[0]?.c || 0,
      },
      revenue: { 
        thisMonthCents: totalRevenue,
        payPerChatEarningsCents: payPerChatEarnings,
        subscriptionRevenueCents: subscriptionRevenue,
      },
      activeUsers: activeR.rows[0]?.c || 0,
      analytics: {
        topQuestions: topQuestionsR.rows,
        responseTime: responseTimeR.rows[0] || { avg: 0, min: 0, max: 0 },
        satisfaction: { positive, negative, score },
        peakHours: peakHoursR.rows,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
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