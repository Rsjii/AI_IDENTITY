import { Request, Response } from 'express';
import { z } from 'zod';
import { userQueries, chatSessionQueries, chatMessageQueries, db, mirrorRunQueries, identityVersionQueries, identityQueries, trustEventQueries } from '../../config/database';
import { generateMirrorReplyWithLogging } from '../identity/identityService';
import { logger } from '../../config/logger';

const chatSchema = z.object({
  slug: z.string().min(1),
  message: z.string().min(1),
  visitorId: z.string().optional(),
  sessionId: z.string().optional(),
});

export async function getCreator(req: Request, res: Response) {
  const slug = String(req.params.slug || '').trim();
  const u = await userQueries.findBySlugOrHandle(slug);
  if (!u) return res.status(404).json({ error: 'Creator not found' });

  return res.json({
    success: true,
    creator: {
      slug: u.publicSlug || u.handle,
      displayName: u.name || u.handle || 'Creator',
      avatarUrl: u.profileImage || null,
      priceConfig: u.priceConfig || null,
      creatorTitle: u.creatorTitle || null,
      creatorTags: u.creatorTags || null,
      welcomeMessage: (u.priceConfig as any)?.welcomeMessage || null,
      popularQuestions: (u.priceConfig as any)?.popularQuestions || [],
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
  const { slug, message, visitorId, sessionId } = chatSchema.parse(req.body);

  const u = await userQueries.findBySlugOrHandle(slug);
  if (!u) return res.status(404).json({ error: 'Creator not found' });

  // ✅ Check creator's plan limit (PHASE1 requirement)
  const { tier, trialActive } = await getUserPlan(u.id);
  const effectiveTier: PlanTier = trialActive ? 'growth' : tier;
  const limit = PLAN_LIMITS[effectiveTier];
  const used = await countCreatorChatsThisMonth(u.id);

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

  // Check payment requirement - only if creator has enabled pay-per-chat
  const enablePayments = (u.priceConfig as any)?.enablePayments === true;
  if (enablePayments) {
    // Check payment trigger rules
    const triggerRules = (u.priceConfig as any)?.paymentTriggerRules || {};
    const shouldRequirePayment = 
      sessionMessages >= FREE_MESSAGE_LIMIT || // Always after free limit
      triggerRules.alwaysRequire === true || // Creator set always require
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
        if (result.reply) {
          await chatMessageQueries.add({ sessionId: sid, role: 'assistant', content: result.reply });
        }
        return res.json({
          success: true,
          sessionId: sid,
          reply: result.reply || '',
          decision: result.decision,
          mirrorRunId: result.mirrorRunId,
        });
      }

      // No payment, show paywall (Option A: don't generate reply before payment)
      const pricing = u.priceConfig || { premium: { amountCents: 500 }, vip: { amountCents: 5000 } };

      // ✅ Generate teaser reply (limited preview)
      let previewReply = 'This answer requires payment to unlock the full response. Click below to proceed.';
      
      try {
        // Generate a short teaser by calling AI with truncated context
        const teaserResult = await generateMirrorReplyWithLogging(
          u.id, 
          'public_chat', 
          message, 
          {
            platform: 'web',
            sessionId: sid,
            visitorId,
          }
        );
        
        if (teaserResult.reply) {
          // Truncate to first 200 characters as teaser
          const teaser = teaserResult.reply.substring(0, 200);
          // If truncated, add ellipsis
          previewReply = teaserResult.reply.length > 200 
            ? teaser + '...' 
            : teaser;
          
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
          premium: { amount: pricing.premium?.amountCents || 500, label: 'Detailed Answer' },
          vip: { amount: pricing.vip?.amountCents || 5000, label: 'Full Consultation' },
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