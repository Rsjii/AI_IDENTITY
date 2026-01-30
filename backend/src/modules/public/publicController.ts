import { Request, Response } from 'express';
import { z } from 'zod';
import { userQueries, chatSessionQueries, chatMessageQueries, db, mirrorRunQueries, identityVersionQueries, identityQueries, trustEventQueries, premiumSessionQueries, voiceCloneQueries } from '../../config/database';
import { generateMirrorReplyWithLogging } from '../identity/identityService';
import { logger } from '../../config/logger';
import { EventLogger } from '../../services/eventLogger';
import { EVENT_TYPES } from '../../config/constants';
import { generateVoiceAudio } from '../voice/voiceService';

const DEFAULT_PAY_PER_CHAT_TIERS = [100, 500, 1000, 2500, 5000];

function getPayPerChatTiers(priceConfig: any): number[] {
  const raw = Array.isArray(priceConfig?.payPerChatTiers) ? priceConfig.payPerChatTiers : DEFAULT_PAY_PER_CHAT_TIERS;
  const normalized = raw
    .map((v: any) => Number(v))
    .filter((v: number) => Number.isFinite(v) && Number.isInteger(v) && v > 0)
    .filter((v: number, i: number, arr: number[]) => arr.indexOf(v) === i)
    .sort((a: number, b: number) => a - b);
  return normalized.length ? normalized : DEFAULT_PAY_PER_CHAT_TIERS;
}

const chatSchema = z.object({
  slug: z.string().min(1),
  message: z.string().min(1),
  visitorId: z.string().optional(),
  sessionId: z.string().optional(),
  voiceEnabled: z.boolean().optional(),
});

const historySchema = z.object({
  sessionId: z.string().min(1),
  visitorId: z.string().min(1),
});

export async function getCreator(req: Request, res: Response) {
  const slug = String(req.params.slug || '').trim().replace(/^@/, ''); // Remove @ prefix if present
  const u = await userQueries.findBySlugOrHandle(slug);
  if (!u) return res.status(404).json({ error: 'Creator not found' });

  // ✅ Get creator stats
  const statsResult = await db.query(
    `SELECT
      COUNT(DISTINCT cs.id)::int AS "totalChats",
      COALESCE(AVG(CASE WHEN te.event = 'confirm_yes' THEN 1 WHEN te.event = 'confirm_no' THEN 0 END), 0)::numeric AS rating,
      COUNT(DISTINCT te.id)::int AS "totalRatings"
     FROM "User" u
     LEFT JOIN "chat_sessions" cs ON cs."creatorId" = u.id
     LEFT JOIN "identity_versions" iv ON iv."identityId" = (SELECT id FROM identities WHERE "userId" = u.id LIMIT 1)
     LEFT JOIN "trust_events" te ON te."identityVersionId" = iv.id
     WHERE u.id = $1
     GROUP BY u.id`,
    [u.id]
  );

  const stats = statsResult.rows[0] || { totalChats: 0, rating: 0, totalRatings: 0 };

  // Get identity info for bio/expertise
  const identity = await identityQueries.findByUserId(u.id);
  let identityJson: any = null;
  if (identity?.activeVersionId) {
    const version = await identityVersionQueries.findById(identity.activeVersionId);
    if (version) {
      identityJson = typeof version.identityJson === 'string' 
        ? JSON.parse(version.identityJson) 
        : version.identityJson;
    }
  }

  return res.json({
    success: true,
    creator: {
      id: u.id,
      handle: u.handle,
      slug: u.publicSlug || u.handle,
      displayName: u.name || u.handle || 'Creator',
      bio: identityJson?.defaults?.bio || u.bio || '',
      avatarUrl: u.profileImage || null,
      expertise: identityJson?.defaults?.expertise || u.creatorTitle || '',
      topics: identityJson?.defaults?.topics || u.creatorTags?.join(', ') || '',
      priceConfig: u.priceConfig || null,
      creatorTitle: u.creatorTitle || null,
      creatorTags: u.creatorTags || null,
      welcomeMessage: (u.priceConfig as any)?.welcomeMessage || null,
      popularQuestions: (u.priceConfig as any)?.popularQuestions || [],
      stats: {
        totalChats: stats.totalChats || 0,
        rating: parseFloat(stats.rating || '0') || 0,
        totalRatings: stats.totalRatings || 0,
      },
      socialLinks: (u.socialLinks as any) || {
        twitter: null,
        instagram: null,
        youtube: null,
        website: null,
      },
    },
  });
}

// Plan tier limits (same as planGate.ts)
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

export async function publicChat(req: Request, res: Response) {
  const { slug, message, visitorId, sessionId, voiceEnabled } = chatSchema.parse(req.body);

  const u = await userQueries.findBySlugOrHandle(slug);
  if (!u) return res.status(404).json({ error: 'Creator not found' });

  // ✅ Check creator's plan limit (PHASE1 requirement)
  const { tier, trialActive } = await getUserPlan(u.id);
  const effectiveTier: PlanTier = trialActive ? 'growth' : tier;
  const limit = PLAN_LIMITS[effectiveTier];
  const used = await countCreatorChatsThisMonth(u.id);

  if (used >= limit) {
    // ✅ Better upgrade prompt with helpful message
    const planNames: Record<PlanTier, string> = {
      free: 'Free',
      starter: 'Starter',
      growth: 'Growth',
      scale: 'Scale',
    };
    
    const nextTier: PlanTier | null = effectiveTier === 'free' ? 'starter' 
      : effectiveTier === 'starter' ? 'growth'
      : effectiveTier === 'growth' ? 'scale'
      : null;
    
    return res.status(402).json({
      error: 'Creator plan limit reached',
      errorCode: 'CREATOR_PLAN_LIMIT',
      tier: effectiveTier,
      used,
      limit,
      upgradeUrl: '/pricing',
      message: `You've reached your ${planNames[effectiveTier]} plan limit of ${limit.toLocaleString()} chats this month. ${nextTier ? `Upgrade to ${planNames[nextTier]} plan for more capacity.` : 'Contact support for higher limits.'}`,
      nextTier,
    });
  }
  
  // ✅ Warn when approaching limit (80% threshold)
  if (used >= limit * 0.8) {
    // Add warning header (non-blocking)
    res.setHeader('X-Plan-Warning', JSON.stringify({
      used,
      limit,
      percentage: Math.round((used / limit) * 100),
      message: `You've used ${Math.round((used / limit) * 100)}% of your monthly limit. Consider upgrading soon.`,
    }));
  }

  // session: reuse if provided else create
  let sid = sessionId || null;
  if (!sid) {
    const s = await chatSessionQueries.create({
      creatorId: u.id,
      visitorId: visitorId || null,
      userId: null,
      platform: 'web',
    });
    sid = s.id;
  }

  // Check if user exceeded free tier
  const FREE_MESSAGE_LIMIT = 3;
  const sessionMessages = await chatMessageQueries.countBySession(sid);

  // Save user message
  await chatMessageQueries.add({ sessionId: sid, role: 'user', content: message });

  // ✅ Check for active premium session (24-hour window)
  const hasPremiumSession = await premiumSessionQueries.isSessionPremium(sid);

  // Check payment requirement - only if creator has enabled pay-per-chat
  const enablePayments = (u.priceConfig as any)?.enablePayments === true;
  if (enablePayments && !hasPremiumSession) {
    // ✅ Use intelligent pricing detection
    const { shouldRequirePayment: intelligentPricing } = await import('../identity/intelligentPricing');
    
    // Get conversation context (last few messages)
    const recentMessages = await chatMessageQueries.listForSession(sid);
    const conversationContext = recentMessages
      .filter((m: any) => m.role === 'user')
      .slice(-5)
      .map((m: any) => m.content);
    
    // Check payment trigger rules (creator's custom rules take precedence)
    const triggerRules = (u.priceConfig as any)?.paymentTriggerRules || {};
    const intelligentDecision = intelligentPricing(message, conversationContext, u.priceConfig);
    
    // Combine intelligent pricing with creator rules
    const shouldRequirePayment = 
      sessionMessages >= FREE_MESSAGE_LIMIT || // Always after free limit
      triggerRules.alwaysRequire === true || // Creator set always require
      intelligentDecision.requiresPayment || // Intelligent detection
      (triggerRules.keywords?.length > 0 && triggerRules.keywords.some((kw: string) => 
        message.toLowerCase().includes(kw.toLowerCase())
      )) || // Contains trigger keyword
      (triggerRules.minLength > 0 && message.length >= triggerRules.minLength); // Exceeds length threshold

    if (shouldRequirePayment) {
      // ✅ Check if payment already made for this session
      const paidResult = await db.query(
        `SELECT 1 FROM "stripe_payments"
         WHERE "sessionId"=$1 AND "status"='succeeded' AND "type"='pay_per_chat'
         ORDER BY "createdAt" DESC
         LIMIT 1`,
        [sid]
      );
      
      if (paidResult.rowCount > 0) {
        // Payment already made, unlock full reply
        const result = await generateMirrorReplyWithLogging(u.id, 'public_chat', message, {
          platform: 'web',
          sessionId: sid,
          visitorId,
        });
        let audioUrl: string | null = null;
        if (voiceEnabled && result.reply) {
          try {
            const voices = await voiceCloneQueries.findByUserId(u.id);
            const defaultVoice = voices.find((v: any) => v.status === 'ready');
            if (defaultVoice) {
              audioUrl = await generateVoiceAudio(u.id, defaultVoice.id, result.reply);
            }
          } catch (err: any) {
            logger.warn('[PublicChat] Voice generation failed:', err?.message || err);
          }
        }
        if (result.reply) {
          await chatMessageQueries.add({ sessionId: sid, role: 'assistant', content: result.reply });
        }
        return res.json({
          success: true,
          sessionId: sid,
          reply: result.reply || '',
          decision: result.decision,
          mirrorRunId: result.mirrorRunId,
          audioUrl,
        });
      }

      // No payment, show paywall
      const pricing = u.priceConfig || {};
      const tiers = getPayPerChatTiers(pricing);
      const preferred = Number((pricing as any)?.defaultTierCents || 0);
      const defaultAmount = tiers.includes(preferred) ? preferred : tiers[0];
      
      // ✅ Log PAYMENT_REQUIRED event
      const triggerReason = sessionMessages >= FREE_MESSAGE_LIMIT 
        ? 'free_limit_exceeded'
        : triggerRules.alwaysRequire 
        ? 'always_require'
        : triggerRules.keywords?.some((kw: string) => message.toLowerCase().includes(kw.toLowerCase()))
        ? 'keyword_match'
        : triggerRules.minLength > 0 && message.length >= triggerRules.minLength
        ? 'min_length_exceeded'
        : 'unknown';
      
      EventLogger.logSystemEvent(EVENT_TYPES.PAYMENT_REQUIRED, {
        creatorId: u.id,
        sessionId: sid,
        visitorId: visitorId || null,
        messageLength: message.length,
        sessionMessages,
        triggerReason,
      }).catch((err) => {
        logger.warn('Failed to log PAYMENT_REQUIRED event:', err);
      });

      // ✅ Generate teaser reply (limited tokens, AI-generated preview)
      let previewReply = 'This answer requires payment to unlock the full response. Click below to proceed.';
      
      try {
        // Generate a short teaser with limited tokens (no validation, single attempt)
        const teaserResult = await generateMirrorReplyWithLogging(
          u.id, 
          'public_chat', 
          message, 
          {
            platform: 'web',
            sessionId: sid,
            visitorId,
            teaserOnly: true, // Flag for limited response
            maxTokens: 100, // Short teaser only
          }
        );
        
        if (teaserResult.reply) {
          // ✅ Truncate teaser to ~200 characters for preview (first sentence or first 200 chars)
          const teaser = teaserResult.reply.trim();
          const maxLength = 200;
          if (teaser.length > maxLength) {
            // Try to cut at sentence boundary
            const sentenceEnd = teaser.substring(0, maxLength).lastIndexOf('.');
            previewReply = sentenceEnd > maxLength * 0.5 
              ? teaser.substring(0, sentenceEnd + 1)
              : teaser.substring(0, maxLength) + '...';
          } else {
            previewReply = teaser;
          }
          // Don't save this teaser as a message - it's just for preview
          // The full reply will be generated after payment
        }
      } catch (err: any) {
        logger.warn('[Public Chat] Failed to generate teaser, using default message:', err);
        // Use default previewReply
      }
      
      return res.json({
        success: true,
        requiresPayment: true,
        sessionId: sid,
        creatorId: u.id,
        paymentOptions: {
          tiers: tiers.map((amount) => ({
            amount,
            label: `$${(amount / 100).toFixed(2)}`,
          })),
          defaultAmount,
        },
        previewReply,
      });
    }
  }

  // mirror + save messages via identityService opts
  const result = await generateMirrorReplyWithLogging(u.id, 'public_chat', message, {
    platform: 'web',
    sessionId: sid,
    visitorId,
  });
  let audioUrl: string | null = null;
  if (voiceEnabled && result.reply) {
    try {
      const voices = await voiceCloneQueries.findByUserId(u.id);
      const defaultVoice = voices.find((v: any) => v.status === 'ready');
      if (defaultVoice) {
        audioUrl = await generateVoiceAudio(u.id, defaultVoice.id, result.reply);
      }
    } catch (err: any) {
      logger.warn('[PublicChat] Voice generation failed:', err?.message || err);
    }
  }

  // Save assistant reply
  if (result.reply) {
    await chatMessageQueries.add({ sessionId: sid, role: 'assistant', content: result.reply });
  }

  return res.json({
    success: true,
    sessionId: sid,
    reply: result.reply || '',
    decision: result.decision,
    mirrorRunId: result.mirrorRunId,
    audioUrl,
  });
}

export async function publicHistory(req: Request, res: Response) {
  const { sessionId, visitorId } = historySchema.parse({
    sessionId: req.query.sessionId,
    visitorId: req.query.visitorId,
  });

  const session = await chatSessionQueries.findById(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (!session.visitorId || session.visitorId !== visitorId) {
    return res.status(403).json({ error: 'Session access denied' });
  }

  const messages = await chatMessageQueries.listForSession(sessionId);
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentMessages = messages.filter((m: any) => {
    const createdAt = new Date(m.createdAt).getTime();
    return Number.isNaN(createdAt) ? true : createdAt >= cutoff;
  });

  return res.json({
    success: true,
    sessionId,
    messages: recentMessages.map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  });
}

const feedbackSchema = z.object({
  messageId: z.string().optional(),
  feedback: z.enum(['positive', 'negative']),
  sessionId: z.string().optional(),
  visitorId: z.string().optional(),
  mirrorRunId: z.string().optional(),
});

export async function publicFeedback(req: Request, res: Response) {
  try {
    const { messageId, feedback, sessionId, visitorId, mirrorRunId } = feedbackSchema.parse(req.body);

    // If mirrorRunId is provided, log as trust event (compatible with dashboard satisfaction score)
    if (mirrorRunId) {
      try {
        // Verify mirror run exists and get creator
        const mirrorRun = await mirrorRunQueries.findById(mirrorRunId);
        if (!mirrorRun) {
          return res.status(404).json({ error: 'Mirror run not found' });
        }

        // Get identity version and creator
        const version = await identityVersionQueries.findById(mirrorRun.identityVersionId);
        if (!version) {
          return res.status(404).json({ error: 'Identity version not found' });
        }

        const identity = await identityQueries.findById(version.identityId);
        if (!identity) {
          return res.status(404).json({ error: 'Identity not found' });
        }

        // Map feedback to trust event format
        const trustEvent: 'confirm_yes' | 'confirm_no' = feedback === 'positive' ? 'confirm_yes' : 'confirm_no';

        // Create trust event (this feeds into dashboard satisfaction score)
        await trustEventQueries.create(mirrorRunId, version.id, trustEvent);

        logger.info(`[Public Feedback] Logged ${feedback} feedback for mirror run ${mirrorRunId}`);
      } catch (error: any) {
        logger.error('[Public Feedback] Error logging trust event:', error);
        // Continue - don't fail the request if trust event logging fails
      }
    }

    // Also log to a separate feedback table if needed (for analytics)
    // For now, trust_events is sufficient since dashboard reads from it

    return res.json({ success: true, message: 'Feedback recorded' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('[Public Feedback] Error:', error);
    return res.status(500).json({ error: 'Failed to record feedback' });
  }
}