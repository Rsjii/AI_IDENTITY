import { Request, Response } from 'express';
import { z } from 'zod';
import { detokenizeId } from '../../utils/idTokenization';
import { generateMirrorReplyWithLogging } from '../identity/identityService';
import {
  widgetChatLogQueries,
  voiceCloneQueries,
  db,
  chatSessionQueries,
  chatMessageQueries,
  premiumSessionQueries,
  userQueries,
} from '../../config/database';
import { generateVoiceAudio } from '../voice/voiceService';
import { logger } from '../../config/logger';
import { config } from '../../config/env';
import { isFeatureEnabled } from '../../config/featureFlags';

const chatSchema = z.object({
  creatorId: z.string().min(1), // tokenized preferred
  message: z.string().min(1),
  voiceEnabled: z.boolean().optional().default(false),
  visitorId: z.string().optional(), // For chat history tracking
});

// Plan tier limits (same as publicController.ts)
type PlanTier = 'free' | 'starter' | 'growth' | 'scale';
const PLAN_LIMITS: Record<PlanTier, number> = {
  free: 500,
  starter: 5000,
  growth: 25000,
  scale: Number.MAX_SAFE_INTEGER,
};

async function getUserPlan(userId: string): Promise<{ tier: PlanTier; trialActive: boolean }> {
  const r = await db.query(
    `SELECT "planTier","trialEndsAt" FROM "User" WHERE id=$1 LIMIT 1`,
    [userId]
  );
  const tier = (r.rows[0]?.planTier || 'free') as PlanTier;
  const trialEndsAt = r.rows[0]?.trialEndsAt ? new Date(r.rows[0].trialEndsAt) : null;
  const trialActive = !!(trialEndsAt && trialEndsAt.getTime() > Date.now());
  return { tier, trialActive };
}

async function countCreatorChatsThisMonth(creatorId: string): Promise<number> {
  const r = await db.query(
    `SELECT COUNT(*)::int AS c FROM "chat_sessions"
     WHERE "creatorId"=$1 AND "createdAt" >= date_trunc('month', now())`,
    [creatorId]
  );
  return r.rows[0]?.c || 0;
}

export async function widgetChat(req: Request, res: Response) {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });

  const { creatorId, message, voiceEnabled, visitorId } = parsed.data;

  // Accept tokenized id (v2....) OR raw id (dev)
  const detok = detokenizeId(creatorId, { endpoint: '/api/widget/chat' });
  const creatorUserId = detok?.id || creatorId;

  const creator = await userQueries.findById(creatorUserId);
  if (!creator || !creator.active) {
    return res.status(404).json({ error: 'Creator not found' });
  }

  // ✅ Check creator's plan limit (PHASE1 requirement - same as public chat)
  const { tier, trialActive } = await getUserPlan(creatorUserId);
  const effectiveTier: PlanTier = trialActive ? 'growth' : tier;
  const limit = PLAN_LIMITS[effectiveTier];
  const used = await countCreatorChatsThisMonth(creatorUserId);

  if (used >= limit) {
    return res.status(402).json({
      error: 'Creator plan limit reached',
      errorCode: 'CREATOR_PLAN_LIMIT',
      tier: effectiveTier,
      used,
      limit,
      upgradeUrl: '/pricing',
    });
  }

  // Generate visitorId if not provided (for chat history tracking)
  const finalVisitorId = visitorId || `widget_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // Reuse existing session per visitor (to avoid over-counting sessions for plan limits)
  let session;
  const existingSession = await db.query(
    `SELECT id FROM "chat_sessions"
     WHERE "creatorId"=$1 AND "visitorId"=$2 AND platform='widget'
     ORDER BY "createdAt" DESC
     LIMIT 1`,
    [creatorUserId, finalVisitorId]
  );

  if (existingSession.rows[0]) {
    session = { id: existingSession.rows[0].id };
  } else {
    // Create new session only if none exists for this visitor
    session = await chatSessionQueries.create({
      creatorId: creatorUserId,
      visitorId: finalVisitorId,
      userId: null,
      platform: 'widget',
    });
  }

  // Persist user message + compute gating decision (match public chat behavior)
  const FREE_MESSAGE_LIMIT = 3;
  const sessionMessages = await chatMessageQueries.countBySession(session.id);
  await chatMessageQueries.add({ sessionId: session.id, role: 'user', content: message });

  // ✅ Feature flag check: pay-per-chat only if globally enabled
  const payPerChatAllowed = isFeatureEnabled('ENABLE_PAY_PER_CHAT') && isFeatureEnabled('ENABLE_PAYMENTS');
  const voiceAllowed = isFeatureEnabled('ENABLE_VOICE');

  const hasPremiumSession = await premiumSessionQueries.isSessionPremium(session.id);
  const enablePayments = (creator.priceConfig as any)?.enablePayments === true;

  if (payPerChatAllowed && enablePayments && !hasPremiumSession) {
    const recentMessages = await chatMessageQueries.listForSession(session.id);
    const conversationContext = recentMessages
      .filter((m: any) => m.role === 'user')
      .slice(-5)
      .map((m: any) => m.content);

    const triggerRules = (creator.priceConfig as any)?.paymentTriggerRules || {};
    const { shouldRequirePayment: intelligentPricing } = await import('../identity/intelligentPricing');
    const intelligentDecision = intelligentPricing(message, conversationContext, creator.priceConfig);

    const shouldRequirePayment =
      sessionMessages >= FREE_MESSAGE_LIMIT || // Always after free limit
      triggerRules.alwaysRequire === true || // Creator set always require
      intelligentDecision.requiresPayment || // Intelligent detection
      (triggerRules.keywords?.length > 0 && triggerRules.keywords.some((kw: string) =>
        message.toLowerCase().includes(kw.toLowerCase())
      )) || // Keyword match
      (triggerRules.minLength > 0 && message.length >= triggerRules.minLength); // Length threshold

    if (shouldRequirePayment) {
      const frontendUrl = config.frontendUrl || `${req.protocol}://${req.get('host')}`;
      const slug = (creator as any).publicSlug || creator.handle || creatorUserId;
      const upgradeUrl = `${frontendUrl}/chat/${slug}?upgrade=1`;

      await widgetChatLogQueries.create(creatorUserId, null, message, '');

      return res.json({
        success: true,
        requiresPayment: true,
        upgradeUrl,
        sessionId: session.id,
      });
    }
  }

  const result = await generateMirrorReplyWithLogging(creatorUserId, 'widget', message, {
    platform: 'api',
    visitorId: finalVisitorId,
    sessionId: session.id,
  });

  if (result.reply) {
    await chatMessageQueries.add({ sessionId: session.id, role: 'assistant', content: result.reply });
  }

  await widgetChatLogQueries.create(creatorUserId, null, message, result.reply || '');

  let audioUrl: string | null = null;

  // Generate voice if enabled and reply exists (only if voice feature flag is ON)
  if (voiceAllowed && voiceEnabled && result.reply) {
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
  
  if (!creatorId) {
    return res.status(400).json({ error: 'Creator ID required' });
  }

  // ✅ Optional: Verify creator exists (graceful if fails)
  try {
    const { userQueries } = await import('../../config/database');
    const creator = await userQueries.findById(creatorId);
    
    if (!creator || !creator.active) {
      return res.status(404).json({ error: 'Creator not found or inactive' });
    }
  } catch (error) {
    // Graceful degradation - still return code if check fails
    logger.warn('Failed to verify creator for widget code:', error);
  }

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

