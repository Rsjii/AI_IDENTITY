import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../config/database';
import { logger } from '../../config/logger';

/**
 * Get all conversations for the authenticated user
 * Query params: filter (all|paid|free), search, limit, offset
 */
export async function getUserConversations(req: any, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const filter = (req.query.filter as string) || 'all';
  const search = (req.query.search as string) || '';
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;

  try {
    // IMPORTANT: support both schemas (viewerUserId and userId)
    let whereClause = 'WHERE COALESCE(cs."viewerUserId", cs."userId") = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    // Apply filter
    if (filter === 'paid') {
      whereClause += ` AND sp.amount IS NOT NULL`;
    } else if (filter === 'free') {
      whereClause += ` AND sp.amount IS NULL`;
    } else if (filter === 'favorites') {
      whereClause += ` AND cs."isFavorite" = true`;
    }

    // Apply search
    if (search.trim()) {
      whereClause += ` AND (u.name ILIKE $${paramIndex} OR u.handle ILIKE $${paramIndex} OR cm.content ILIKE $${paramIndex})`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const query = `
      SELECT
        cs.id AS "sessionId",
        cs."createdAt",
        cs."updatedAt",
        cs."isFavorite",
        cs."isArchived",
        cs."sessionTitle",
        u.id AS "creatorId",
        u.name AS "creatorName",
        u.handle AS "creatorHandle",
        u."profileImage" AS "creatorAvatar",
        (SELECT content FROM chat_messages WHERE "sessionId" = cs.id ORDER BY "createdAt" DESC LIMIT 1) AS "lastMessage",
        (SELECT "createdAt" FROM chat_messages WHERE "sessionId" = cs.id ORDER BY "createdAt" DESC LIMIT 1) AS "lastMessageAt",
        (SELECT COUNT(*)::int FROM chat_messages WHERE "sessionId" = cs.id) AS "messageCount",
        sp.amount AS "paymentAmount",
        CASE WHEN sp.amount IS NOT NULL THEN 'paid' ELSE 'free' END AS "paymentTier",
        CASE WHEN sp.amount IS NOT NULL THEN true ELSE false END AS "isPaid"
      FROM chat_sessions cs
      LEFT JOIN "User" u ON u.id = cs."creatorId"
      -- Pick latest succeeded pay_per_chat payment for this session (stripe_payments is the real source)
      LEFT JOIN LATERAL (
        SELECT amount, "createdAt"
        FROM "stripe_payments"
        WHERE "sessionId" = cs.id
          AND status = 'succeeded'
          AND type = 'pay_per_chat'
        ORDER BY "createdAt" DESC
        LIMIT 1
      ) sp ON true
      LEFT JOIN chat_messages cm ON cm."sessionId" = cs.id
      ${whereClause}
      GROUP BY cs.id, u.id, u.name, u.handle, u."profileImage", sp.amount
      ORDER BY COALESCE(
        (SELECT "createdAt" FROM chat_messages WHERE "sessionId" = cs.id ORDER BY "createdAt" DESC LIMIT 1),
        cs."updatedAt",
        cs."createdAt"
      ) DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await db.query(query, params);

    return res.json({
      success: true,
      conversations: result.rows.map(row => ({
        sessionId: row.sessionId,
        creatorId: row.creatorId,
        creatorName: row.creatorName || row.creatorHandle || 'Unknown',
        creatorHandle: row.creatorHandle,
        creatorAvatar: row.creatorAvatar,
        lastMessage: row.lastMessage ? truncateText(row.lastMessage, 100) : 'No messages yet',
        lastMessageAt: row.lastMessageAt || row.createdAt,
        messageCount: row.messageCount || 0,
        paymentTier: row.paymentTier || 'free',
        paymentAmount: row.paymentAmount || 0,
        isPaid: row.isPaid || false,
        isFavorite: row.isFavorite || false,
        isArchived: row.isArchived || false,
        sessionTitle: row.sessionTitle || null,
        createdAt: row.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Error fetching user conversations:', error);
    return res.status(500).json({ error: 'Failed to fetch conversations' });
  }
}

/**
 * Get session statistics
 */
export async function getSessionStats(req: any, res: Response) {
  const userId = req.user?.id;
  const { sessionId } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID required' });
  }

  try {
    const query = `
      SELECT
        cs.id,
        cs."createdAt",
        cs."updatedAt",
        (SELECT COUNT(*)::int FROM chat_messages WHERE "sessionId" = cs.id AND role='user') AS "messageCount",
        sp.amount AS "paymentAmount",
        CASE WHEN sp.amount IS NOT NULL THEN 'paid' ELSE 'free' END AS "paymentTier",
        sp."createdAt" AS "paidAt",
        CASE WHEN sp.amount IS NOT NULL THEN 'paid' ELSE 'free' END AS "paymentStatus"
      FROM chat_sessions cs
      LEFT JOIN LATERAL (
        SELECT amount, "createdAt"
        FROM "stripe_payments"
        WHERE "sessionId" = cs.id AND status='succeeded' AND type='pay_per_chat'
        ORDER BY "createdAt" DESC
        LIMIT 1
      ) sp ON true
      WHERE cs.id = $1 AND COALESCE(cs."viewerUserId", cs."userId") = $2
      LIMIT 1
    `;

    const result = await db.query(query, [sessionId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const stats = result.rows[0];

    return res.json({
      success: true,
      sessionId: stats.id,
      messageCount: stats.messageCount || 0,
      createdAt: stats.createdAt,
      lastActivityAt: stats.updatedAt,
      paymentStatus: stats.paymentStatus,
      tier: stats.paymentTier || 'free',
      amountPaid: stats.paymentAmount || 0,
      paidAt: stats.paidAt || null,
    });
  } catch (error) {
    logger.error('Error fetching session stats:', error);
    return res.status(500).json({ error: 'Failed to fetch session statistics' });
  }
}

/**
 * Update conversation (favorite, archive, title)
 */
const updateConversationSchema = z.object({
  isFavorite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  sessionTitle: z.string().max(255).optional(),
});

export async function updateConversation(req: any, res: Response) {
  const userId = req.user?.id;
  const { sessionId } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const updates = updateConversationSchema.parse(req.body);

    // Verify ownership
    const verifyResult = await db.query(
      'SELECT id FROM chat_sessions WHERE id = $1 AND COALESCE("viewerUserId","userId") = $2',
      [sessionId, userId]
    );

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.isFavorite !== undefined) {
      updateFields.push(`"isFavorite" = $${paramIndex}`);
      params.push(updates.isFavorite);
      paramIndex++;
    }

    if (updates.isArchived !== undefined) {
      updateFields.push(`"isArchived" = $${paramIndex}`);
      params.push(updates.isArchived);
      paramIndex++;
    }

    if (updates.sessionTitle !== undefined) {
      updateFields.push(`"sessionTitle" = $${paramIndex}`);
      params.push(updates.sessionTitle);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateFields.push(`"updatedAt" = NOW()`);

    params.push(sessionId);
    const updateQuery = `
      UPDATE chat_sessions
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, "isFavorite", "isArchived", "sessionTitle"
    `;

    const result = await db.query(updateQuery, params);

    return res.json({
      success: true,
      session: result.rows[0],
    });
  } catch (error) {
    logger.error('Error updating conversation:', error);
    return res.status(500).json({ error: 'Failed to update conversation' });
  }
}

/**
 * Delete conversation
 */
export async function deleteConversation(req: any, res: Response) {
  const userId = req.user?.id;
  const { sessionId } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Verify ownership before deleting
    const verifyResult = await db.query(
      'SELECT id FROM chat_sessions WHERE id = $1 AND COALESCE("viewerUserId","userId") = $2',
      [sessionId, userId]
    );

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Delete messages first (cascade should handle this, but being explicit)
    await db.query('DELETE FROM chat_messages WHERE "sessionId" = $1', [sessionId]);

    // Delete session
    await db.query('DELETE FROM chat_sessions WHERE id = $1', [sessionId]);

    return res.json({
      success: true,
      message: 'Conversation deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting conversation:', error);
    return res.status(500).json({ error: 'Failed to delete conversation' });
  }
}

/**
 * Export conversation as JSON/TXT
 */
export async function exportConversation(req: any, res: Response) {
  const userId = req.user?.id;
  const { sessionId } = req.params;
  const format = (req.query.format as string) || 'json';

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Verify ownership
    const sessionResult = await db.query(
      `SELECT cs.id, cs."createdAt", u.name AS "creatorName", u.handle AS "creatorHandle"
       FROM chat_sessions cs
       LEFT JOIN "User" u ON u.id = cs."creatorId"
       WHERE cs.id = $1 AND COALESCE(cs."viewerUserId", cs."userId") = $2`,
      [sessionId, userId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Get all messages
    const messagesResult = await db.query(
      `SELECT role, content, "createdAt"
       FROM chat_messages
       WHERE "sessionId" = $1
       ORDER BY "createdAt" ASC`,
      [sessionId]
    );

    const messages = messagesResult.rows;

    if (format === 'txt') {
      // Export as plain text
      const creatorName = session.creatorName || session.creatorHandle;
      let txt = `Conversation with ${creatorName}\n`;
      txt += `Date: ${new Date(session.createdAt).toLocaleString()}\n`;
      txt += `\n${'='.repeat(60)}\n\n`;

      messages.forEach((msg: any) => {
        const role = msg.role === 'user' ? 'You' : creatorName;
        const timestamp = new Date(msg.createdAt).toLocaleTimeString();
        txt += `[${timestamp}] ${role}:\n${msg.content}\n\n`;
      });

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="conversation-${sessionId}.txt"`);
      return res.send(txt);
    } else {
      // Export as JSON (default)
      const exportData = {
        sessionId,
        creatorName: session.creatorName || session.creatorHandle,
        createdAt: session.createdAt,
        messages: messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.createdAt,
        })),
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="conversation-${sessionId}.json"`);
      return res.json(exportData);
    }
  } catch (error) {
    logger.error('Error exporting conversation:', error);
    return res.status(500).json({ error: 'Failed to export conversation' });
  }
}

/**
 * Get user spending statistics
 */
export async function getUserSpendingStats(req: any, res: Response) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get total spending from stripe_payments (real source)
    const totalResult = await db.query(
      `SELECT
        COALESCE(SUM(amount), 0)::int AS "totalSpentCents",
        COALESCE(SUM(CASE WHEN "createdAt" >= date_trunc('month', now()) THEN amount ELSE 0 END), 0)::int AS "monthlySpentCents"
       FROM "stripe_payments"
       WHERE "payerUserId" = $1 AND status='succeeded' AND type='pay_per_chat'`,
      [userId]
    );

    // Get top creators by spending
    const topCreatorsResult = await db.query(
      `SELECT
        u.id AS "creatorId",
        u.name AS "creatorName",
        u.handle AS "creatorHandle",
        u."profileImage" AS "creatorAvatar",
        COALESCE(SUM(sp.amount), 0)::int AS "totalSpent",
        COUNT(DISTINCT sp."sessionId")::int AS "sessionCount"
       FROM "stripe_payments" sp
       LEFT JOIN "User" u ON u.id = sp."creatorId"
       WHERE sp."payerUserId" = $1 AND sp.status='succeeded' AND sp.type='pay_per_chat'
       GROUP BY u.id, u.name, u.handle, u."profileImage"
       ORDER BY "totalSpent" DESC
       LIMIT 10`,
      [userId]
    );

    const stats = totalResult.rows[0] || { totalSpentCents: 0, monthlySpentCents: 0 };

    return res.json({
      success: true,
      totalSpentCents: stats.totalSpentCents,
      monthlySpentCents: stats.monthlySpentCents,
      topCreators: topCreatorsResult.rows.map((row: any) => ({
        creatorId: row.creatorId,
        name: row.creatorName || row.creatorHandle || 'Unknown',
        handle: row.creatorHandle,
        avatar: row.creatorAvatar,
        amount: row.totalSpent,
        sessionCount: row.sessionCount,
      })),
    });
  } catch (error) {
    logger.error('Error fetching user spending stats:', error);
    return res.status(500).json({ error: 'Failed to fetch spending statistics' });
  }
}

/**
 * Check message limit for a session
 */
export async function checkMessageLimit(req: any, res: Response) {
  const userId = req.user?.id;
  const { sessionId } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Verify session belongs to viewer + fetch creator + pricing
    const sessionResult = await db.query(
      `SELECT cs."creatorId", u."priceConfig"
       FROM chat_sessions cs
       LEFT JOIN "User" u ON u.id = cs."creatorId"
       WHERE cs.id = $1 AND COALESCE(cs."viewerUserId", cs."userId") = $2
       LIMIT 1`,
      [sessionId, userId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Premium session (real unlock source)
    const premium = await db.query(
      `SELECT 1 FROM "premium_sessions" WHERE "sessionId"=$1 AND "expiresAt" > CURRENT_TIMESTAMP LIMIT 1`,
      [sessionId]
    );
    const isUnlimited = premium.rowCount > 0;
    if (isUnlimited) {
      return res.json({ success: true, canSendMessage: true, isUnlimited: true, requiresPayment: false });
    }

    // Count messages in session
    const messageCountResult = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM chat_messages
       WHERE "sessionId" = $1 AND role = 'user'`,
      [sessionId]
    );

    const messagesUsed = messageCountResult.rows[0]?.count || 0;
    const FREE_MESSAGE_LIMIT = 3;
    const remainingFreeMessages = Math.max(0, FREE_MESSAGE_LIMIT - messagesUsed);
    const canSendMessage = messagesUsed < FREE_MESSAGE_LIMIT;

    const priceConfig = sessionResult.rows[0]?.priceConfig || {};
    const creatorId = sessionResult.rows[0]?.creatorId;

    const tiers = Array.isArray(priceConfig.payPerChatTiers) ? priceConfig.payPerChatTiers : [100, 500, 1000, 2500, 5000];
    const preferred = Number(priceConfig.defaultTierCents || 0);
    const defaultAmount = tiers.includes(preferred) ? preferred : tiers[0];

    const suggestedTiers = tiers.map((amount: number) => ({
      amount,
      label: `$${(amount / 100).toFixed(2)}`,
    }));

    return res.json({
      success: true,
      creatorId, // IMPORTANT for frontend paywall
      canSendMessage,
      isUnlimited: false,
      requiresPayment: !canSendMessage,
      remainingFreeMessages,
      freeMessageLimit: FREE_MESSAGE_LIMIT,
      messagesUsed,
      suggestedTiers,
      paymentOptions: { tiers: suggestedTiers, defaultAmount }, // IMPORTANT for PaymentPrompt
    });
  } catch (error) {
    logger.error('Error checking message limit:', error);
    return res.status(500).json({ error: 'Failed to check message limit' });
  }
}

/**
 * Export user spending as CSV
 */
export async function exportUserSpendingCSV(req: any, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const r = await db.query(
      `SELECT
        sp."createdAt",
        sp.amount,
        sp.status,
        sp.type,
        sp."stripePaymentIntentId",
        sp."sessionId",
        u.name AS "creatorName",
        u.handle AS "creatorHandle"
       FROM "stripe_payments" sp
       LEFT JOIN "User" u ON u.id = sp."creatorId"
       WHERE sp."payerUserId"=$1 AND sp.status='succeeded' AND sp.type='pay_per_chat'
       ORDER BY sp."createdAt" DESC`,
      [userId]
    );

    const headers = ['Date', 'Creator', 'Amount ($)', 'Status', 'Type', 'Session ID', 'Payment ID'];
    const rows = r.rows.map((p: any) => [
      new Date(p.createdAt).toISOString(),
      p.creatorName || p.creatorHandle || '',
      (p.amount / 100).toFixed(2),
      p.status,
      p.type,
      p.sessionId || '',
      p.stripePaymentIntentId || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row: any[]) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="spending-${new Date().toISOString().split('T')[0]}.csv"`);
    return res.send(csv);
  } catch (error) {
    logger.error('Error exporting user spending:', error);
    return res.status(500).json({ error: 'Failed to export spending history' });
  }
}

// Helper function
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
