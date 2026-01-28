import { db } from '../../config/database';
import type { RangeKey } from '../history/historyDao';
import { rangeToSince } from '../history/historyDao';

export async function adminOverview(range: RangeKey) {
  const since = rangeToSince(range);

  const usersTotal = await db.query(`SELECT COUNT(*)::int AS n FROM "User"`);
  const usersNew = await db.query(`SELECT COUNT(*)::int AS n FROM "User" WHERE "createdAt" >= $1`, [since]);

  const runs = await db.query(
    `
    SELECT
      COUNT(*)::int AS runs,
      COALESCE(SUM(COALESCE(mr."tokensIn",0)+COALESCE(mr."tokensOut",0)),0)::int AS tokens
    FROM "mirror_runs" mr
    WHERE mr."createdAt" >= $1
    `,
    [since]
  );

  const trust = await db.query(
    `
    SELECT
      COALESCE(SUM(CASE WHEN event='confirm_yes' THEN 1 ELSE 0 END),0)::int AS yes,
      COALESCE(SUM(CASE WHEN event='confirm_no' THEN 1 ELSE 0 END),0)::int AS no
    FROM "trust_events"
    WHERE "createdAt" >= $1
    `,
    [since]
  );

  // Get events statistics
  const events = await db.query(
    `
    SELECT
      type,
      COUNT(*)::int AS count
    FROM "Event"
    WHERE "createdAt" >= $1
    GROUP BY type
    ORDER BY count DESC
    `,
    [since]
  );

  const eventsByType: Record<string, number> = {};
  events.rows.forEach((row: any) => {
    eventsByType[row.type] = row.count;
  });

  return {
    range,
    since,
    usersTotal: usersTotal.rows[0]?.n || 0,
    usersNew: usersNew.rows[0]?.n || 0,
    mirrorRuns: runs.rows[0]?.runs || 0,
    tokens: runs.rows[0]?.tokens || 0,
    trustYes: trust.rows[0]?.yes || 0,
    trustNo: trust.rows[0]?.no || 0,
    eventsByType,
  };
}

export async function listUsers(range: RangeKey, q?: string) {
  const since = rangeToSince(range);
  const search = (q || '').trim().toLowerCase();

  const params: any[] = [since];
  let where = '';
  if (search) {
    params.push(`%${search}%`);
    where = `WHERE LOWER(u.email) LIKE $2 OR LOWER(COALESCE(u.handle,'')) LIKE $2 OR LOWER(COALESCE(u.name,'')) LIKE $2`;
  }

  const sql = `
  SELECT
    u.id,
    u.email,
    u.handle,
    u.name,
    u."profileCompleted",
    u."createdAt",
    (i.id IS NOT NULL) AS "hasIdentity",
    MAX(mr."createdAt") AS "lastMirrorAt",
    COUNT(mr.id)::int AS "mirrorRuns",
    COALESCE(SUM(COALESCE(mr."tokensIn",0)+COALESCE(mr."tokensOut",0)),0)::int AS "tokens"
  FROM "User" u
  LEFT JOIN "identities" i ON i."userId" = u.id
  LEFT JOIN "identity_versions" iv ON iv."identityId" = i.id
  LEFT JOIN "mirror_runs" mr ON mr."identityVersionId" = iv.id AND mr."createdAt" >= $1
  ${where}
  GROUP BY u.id, i.id
  ORDER BY "mirrorRuns" DESC, u."createdAt" DESC
  LIMIT 200
  `;

  const result = await db.query(sql, params);
  return { range, since, rows: result.rows };
}

export async function getUserDetail(userId: string) {
  const user = await db.query(`SELECT id, email, handle, name, "profileCompleted", "timeZone", "createdAt" FROM "User" WHERE id=$1`, [userId]);

  const identity = await db.query(
    `
    SELECT i.*, iv."identityJson", iv.version AS "activeVersion"
    FROM "identities" i
    LEFT JOIN "identity_versions" iv ON iv.id = i."activeVersionId"
    WHERE i."userId" = $1
    `,
    [userId]
  );

  // Get all identity versions for this user
  const identityVersions = await db.query(
    `
    SELECT iv.id, iv.version, iv.status, iv."createdAt", iv."identityJson"
    FROM "identity_versions" iv
    JOIN "identities" i ON i.id = iv."identityId"
    WHERE i."userId" = $1
    ORDER BY iv."createdAt" DESC
    `,
    [userId]
  );

  // Get extension tokens for this user
  const extensionTokens = await db.query(
    `
    SELECT id, label, scopes, "createdAt", "lastUsedAt", "revokedAt"
    FROM "extension_tokens"
    WHERE "userId" = $1
    ORDER BY "createdAt" DESC
    `,
    [userId]
  );

  const runs = await db.query(
    `
    SELECT
      mr.id, mr.context, mr."incomingMessage", mr."outputReply", mr.model, 
      mr."tokensIn", mr."tokensOut", mr."createdAt",
      mr."platform", mr."decisionAction", mr."decisionReason", 
      mr."validatorStatus", mr."validatorViolations", mr."latencyMs",
      te.event AS "confirmEvent", te.note AS "confirmNote", te."createdAt" AS "confirmAt"
    FROM "mirror_runs" mr
    JOIN "identity_versions" iv ON iv.id = mr."identityVersionId"
    JOIN "identities" i ON i.id = iv."identityId"
    LEFT JOIN LATERAL (
      SELECT event, note, "createdAt"
      FROM "trust_events"
      WHERE "mirrorRunId" = mr.id AND event IN ('confirm_yes','confirm_no')
      ORDER BY "createdAt" DESC
      LIMIT 1
    ) te ON true
    WHERE i."userId" = $1
    ORDER BY mr."createdAt" DESC
    LIMIT 100
    `,
    [userId]
  );

  const events = await db.query(
    `SELECT id, type, meta, "createdAt" FROM "Event" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 200`,
    [userId]
  );

  return {
    user: user.rows[0] || null,
    identity: identity.rows[0] || null,
    identityVersions: identityVersions.rows,
    extensionTokens: extensionTokens.rows,
    runs: runs.rows,
    events: events.rows,
  };
}

/**
 * A1: Error Tracking - Get error logs from database
 */
export async function getErrorLogs(range: RangeKey, severity?: string, limit: number = 100) {
  const since = rangeToSince(range);
  const params: any[] = [since, limit];

  let severityFilter = '';
  if (severity) {
    params.push(severity);
    severityFilter = `AND severity = $3`;
  }

  // Get error logs
  const errors = await db.query(
    `
    SELECT
      id, message, stack, source, severity, "userId", meta, "createdAt"
    FROM "error_logs"
    WHERE "createdAt" >= $1 ${severityFilter}
    ORDER BY "createdAt" DESC
    LIMIT $2
    `,
    params
  );

  // Get error summary by severity
  const summary = await db.query(
    `
    SELECT
      severity,
      COUNT(*)::int AS count
    FROM "error_logs"
    WHERE "createdAt" >= $1
    GROUP BY severity
    ORDER BY count DESC
    `,
    [since]
  );

  // Get error trends (grouped by hour for last 24h, by day for longer periods)
  const trends = await db.query(
    `
    SELECT
      DATE_TRUNC('hour', "createdAt") AS time_bucket,
      COUNT(*)::int AS count,
      severity
    FROM "error_logs"
    WHERE "createdAt" >= $1
    GROUP BY time_bucket, severity
    ORDER BY time_bucket DESC
    LIMIT 168
    `,
    [since]
  );

  // Get top error messages (grouped)
  const topErrors = await db.query(
    `
    SELECT
      message,
      source,
      severity,
      COUNT(*)::int AS occurrences,
      MAX("createdAt") AS "lastOccurrence"
    FROM "error_logs"
    WHERE "createdAt" >= $1
    GROUP BY message, source, severity
    ORDER BY occurrences DESC
    LIMIT 20
    `,
    [since]
  );

  return {
    range,
    since,
    errors: errors.rows,
    summary: summary.rows.reduce((acc: Record<string, number>, row: any) => {
      acc[row.severity] = row.count;
      return acc;
    }, {}),
    trends: trends.rows,
    topErrors: topErrors.rows,
    totalCount: errors.rows.length,
  };
}

/**
 * A1: Log an error to the database
 */
export async function logError(error: {
  message: string;
  stack?: string;
  source: string;
  severity: 'error' | 'warning' | 'critical' | 'info';
  userId?: string;
  meta?: any;
}) {
  await db.query(
    `
    INSERT INTO "error_logs" (message, stack, source, severity, "userId", meta)
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [error.message, error.stack, error.source, error.severity, error.userId, JSON.stringify(error.meta || {})]
  );
}

/**
 * A2: Performance Monitoring - Get historical performance metrics
 */
export async function getPerformanceMetrics(range: RangeKey) {
  const since = rangeToSince(range);

  // Get aggregate metrics from mirror_runs (which tracks latency)
  const latencyStats = await db.query(
    `
    SELECT
      COUNT(*)::int AS total_requests,
      AVG("latencyMs")::int AS avg_latency,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "latencyMs")::int AS p50,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "latencyMs")::int AS p95,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY "latencyMs")::int AS p99,
      MAX("latencyMs")::int AS max_latency,
      MIN("latencyMs")::int AS min_latency,
      COUNT(CASE WHEN "latencyMs" > 2000 THEN 1 END)::int AS slow_requests,
      COUNT(CASE WHEN "latencyMs" > 5000 THEN 1 END)::int AS very_slow_requests
    FROM "mirror_runs"
    WHERE "createdAt" >= $1 AND "latencyMs" IS NOT NULL
    `,
    [since]
  );

  // Get latency by model
  const latencyByModel = await db.query(
    `
    SELECT
      model,
      COUNT(*)::int AS requests,
      AVG("latencyMs")::int AS avg_latency,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "latencyMs")::int AS p95
    FROM "mirror_runs"
    WHERE "createdAt" >= $1 AND "latencyMs" IS NOT NULL
    GROUP BY model
    ORDER BY requests DESC
    `,
    [since]
  );

  // Get latency trends over time
  const latencyTrends = await db.query(
    `
    SELECT
      DATE_TRUNC('hour', "createdAt") AS time_bucket,
      COUNT(*)::int AS requests,
      AVG("latencyMs")::int AS avg_latency,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "latencyMs")::int AS p95
    FROM "mirror_runs"
    WHERE "createdAt" >= $1 AND "latencyMs" IS NOT NULL
    GROUP BY time_bucket
    ORDER BY time_bucket DESC
    LIMIT 168
    `,
    [since]
  );

  // Get database query performance (from events if tracked)
  const dbPerformance = await db.query(
    `
    SELECT
      COUNT(*)::int AS total_queries,
      AVG((meta->>'queryTimeMs')::int)::int AS avg_query_time
    FROM "Event"
    WHERE "createdAt" >= $1
      AND type = 'db_query'
      AND meta->>'queryTimeMs' IS NOT NULL
    `,
    [since]
  );

  // Get error rate
  const errorRate = await db.query(
    `
    SELECT
      COUNT(*)::int AS total,
      COUNT(CASE WHEN "validatorStatus" = 'failed' OR "decisionAction" = 'error' THEN 1 END)::int AS errors
    FROM "mirror_runs"
    WHERE "createdAt" >= $1
    `,
    [since]
  );

  const stats = latencyStats.rows[0] || {};
  const errors = errorRate.rows[0] || { total: 0, errors: 0 };

  return {
    range,
    since,
    latency: {
      total: stats.total_requests || 0,
      avg: stats.avg_latency || 0,
      p50: stats.p50 || 0,
      p95: stats.p95 || 0,
      p99: stats.p99 || 0,
      max: stats.max_latency || 0,
      min: stats.min_latency || 0,
      slowRequests: stats.slow_requests || 0,
      verySlowRequests: stats.very_slow_requests || 0,
    },
    byModel: latencyByModel.rows,
    trends: latencyTrends.rows,
    database: {
      totalQueries: dbPerformance.rows[0]?.total_queries || 0,
      avgQueryTime: dbPerformance.rows[0]?.avg_query_time || 0,
    },
    errorRate: errors.total > 0 ? ((errors.errors / errors.total) * 100).toFixed(2) : '0.00',
  };
}

/**
 * A3: Business Metrics Dashboard - Get KPIs and business analytics
 */
export async function getBusinessMetrics(range: RangeKey) {
  const since = rangeToSince(range);

  // Calculate previous period for comparison
  const rangeDays = range === 'today' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const previousSince = new Date(since.getTime() - rangeDays * 24 * 60 * 60 * 1000);

  // Get user metrics
  const userMetrics = await db.query(
    `
    SELECT
      COUNT(*)::int AS total_users,
      COUNT(CASE WHEN "createdAt" >= $1 THEN 1 END)::int AS new_users,
      COUNT(CASE WHEN "profileCompleted" = true THEN 1 END)::int AS completed_profiles,
      COUNT(CASE WHEN "planTier" != 'free' AND "planTier" IS NOT NULL THEN 1 END)::int AS paid_users
    FROM "User"
    `,
    [since]
  );

  // Get previous period user metrics for comparison
  const prevUserMetrics = await db.query(
    `
    SELECT COUNT(*)::int AS new_users
    FROM "User"
    WHERE "createdAt" >= $1 AND "createdAt" < $2
    `,
    [previousSince, since]
  );

  // Get daily active creators (users with mirror runs)
  const activeCreators = await db.query(
    `
    SELECT COUNT(DISTINCT i."userId")::int AS daily_active
    FROM "mirror_runs" mr
    JOIN "identity_versions" iv ON iv.id = mr."identityVersionId"
    JOIN "identities" i ON i.id = iv."identityId"
    WHERE mr."createdAt" >= $1
    `,
    [since]
  );

  // Get revenue metrics (from stripe_payments if exists)
  const revenueMetrics = await db.query(
    `
    SELECT
      COALESCE(SUM(amount), 0)::int AS total_revenue,
      COALESCE(SUM("platformFeeCents"), 0)::int AS platform_revenue,
      COALESCE(SUM("creatorEarningsCents"), 0)::int AS creator_earnings,
      COUNT(*)::int AS total_transactions,
      COUNT(CASE WHEN type = 'subscription' THEN 1 END)::int AS subscription_count,
      COUNT(CASE WHEN type = 'pay_per_chat' THEN 1 END)::int AS pay_per_chat_count
    FROM "stripe_payments"
    WHERE "createdAt" >= $1 AND status = 'succeeded'
    `,
    [since]
  );

  // Get MRR (Monthly Recurring Revenue) - from active subscriptions
  const mrrMetrics = await db.query(
    `
    SELECT
      COUNT(*)::int AS active_subscriptions,
      COALESCE(SUM(
        CASE
          WHEN "planTier" = 'starter' THEN 4900
          WHEN "planTier" = 'growth' THEN 14900
          WHEN "planTier" = 'scale' THEN 49900
          ELSE 0
        END
      ), 0)::int AS mrr_cents
    FROM "User"
    WHERE "planTier" IN ('starter', 'growth', 'scale')
      AND "stripeSubscriptionId" IS NOT NULL
    `
  );

  // Get conversion rates
  const conversionMetrics = await db.query(
    `
    SELECT
      COUNT(*)::int AS total_signups,
      COUNT(CASE WHEN "profileCompleted" = true THEN 1 END)::int AS completed_onboarding,
      COUNT(CASE WHEN "planTier" != 'free' AND "planTier" IS NOT NULL THEN 1 END)::int AS converted_to_paid
    FROM "User"
    WHERE "createdAt" >= $1
    `,
    [since]
  );

  // Get churn - users who had paid plan but downgraded
  const churnMetrics = await db.query(
    `
    SELECT COUNT(*)::int AS churned
    FROM "User"
    WHERE "planTier" = 'free'
      AND "stripeSubscriptionId" IS NOT NULL
      AND "updatedAt" >= $1
    `,
    [since]
  );

  // Get engagement metrics
  const engagementMetrics = await db.query(
    `
    SELECT
      COUNT(*)::int AS total_chats,
      COALESCE(SUM(COALESCE("tokensIn", 0) + COALESCE("tokensOut", 0)), 0)::int AS total_tokens,
      AVG("latencyMs")::int AS avg_response_time
    FROM "mirror_runs"
    WHERE "createdAt" >= $1
    `,
    [since]
  );

  // Get satisfaction metrics
  const satisfactionMetrics = await db.query(
    `
    SELECT
      COUNT(CASE WHEN event = 'confirm_yes' THEN 1 END)::int AS positive,
      COUNT(CASE WHEN event = 'confirm_no' THEN 1 END)::int AS negative
    FROM "trust_events"
    WHERE "createdAt" >= $1
    `,
    [since]
  );

  // Get user acquisition by source (from events)
  const acquisitionBySource = await db.query(
    `
    SELECT
      COALESCE(meta->>'source', 'direct') AS source,
      COUNT(*)::int AS count
    FROM "Event"
    WHERE type = 'signup' AND "createdAt" >= $1
    GROUP BY source
    ORDER BY count DESC
    LIMIT 10
    `,
    [since]
  );

  // Get plan distribution
  const planDistribution = await db.query(
    `
    SELECT
      COALESCE("planTier", 'free') AS plan,
      COUNT(*)::int AS count
    FROM "User"
    GROUP BY "planTier"
    ORDER BY count DESC
    `
  );

  // Calculate growth rate
  const currentUsers = userMetrics.rows[0]?.new_users || 0;
  const prevUsers = prevUserMetrics.rows[0]?.new_users || 0;
  const growthRate = prevUsers > 0 ? ((currentUsers - prevUsers) / prevUsers * 100).toFixed(1) : '0.0';

  // Calculate conversion rate
  const signups = conversionMetrics.rows[0]?.total_signups || 0;
  const converted = conversionMetrics.rows[0]?.converted_to_paid || 0;
  const conversionRate = signups > 0 ? ((converted / signups) * 100).toFixed(1) : '0.0';

  // Calculate churn rate
  const paidUsers = userMetrics.rows[0]?.paid_users || 0;
  const churned = churnMetrics.rows[0]?.churned || 0;
  const churnRate = paidUsers > 0 ? ((churned / paidUsers) * 100).toFixed(1) : '0.0';

  // Calculate ARPU (Average Revenue Per User)
  const totalRevenue = revenueMetrics.rows[0]?.total_revenue || 0;
  const totalUsers = userMetrics.rows[0]?.total_users || 1;
  const arpu = (totalRevenue / totalUsers / 100).toFixed(2);

  // Calculate satisfaction score
  const positive = satisfactionMetrics.rows[0]?.positive || 0;
  const negative = satisfactionMetrics.rows[0]?.negative || 0;
  const totalRatings = positive + negative;
  const satisfactionScore = totalRatings > 0 ? ((positive / totalRatings) * 100).toFixed(1) : '0.0';

  return {
    range,
    since,
    users: {
      total: userMetrics.rows[0]?.total_users || 0,
      new: currentUsers,
      previousPeriod: prevUsers,
      growthRate: `${growthRate}%`,
      completedProfiles: userMetrics.rows[0]?.completed_profiles || 0,
      paid: paidUsers,
      dailyActive: activeCreators.rows[0]?.daily_active || 0,
    },
    revenue: {
      total: revenueMetrics.rows[0]?.total_revenue || 0,
      platformRevenue: revenueMetrics.rows[0]?.platform_revenue || 0,
      creatorEarnings: revenueMetrics.rows[0]?.creator_earnings || 0,
      transactions: revenueMetrics.rows[0]?.total_transactions || 0,
      subscriptions: revenueMetrics.rows[0]?.subscription_count || 0,
      payPerChat: revenueMetrics.rows[0]?.pay_per_chat_count || 0,
      mrr: mrrMetrics.rows[0]?.mrr_cents || 0,
      activeSubscriptions: mrrMetrics.rows[0]?.active_subscriptions || 0,
      arpu: `$${arpu}`,
    },
    conversion: {
      signups,
      completedOnboarding: conversionMetrics.rows[0]?.completed_onboarding || 0,
      convertedToPaid: converted,
      rate: `${conversionRate}%`,
    },
    churn: {
      churned,
      rate: `${churnRate}%`,
    },
    engagement: {
      totalChats: engagementMetrics.rows[0]?.total_chats || 0,
      totalTokens: engagementMetrics.rows[0]?.total_tokens || 0,
      avgResponseTime: engagementMetrics.rows[0]?.avg_response_time || 0,
    },
    satisfaction: {
      positive,
      negative,
      score: `${satisfactionScore}%`,
      totalRatings,
    },
    acquisitionSources: acquisitionBySource.rows,
    planDistribution: planDistribution.rows,
  };
}