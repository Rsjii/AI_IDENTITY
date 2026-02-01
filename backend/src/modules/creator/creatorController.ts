import { Request, Response } from 'express';
import { z } from 'zod';
import { db, userQueries, stripePaymentQueries } from '../../config/database';
import { getConversationCountsLast30Days, getTopQuestionsForPeriod } from '../../services/analyticsAggregationService';
import { createConnectOnboardingLink, getConnectAccountStatus } from '../../services/stripeConnectService';

function getUserId(req: Request): string | null {
  const u: any = (req as any).user;
  return u?.id || u?.userId || null;
}

export async function exportChatsCSV(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // ✅ F1: Support format query param (csv or json)
  const format = (req.query.format === 'json' ? 'json' : 'csv') as 'csv' | 'json';

  // Optional date filtering (?from=...&to=...)
  const from = typeof req.query.from === 'string' ? req.query.from : null;
  const to = typeof req.query.to === 'string' ? req.query.to : null;

  const params: any[] = [userId];
  let where = `cs."creatorId" = $1`;
  if (from) {
    params.push(from);
    where += ` AND cs."createdAt" >= $${params.length}::timestamptz`;
  }
  if (to) {
    params.push(to);
    where += ` AND cs."createdAt" <= $${params.length}::timestamptz`;
  }

  // Flattened export (one row per message)
  const r = await db.query(
    `
    SELECT
      cs.id as "sessionId",
      cs."createdAt" as "sessionCreatedAt",
      cs."platform",
      cs."visitorId",
      cs."userId" as "viewerUserId",
      cm.id as "messageId",
      cm."createdAt" as "messageCreatedAt",
      cm."role",
      cm."content"
    FROM "chat_sessions" cs
    JOIN "chat_messages" cm ON cm."sessionId" = cs.id
    WHERE ${where}
    ORDER BY cs."createdAt" DESC, cm."createdAt" ASC
    `,
    params
  );

  if (format === 'json') {
    // ✅ F1: JSON export format
    const data = r.rows.map((x: any) => ({
      sessionId: x.sessionId,
      sessionCreatedAt: new Date(x.sessionCreatedAt).toISOString(),
      platform: x.platform || '',
      visitorId: x.visitorId || '',
      viewerUserId: x.viewerUserId || '',
      messageId: x.messageId,
      messageCreatedAt: new Date(x.messageCreatedAt).toISOString(),
      role: x.role,
      content: x.content ?? '',
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="chat-history-${new Date().toISOString().split('T')[0]}.json"`
    );
    return res.json(data);
  }

  // CSV export (default)
  const headers = [
    'sessionId',
    'sessionCreatedAt',
    'platform',
    'visitorId',
    'viewerUserId',
    'messageId',
    'messageCreatedAt',
    'role',
    'content',
  ];

  const rows = r.rows.map((x: any) => [
    x.sessionId,
    new Date(x.sessionCreatedAt).toISOString(),
    x.platform || '',
    x.visitorId || '',
    x.viewerUserId || '',
    x.messageId,
    new Date(x.messageCreatedAt).toISOString(),
    x.role,
    x.content ?? '',
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row: any[]) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="chat-history-${new Date().toISOString().split('T')[0]}.csv"`
  );
  return res.send(csv);
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
    const topQuestionsR = await getTopQuestionsForPeriod(userId, 30);

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
        topQuestions: topQuestionsR,
        responseTime: responseTimeR.rows[0] || { avg: 0, min: 0, max: 0 },
        satisfaction: { positive, negative, score },
        peakHours: peakHoursR.rows,
        conversationsOverTime: await getConversationCountsLast30Days(userId),
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

  // Get all payments
  const r = await db.query(
    `SELECT * FROM "stripe_payments" WHERE "creatorId"=$1 ORDER BY "createdAt" DESC LIMIT 1000`,
    [userId]
  );

  // Calculate balances
  // Available: earnings that are ready for payout (older than 7 days, not yet paid out)
  // Pending: earnings from last 7 days (hold period)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const allEarnings = r.rows.filter((p: any) => p.status === 'succeeded' && p.type === 'pay_per_chat');
  const totalEarnings = allEarnings.reduce((sum: number, p: any) => sum + (p.creatorEarningsCents || 0), 0);
  
  const availableEarnings = allEarnings
    .filter((p: any) => new Date(p.createdAt) < sevenDaysAgo && !p.payoutId)
    .reduce((sum: number, p: any) => sum + (p.creatorEarningsCents || 0), 0);
  
  const pendingEarnings = allEarnings
    .filter((p: any) => new Date(p.createdAt) >= sevenDaysAgo)
    .reduce((sum: number, p: any) => sum + (p.creatorEarningsCents || 0), 0);

  // Get payout history
  const payoutsR = await db.query(
    `SELECT * FROM "stripe_payouts" WHERE "creatorId"=$1 ORDER BY "createdAt" DESC LIMIT 50`,
    [userId]
  );

  return res.json({ 
    success: true, 
    items: r.rows,
    balances: {
      totalEarningsCents: totalEarnings,
      availableEarningsCents: availableEarnings,
      pendingEarningsCents: pendingEarnings,
    },
    payouts: payoutsR.rows,
  });
}

export async function exportEarningsCSV(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const r = await db.query(
    `SELECT 
      "createdAt",
      "amount" as "totalAmountCents",
      "creatorEarningsCents",
      "platformFeeCents",
      "status",
      "type",
      "stripePaymentIntentId"
     FROM "stripe_payments" 
     WHERE "creatorId"=$1 
     ORDER BY "createdAt" DESC`,
    [userId]
  );

  // Generate CSV
  const headers = ['Date', 'Total Amount ($)', 'Your Earnings ($)', 'Platform Fee ($)', 'Status', 'Type', 'Payment ID'];
  const rows = r.rows.map((p: any) => [
    new Date(p.createdAt).toISOString(),
    (p.totalAmountCents / 100).toFixed(2),
    ((p.creatorEarningsCents || 0) / 100).toFixed(2),
    ((p.platformFeeCents || 0) / 100).toFixed(2),
    p.status,
    p.type,
    p.stripePaymentIntentId || '',
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row: any[]) => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="earnings-${new Date().toISOString().split('T')[0]}.csv"`);
  return res.send(csv);
}

export async function requestPayout(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // Get available earnings
  const earningsR = await db.query(
    `SELECT SUM("creatorEarningsCents")::int as total
     FROM "stripe_payments"
     WHERE "creatorId"=$1 
       AND "status"='succeeded' 
       AND "type"='pay_per_chat'
       AND "createdAt" < NOW() - INTERVAL '7 days'
       AND "payoutId" IS NULL`,
    [userId]
  );

  const availableCents = earningsR.rows[0]?.total || 0;
  const minPayoutCents = 1000; // $10 minimum

  if (availableCents < minPayoutCents) {
    return res.status(400).json({ 
      error: `Minimum payout is $${(minPayoutCents / 100).toFixed(2)}. You have $${(availableCents / 100).toFixed(2)} available.` 
    });
  }

  // Create payout record (in real implementation, this would trigger Stripe Connect transfer)
  const payoutId = `payout_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await db.query(
    `INSERT INTO "stripe_payouts" (id, "creatorId", "amountCents", "status", "createdAt")
     VALUES ($1, $2, $3, 'pending', NOW())`,
    [payoutId, userId, availableCents]
  );

  // Mark payments as being paid out
  await db.query(
    `UPDATE "stripe_payments"
     SET "payoutId"=$1
     WHERE "creatorId"=$2 
       AND "status"='succeeded' 
       AND "type"='pay_per_chat'
       AND "createdAt" < NOW() - INTERVAL '7 days'
       AND "payoutId" IS NULL`,
    [payoutId, userId]
  );

  // TODO: In production, trigger actual Stripe Connect transfer here
  // For now, we'll just mark it as pending

  return res.json({ 
    success: true, 
    payoutId,
    amountCents: availableCents,
    message: 'Payout request submitted. In production, this would trigger a Stripe Connect transfer.',
  });
}

const DEFAULT_PAY_PER_CHAT_TIERS = [100, 500, 1000, 2500, 5000];
const MIN_TIER_CENTS = 100;
const MAX_TIER_CENTS = 10000;

const tierAmountSchema = z.number().int().min(MIN_TIER_CENTS).max(MAX_TIER_CENTS);

const pricingSchema = z.object({
  free: z.object({ enabled: z.boolean().default(true) }).passthrough().optional(),
  payPerChatTiers: z.array(tierAmountSchema).min(1).max(10).optional(),
  defaultTierCents: tierAmountSchema.optional(),
  premium: z.object({
    enabled: z.boolean().default(true),
    amountCents: tierAmountSchema,
  }).passthrough().optional(),
  vip: z.object({
    enabled: z.boolean().default(true),
    amountCents: tierAmountSchema,
  }).passthrough().optional(),
}).passthrough().superRefine((cfg, ctx) => {
  if (cfg.defaultTierCents && cfg.payPerChatTiers && !cfg.payPerChatTiers.includes(cfg.defaultTierCents)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'defaultTierCents must exist in payPerChatTiers',
      path: ['defaultTierCents'],
    });
  }
});

function normalizeTierList(tiers: number[] | undefined, fallback: number[]) {
  const base = Array.isArray(tiers) ? tiers : fallback;
  const normalized = base
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && Number.isInteger(v) && v >= MIN_TIER_CENTS && v <= MAX_TIER_CENTS)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort((a, b) => a - b);
  return normalized.length ? normalized : fallback;
}

export async function setPricing(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const cfg = pricingSchema.parse(req.body);

  const payPerChatTiers = normalizeTierList(cfg.payPerChatTiers, DEFAULT_PAY_PER_CHAT_TIERS);
  const defaultTierCents = cfg.defaultTierCents && payPerChatTiers.includes(cfg.defaultTierCents)
    ? cfg.defaultTierCents
    : payPerChatTiers[0];

  // Backward compatible premium/vip for any legacy consumers
  const premiumAmount = cfg.premium?.amountCents || payPerChatTiers[0];
  const vipAmount = cfg.vip?.amountCents || payPerChatTiers[payPerChatTiers.length - 1];

  const nextConfig = {
    ...cfg,
    payPerChatTiers,
    defaultTierCents,
    premium: { enabled: cfg.premium?.enabled ?? true, amountCents: premiumAmount },
    vip: { enabled: cfg.vip?.enabled ?? true, amountCents: vipAmount },
  };

  const u = await userQueries.updatePricing(userId, nextConfig);
  return res.json({ success: true, priceConfig: u.priceConfig });
}

export async function startTrial(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const u = await userQueries.startTrial(userId, 7);

  // ✅ FIX: Mark onboarding as complete when trial starts
  await userQueries.updateOnboardingStep(userId, 'done');
  // ✅ FIX: Also set profileCompleted = true
  await db.query('UPDATE "User" SET "profileCompleted" = true WHERE id = $1', [userId]);

  return res.json({ success: true, trialEndsAt: u.trialEndsAt });
}

/**
 * Mark onboarding as complete
 * POST /api/creator/onboarding/complete
 */
export async function completeOnboarding(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  await userQueries.updateOnboardingStep(userId, 'done');

  // ✅ Set both onboardingCompleted AND profileCompleted when onboarding is done
  await db.query(
    'UPDATE "User" SET "onboardingCompleted" = true, "profileCompleted" = true WHERE id = $1',
    [userId]
  );

  return res.json({ success: true, message: 'Onboarding marked as complete' });
}

export async function connectStripeAccount(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const returnUrl = `${frontendUrl}/settings?tab=billing&stripe=success`;
  const refreshUrl = `${frontendUrl}/settings?tab=billing&stripe=refresh`;

  const url = await createConnectOnboardingLink(userId, returnUrl, refreshUrl);
  return res.json({ url });
}

export async function getStripeConnectStatus(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const account = await getConnectAccountStatus(userId);
  if (!account) {
    return res.json({ connected: false });
  }

  return res.json({
    connected: true,
    detailsSubmitted: account.details_submitted,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    requirements: account.requirements || null,
  });
}

export async function recentChats(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const limit = Math.min(20, Math.max(1, Number(req.query.limit || 10)));

  const r = await db.query(
    `
    SELECT
      cs.id as "sessionId",
      COALESCE(u."handle", CONCAT('Visitor ', COALESCE(cs."visitorId",'unknown'))) as "label",
      COALESCE((
        SELECT cm."content"
        FROM "chat_messages" cm
        WHERE cm."sessionId" = cs.id AND cm."role" = 'user'
        ORDER BY cm."createdAt" DESC
        LIMIT 1
      ), '') as "preview",
      COALESCE((
        SELECT cm."createdAt"
        FROM "chat_messages" cm
        WHERE cm."sessionId" = cs.id
        ORDER BY cm."createdAt" DESC
        LIMIT 1
      ), cs."createdAt") as "lastMessageAt"
    FROM "chat_sessions" cs
    LEFT JOIN "User" u ON u.id = cs."userId"
    WHERE cs."creatorId" = $1
    ORDER BY "lastMessageAt" DESC
    LIMIT $2
    `,
    [userId, limit]
  );

  return res.json({ success: true, items: r.rows });
}

export async function listChats(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
  const offset = Math.max(0, Number(req.query.offset || 0));

  const r = await db.query(
    `
    SELECT
      cs.id as "sessionId",
      cs."createdAt" as "sessionCreatedAt",
      cs."platform",
      cs."visitorId",
      cs."userId" as "viewerUserId",
      COALESCE(u."handle", CONCAT('Visitor ', COALESCE(cs."visitorId",'unknown'))) as "label",
      COALESCE((
        SELECT cm."content"
        FROM "chat_messages" cm
        WHERE cm."sessionId" = cs.id AND cm."role" = 'user'
        ORDER BY cm."createdAt" DESC
        LIMIT 1
      ), '') as "preview",
      COALESCE((
        SELECT cm."createdAt"
        FROM "chat_messages" cm
        WHERE cm."sessionId" = cs.id
        ORDER BY cm."createdAt" DESC
        LIMIT 1
      ), cs."createdAt") as "lastMessageAt",
      COALESCE((
        SELECT COUNT(*)::int
        FROM "chat_messages" cm
        WHERE cm."sessionId" = cs.id
      ), 0) as "messageCount"
    FROM "chat_sessions" cs
    LEFT JOIN "User" u ON u.id = cs."userId"
    WHERE cs."creatorId" = $1
    ORDER BY "lastMessageAt" DESC
    LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset]
  );

  return res.json({ success: true, limit, offset, items: r.rows });
}

export async function chatDetails(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const sessionId = String(req.params.sessionId || '');
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

  // Ensure this chat session belongs to the logged-in creator
  const s = await db.query(
    `SELECT id, "creatorId" FROM "chat_sessions" WHERE id = $1 LIMIT 1`,
    [sessionId]
  );
  const row = s.rows[0];
  if (!row) return res.status(404).json({ error: 'Chat session not found' });
  if (row.creatorId !== userId) return res.status(403).json({ error: 'Forbidden' });

  const m = await db.query(
    `
    SELECT id, "createdAt", "role", "content"
    FROM "chat_messages"
    WHERE "sessionId" = $1
    ORDER BY "createdAt" ASC
    `,
    [sessionId]
  );

  return res.json({ success: true, sessionId, messages: m.rows });
}
