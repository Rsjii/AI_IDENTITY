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

  return {
    range,
    since,
    usersTotal: usersTotal.rows[0]?.n || 0,
    usersNew: usersNew.rows[0]?.n || 0,
    mirrorRuns: runs.rows[0]?.runs || 0,
    tokens: runs.rows[0]?.tokens || 0,
    trustYes: trust.rows[0]?.yes || 0,
    trustNo: trust.rows[0]?.no || 0,
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

  const runs = await db.query(
    `
    SELECT
      mr.id, mr.context, mr."incomingMessage", mr."outputReply", mr.model, mr."tokensIn", mr."tokensOut", mr."createdAt",
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
    runs: runs.rows,
    events: events.rows,
  };
}