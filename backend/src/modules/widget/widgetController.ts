import { Request, Response } from 'express';
import { z } from 'zod';
import { detokenizeId } from '../../utils/idTokenization';
import { generateMirrorReplyWithLogging } from '../identity/identityService';
import { widgetChatLogQueries, voiceCloneQueries } from '../../config/database';
import { generateVoiceAudio } from '../voice/voiceService';
import { logger } from '../../config/logger';

const chatSchema = z.object({
  creatorId: z.string().min(1), // tokenized preferred
  message: z.string().min(1),
  voiceEnabled: z.boolean().optional().default(false),
  visitorId: z.string().optional(), // For chat history tracking
});

export async function widgetChat(req: Request, res: Response) {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });

  const { creatorId, message, voiceEnabled, visitorId } = parsed.data;

  // Accept tokenized id (v2....) OR raw id (dev)
  const detok = detokenizeId(creatorId, { endpoint: '/api/widget/chat' });
  const creatorUserId = detok?.id || creatorId;

  // Generate visitorId if not provided (for chat history tracking)
  const finalVisitorId = visitorId || `widget_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const result = await generateMirrorReplyWithLogging(creatorUserId, 'widget', message, { 
    platform: 'api',
    visitorId: finalVisitorId,
  });

  await widgetChatLogQueries.create(creatorUserId, null, message, result.reply || '');

  let audioUrl: string | null = null;

  // Generate voice if enabled and reply exists
  if (voiceEnabled && result.reply) {
    try {
      // Get user's default voice
      const voices = await voiceCloneQueries.findByUserId(creatorUserId);
      const defaultVoice = voices.find((v: any) => v.status === 'ready');

      if (defaultVoice) {
        audioUrl = await generateVoiceAudio(creatorUserId, defaultVoice.id, result.reply);
        logger.info(`[Widget] Generated voice reply for ${creatorUserId}`);
      }
    } catch (error: any) {
      logger.error('[Widget] Voice generation failed:', error);
      // Continue without voice
    }
  }

  return res.json({
    success: true,
    reply: result.reply,
    mirrorRunId: result.mirrorRunId,
    audioUrl,
  });
}

export async function widgetCode(req: Request, res: Response) {
  const creatorId = String(req.params.creatorId || '');
  const apiBase = `${req.protocol}://${req.get('host')}`;

  // Returns copy-paste snippet
  return res.type('text/plain').send(
`<!-- Selflyx Widget -->
<link rel="stylesheet" href="${apiBase}/embed.css" />
<script src="${apiBase}/embed.js" data-api-base="${apiBase}" data-creator-id="${creatorId}"></script>`
  );
}

// ========== ANALYTICS ENDPOINTS ==========

export async function getWidgetAnalytics(req: Request, res: Response) {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { db } = await import('../../config/database');

    // Get total chats
    const totalResult = await db.query(
      `SELECT COUNT(*) as total FROM "widget_chat_logs" WHERE "userId" = $1`,
      [userId]
    );

    // Get chats today
    const todayResult = await db.query(
      `SELECT COUNT(*) as today FROM "widget_chat_logs"
       WHERE "userId" = $1 AND "createdAt" >= CURRENT_DATE`,
      [userId]
    );

    // Get chats this week
    const weekResult = await db.query(
      `SELECT COUNT(*) as week FROM "widget_chat_logs"
       WHERE "userId" = $1 AND "createdAt" >= CURRENT_DATE - INTERVAL '7 days'`,
      [userId]
    );

    // Get daily breakdown (last 7 days)
    const dailyResult = await db.query(
      `SELECT DATE("createdAt") as date, COUNT(*) as count
       FROM "widget_chat_logs"
       WHERE "userId" = $1 AND "createdAt" >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY DATE("createdAt")
       ORDER BY date DESC`,
      [userId]
    );

    return res.json({
      total: parseInt(totalResult.rows[0]?.total || '0'),
      today: parseInt(todayResult.rows[0]?.today || '0'),
      thisWeek: parseInt(weekResult.rows[0]?.week || '0'),
      daily: dailyResult.rows,
    });
  } catch (error: any) {
    logger.error('[Widget] Analytics error:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
}

