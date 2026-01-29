/**
 * Weekly Summary Email Service
 * Sends weekly summary emails to creators with their AI clone performance metrics
 */

import { db, userQueries, chatSessionQueries, chatMessageQueries, mirrorRunQueries, identityQueries, identityVersionQueries } from '../config/database';
import { EmailService } from '../modules/auth/authService';
import { logger } from '../config/logger';

const emailService = new EmailService();

interface WeeklyStats {
  totalChats: number;
  newChats: number;
  revenue: number;
  earnings: number;
  avgResponseTime: number;
  satisfaction: number;
  topQuestions: string[];
}

/**
 * Calculate weekly stats for a creator
 */
async function calculateWeeklyStats(userId: string): Promise<WeeklyStats> {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();

  // Get total chats (all time)
  const totalChatsResult = await db.query(
    `SELECT COUNT(*)::int AS count FROM "chat_sessions" WHERE "creatorId" = $1`,
    [userId]
  );
  const totalChats = totalChatsResult.rows[0]?.count || 0;

  // Get new chats this week
  const newChatsResult = await db.query(
    `SELECT COUNT(*)::int AS count 
     FROM "chat_sessions" 
     WHERE "creatorId" = $1 AND "createdAt" >= $2`,
    [userId, oneWeekAgo]
  );
  const newChats = newChatsResult.rows[0]?.count || 0;

  // Get revenue this week (from pay-per-chat)
  const revenueResult = await db.query(
    `SELECT COALESCE(SUM(amount), 0)::int AS total
     FROM "stripe_payments"
     WHERE "creatorId" = $1 
       AND "status" = 'succeeded'
       AND "type" = 'pay_per_chat'
       AND "createdAt" >= $2`,
    [userId, oneWeekAgo]
  );
  const revenue = revenueResult.rows[0]?.total || 0;
  const earnings = Math.floor(revenue * 0.75); // Creator gets 75%

  // Get average response time (from mirror_runs)
  const identity = await identityQueries.findByUserId(userId);
  let avgResponseTime = 0;
  if (identity?.activeVersionId) {
    const responseTimeResult = await db.query(
      `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM ("createdAt" - LAG("createdAt") OVER (ORDER BY "createdAt")))) * 1000), 0)::numeric AS avg_ms
       FROM "mirror_runs"
       WHERE "identityVersionId" = $1 
         AND "createdAt" >= $2
       LIMIT 100`,
      [identity.activeVersionId, oneWeekAgo]
    );
    avgResponseTime = parseFloat(responseTimeResult.rows[0]?.avg_ms || '0') || 2000; // Default 2s
  }

  // Get satisfaction rating (from trust_events)
  const satisfactionResult = await db.query(
    `SELECT COALESCE(AVG(CASE WHEN event = 'confirm_yes' THEN 1.0 WHEN event = 'confirm_no' THEN 0.0 END), 0.5)::numeric AS rating
     FROM "trust_events" te
     JOIN "mirror_runs" mr ON te."mirrorRunId" = mr.id
     WHERE mr."identityVersionId" = $1 
       AND te."createdAt" >= $2`,
    [identity?.activeVersionId || '', oneWeekAgo]
  );
  const satisfaction = parseFloat(satisfactionResult.rows[0]?.rating || '0.5') || 0.5;

  // Get top questions (most common user messages)
  const topQuestionsResult = await db.query(
    `SELECT cm.content, COUNT(*)::int AS count
     FROM "chat_messages" cm
     JOIN "chat_sessions" cs ON cm."sessionId" = cs.id
     WHERE cs."creatorId" = $1 
       AND cm.role = 'user'
       AND cm."createdAt" >= $2
     GROUP BY cm.content
     ORDER BY count DESC
     LIMIT 5`,
    [userId, oneWeekAgo]
  );
  const topQuestions = topQuestionsResult.rows.map((r: any) => r.content).filter((q: string) => q.length > 10);

  return {
    totalChats,
    newChats,
    revenue,
    earnings,
    avgResponseTime,
    satisfaction,
    topQuestions,
  };
}

/**
 * Send weekly summary to a single creator
 */
export async function sendWeeklySummaryToCreator(userId: string): Promise<boolean> {
  try {
    const user = await userQueries.findById(userId);
    if (!user || !user.email) {
      logger.warn(`Cannot send weekly summary: user ${userId} not found or no email`);
      return false;
    }

    // Check if user has opted out (future: add preference field)
    // For now, send to all active creators

    const stats = await calculateWeeklyStats(userId);

    // Only send if there's activity
    if (stats.newChats === 0 && stats.revenue === 0) {
      logger.info(`Skipping weekly summary for ${user.email}: no activity this week`);
      return false;
    }

    const sent = await emailService.sendWeeklySummary(user.email, stats);
    if (sent) {
      logger.info(`Weekly summary sent to ${user.email}`);
    } else {
      logger.error(`Failed to send weekly summary to ${user.email}`);
    }
    return sent;
  } catch (error: any) {
    logger.error(`Error sending weekly summary to user ${userId}:`, error);
    return false;
  }
}

/**
 * Send weekly summaries to all active creators
 * This should be called by a cron job (e.g., every Monday at 9 AM)
 */
export async function sendWeeklySummariesToAllCreators(): Promise<{ sent: number; failed: number }> {
  try {
    // Get all active creators (users with identities)
    const creatorsResult = await db.query(
      `SELECT DISTINCT u.id, u.email
       FROM "User" u
       JOIN identities i ON i."userId" = u.id
       WHERE u.active = true 
         AND u."emailVerified" = true
         AND i.status = 'active'
       ORDER BY u."createdAt" DESC`
    );

    const creators = creatorsResult.rows;
    logger.info(`Sending weekly summaries to ${creators.length} creators`);

    let sent = 0;
    let failed = 0;

    // Send in batches to avoid overwhelming the email service
    const batchSize = 10;
    for (let i = 0; i < creators.length; i += batchSize) {
      const batch = creators.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (creator: any) => {
          const success = await sendWeeklySummaryToCreator(creator.id);
          if (success) {
            sent++;
          } else {
            failed++;
          }
        })
      );

      // Small delay between batches
      if (i + batchSize < creators.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    logger.info(`Weekly summaries completed: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  } catch (error: any) {
    logger.error('Error sending weekly summaries to all creators:', error);
    return { sent: 0, failed: 0 };
  }
}


