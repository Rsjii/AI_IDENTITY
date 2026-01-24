import { db } from '../../config/database';

export type RangeKey = 'today' | '7d' | '30d';

export function rangeToSince(range: RangeKey): Date {
  const now = new Date();
  if (range === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const days = range === '7d' ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function getHistoryOverview(userId: string, since: Date) {
  const runs = await db.query(
    `
    SELECT
      COUNT(*)::int AS runs,
      COALESCE(SUM(COALESCE(mr."tokensIn",0)+COALESCE(mr."tokensOut",0)),0)::int AS tokens
    FROM "mirror_runs" mr
    JOIN "identity_versions" iv ON iv.id = mr."identityVersionId"
    JOIN "identities" i ON i.id = iv."identityId"
    WHERE i."userId" = $1 AND mr."createdAt" >= $2
    `,
    [userId, since]
  );

  const trust = await db.query(
    `
    SELECT
      COALESCE(SUM(CASE WHEN te.event='confirm_yes' THEN 1 ELSE 0 END),0)::int AS yes,
      COALESCE(SUM(CASE WHEN te.event='confirm_no' THEN 1 ELSE 0 END),0)::int AS no
    FROM "trust_events" te
    JOIN "identity_versions" iv ON iv.id = te."identityVersionId"
    JOIN "identities" i ON i.id = iv."identityId"
    WHERE i."userId" = $1 AND te."createdAt" >= $2
    `,
    [userId, since]
  );

  return {
    runs: runs.rows[0]?.runs || 0,
    tokens: runs.rows[0]?.tokens || 0,
    yes: trust.rows[0]?.yes || 0,
    no: trust.rows[0]?.no || 0,
  };
}

export async function listMirrorRunsForUser(userId: string, since: Date, limit = 50, offset = 0) {
  const result = await db.query(
    `
    SELECT
      mr.id,
      mr.context,
      mr."incomingMessage",
      mr."outputReply",
      mr.model,
      mr."tokensIn",
      mr."tokensOut",
      mr."createdAt",
      te.event AS "confirmEvent",
      te.note AS "confirmNote",
      te."createdAt" AS "confirmAt"
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
    WHERE i."userId" = $1 AND mr."createdAt" >= $2
    ORDER BY mr."createdAt" DESC
    LIMIT $3 OFFSET $4
    `,
    [userId, since, limit, offset]
  );

  return result.rows;
}