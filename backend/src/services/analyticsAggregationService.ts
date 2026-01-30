import { db } from '../config/database';

export async function getConversationCountsLast30Days(userId: string) {
  const r = await db.query(
    `SELECT date_trunc('day', "createdAt")::date as day, COUNT(*)::int as count
     FROM "chat_sessions"
     WHERE "creatorId"=$1 AND "createdAt" >= NOW() - INTERVAL '30 days'
     GROUP BY day
     ORDER BY day ASC`,
    [userId]
  );
  return r.rows.map((row: any) => ({
    date: row.day,
    count: row.count,
  }));
}

export async function getTopQuestionsForPeriod(userId: string, days = 30) {
  const r = await db.query(
    `SELECT cm."content", COUNT(*)::int AS count
     FROM "chat_messages" cm
     JOIN "chat_sessions" cs ON cs.id = cm."sessionId"
     WHERE cs."creatorId"=$1
       AND cm."role"='user'
       AND cm."createdAt" >= NOW() - ($2 || ' days')::interval
     GROUP BY cm."content"
     ORDER BY count DESC
     LIMIT 10`,
    [userId, String(days)]
  );
  return r.rows;
}

