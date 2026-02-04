import { Request, Response } from 'express';
import { z } from 'zod';
import { userQueries, chatSessionQueries, chatMessageQueries, db, mirrorRunQueries, identityVersionQueries, identityQueries, trustEventQueries, premiumSessionQueries, voiceCloneQueries } from '../../config/database';
import { generateMirrorReplyWithLogging } from '../identity/identityService';
import { logger } from '../../config/logger';
import { EventLogger } from '../../services/eventLogger';
import { EVENT_TYPES } from '../../config/constants';
import { generateVoiceAudio } from '../voice/voiceService';
import { isFeatureEnabled } from '../../config/featureFlags';

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
  visitorId: z.string().optional(),
});

const claimSessionSchema = z.object({
  sessionId: z.string().min(1),
  visitorId: z.string().min(1),
});

const publicLimitSchema = z.object({
  sessionId: z.string().optional(),
  visitorId: z.string().optional(),
});

function safeSlug(input: string): string {
  return String(input || '').trim().replace(/^@/, '');
}

function shouldForcePaywall(priceConfig: any): boolean {
  return priceConfig?.alwaysRequirePayment === true || priceConfig?.forcePaywall === true;
}

function shouldSmartTriggerPaywall(message: string, priceConfig: any): boolean {
  if (!message) return false;
  if (message.length > 500) return true; // doc trigger

  const keywords: string[] = Array.isArray(priceConfig?.premiumKeywords)
    ? priceConfig.premiumKeywords
    : ['plan', 'diet', 'workout', 'meal', 'routine', 'strategy'];

  const s = message.toLowerCase();
  return keywords.some((k) => String(k).toLowerCase().trim() && s.includes(String(k).toLowerCase().trim()));
}

async function getActivePremiumExpiry(sessionId: string): Promise<Date | null> {
  const r = await db.query(
    `SELECT "expiresAt"
     FROM "premium_sessions"
     WHERE "sessionId"=$1 AND "expiresAt" > CURRENT_TIMESTAMP
     ORDER BY "expiresAt" DESC
     LIMIT 1`,
    [sessionId]
  );
  const v = r.rows[0]?.expiresAt ? new Date(r.rows[0].expiresAt) : null;
  return v && !Number.isNaN(v.getTime()) ? v : null;
}

// Marketplace helpers (subscription -> chat access)
async function getPublicListingForCreator(
  creatorId: string
): Promise<{ id: string; subscriptionPriceCents: number; currency: string } | null> {
  const r = await db.query(
    `SELECT id, "subscriptionPriceCents", currency
     FROM "marketplace_listings"
     WHERE "creatorId"=$1 AND "isPublic"=true
     ORDER BY "createdAt" DESC
     LIMIT 1`,
    [creatorId]
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    subscriptionPriceCents: Number(row.subscriptionPriceCents || 0),
    currency: row.currency || 'USD',
  };
}

async function hasActiveMarketplaceSubscription(userId: string, listingId: string): Promise<boolean> {
  const r = await db.query(
    `SELECT 1
     FROM "marketplace_subscriptions"
     WHERE "listingId"=$1 AND "userId"=$2 AND "status" IN ('active','trialing')
     LIMIT 1`,
    [listingId, userId]
  );
  return r.rowCount > 0;
}

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

  const listing = await getPublicListingForCreator(u.id);

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
      listingId: listing?.id || null,
      subscriptionPriceCents: listing?.subscriptionPriceCents || 0,
      currency: listing?.currency || 'USD',
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

const DAY_MS = 24 * 60 * 60 * 1000;

async function ensureDailyFreeReset(sessionId: string) {
  const r = await db.query(
    `SELECT "freeResetAt","createdAt" FROM "chat_sessions" WHERE id=$1 LIMIT 1`,
    [sessionId]
  );
  const row = r.rows[0];
  if (!row) return;

  const base = row.freeResetAt ? new Date(row.freeResetAt) : new Date(row.createdAt);
  if (Number.isNaN(base.getTime())) return;

  if (Date.now() - base.getTime() >= DAY_MS) {
    await db.query(`UPDATE "chat_sessions" SET "freeResetAt"=NOW(), "updatedAt"=NOW() WHERE id=$1`, [sessionId]);
  }
}

/**
 * ✅ Public: message-limit + premium countdown (works for guest + authed)
 * GET /api/public/message-limit?sessionId=...&visitorId=...
 */
export async function publicMessageLimit(req: any, res: Response) {
  const { sessionId, visitorId } = publicLimitSchema.parse({
    sessionId: req.query.sessionId,
    visitorId: req.query.visitorId,
  });

  const FREE_MESSAGE_LIMIT = 3;

  if (!sessionId) {
    return res.json({
      success: true,
      canSendMessage: true,
      isUnlimited: false,
      requiresPayment: false,
      remainingFreeMessages: FREE_MESSAGE_LIMIT,
      freeMessageLimit: FREE_MESSAGE_LIMIT,
      messagesUsed: 0,
      premiumExpiresAt: null,
      premiumRemainingMs: null,
    });
  }

  const session = await chatSessionQueries.findById(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const viewerUserId = req.user?.id || null;

  // Access control:
  // - If session is claimed by a user => only that user can read limit
  // - If session is guest (userId null) => require matching visitorId
  if (session.userId) {
    if (!viewerUserId || session.userId !== viewerUserId) {
      return res.status(403).json({ error: 'Session access denied' });
    }
  } else {
    if (!visitorId || session.visitorId !== visitorId) {
      return res.status(403).json({ error: 'Session access denied' });
    }
  }

  await ensureDailyFreeReset(sessionId);

  // Subscription -> unlimited access (logged-in only)
  if (viewerUserId) {
    const listing = await getPublicListingForCreator(session.creatorId);
    if (listing?.id) {
      const isSubscribed = await hasActiveMarketplaceSubscription(viewerUserId, listing.id);
      if (isSubscribed) {
        return res.json({
          success: true,
          canSendMessage: true,
          isUnlimited: true,
          requiresPayment: false,
          remainingFreeMessages: 0,
          freeMessageLimit: FREE_MESSAGE_LIMIT,
          messagesUsed: FREE_MESSAGE_LIMIT,
          premiumExpiresAt: null,
          premiumRemainingMs: null,
          isSubscribed: true,
        });
      }
    }
  }

  const premiumExpiresAt = await getActivePremiumExpiry(sessionId);
  if (premiumExpiresAt) {
    return res.json({
      success: true,
      canSendMessage: true,
      isUnlimited: true,
      requiresPayment: false,
      remainingFreeMessages: 0,
      freeMessageLimit: FREE_MESSAGE_LIMIT,
      messagesUsed: FREE_MESSAGE_LIMIT,
      premiumExpiresAt: premiumExpiresAt.toISOString(),
      premiumRemainingMs: Math.max(0, premiumExpiresAt.getTime() - Date.now()),
      isSubscribed: false,
    });
  }

  // Count messages after freeResetAt (if set) or all messages
  const sinceIso =
    session.freeResetAt && !Number.isNaN(new Date(session.freeResetAt).getTime())
      ? new Date(session.freeResetAt).toISOString()
      : null;

  const messagesUsed = sinceIso
    ? await chatMessageQueries.countBySessionSince(sessionId, sinceIso)
    : await chatMessageQueries.countBySession(sessionId);

  const remainingFreeMessages = Math.max(0, FREE_MESSAGE_LIMIT - messagesUsed);
  const canSendMessage = messagesUsed < FREE_MESSAGE_LIMIT;

  return res.json({
    success: true,
    canSendMessage,
    isUnlimited: false,
    requiresPayment: false, // NOTE: graduated paywall handled by /chat response
    remainingFreeMessages,
    freeMessageLimit: FREE_MESSAGE_LIMIT,
    messagesUsed,
    premiumExpiresAt: null,
    premiumRemainingMs: null,
    isSubscribed: false,
  });
}

/**
 * ✅ Claim a guest session after login (so it shows in /api/user/conversations)
 * POST /api/public/claim-session { sessionId, visitorId }
 */
export async function claimSession(req: any, res: Response) {
  const viewerUserId = req.user?.id;
  if (!viewerUserId) return res.status(401).json({ error: 'Unauthorized' });

  const { sessionId, visitorId } = claimSessionSchema.parse(req.body);

  const session = await chatSessionQueries.findById(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  if (session.userId) {
    // already claimed
    if (session.userId !== viewerUserId) return res.status(403).json({ error: 'Session access denied' });
    return res.json({ success: true, claimed: true });
  }

  if (!session.visitorId || session.visitorId !== visitorId) {
    return res.status(403).json({ error: 'Session access denied' });
  }

  await db.query(
    `UPDATE "chat_sessions"
     SET "userId"=$2, "viewerUserId"=$2, "freeResetAt"=NOW(), "updatedAt"=NOW()
     WHERE id=$1`,
    [sessionId, viewerUserId]
  );

  return res.json({ success: true, claimed: true });
}

/**
 * ✅ Public chat: supports guest + logged in
 * Graduated paywall:
 * - messagesUsedBefore 0-2 => full answer
 * - messagesUsedBefore == 3 => teaser (4th message)
 * - messagesUsedBefore >= 4 => hard paywall
 */
export async function publicChat(req: any, res: Response) {
  const { slug, message, visitorId, sessionId, voiceEnabled } = chatSchema.parse(req.body);
  const cleanSlug = safeSlug(slug);

  const viewerUserId = req.user?.id || null;

  const creator = await userQueries.findBySlugOrHandle(cleanSlug);
  if (!creator) return res.status(404).json({ error: 'Creator not found' });

  // ✅ Check creator's plan limit (PHASE1 requirement) - only for logged-in creators
  if (viewerUserId && viewerUserId === creator.id) {
    const { tier, trialActive } = await getUserPlan(creator.id);
    const effectiveTier: PlanTier = trialActive ? 'growth' : tier;
    const limit = PLAN_LIMITS[effectiveTier];
    const used = await countCreatorChatsThisMonth(creator.id);

    if (used >= limit) {
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
      res.setHeader('X-Plan-Warning', JSON.stringify({
        used,
        limit,
        percentage: Math.round((used / limit) * 100),
        message: `You've used ${Math.round((used / limit) * 100)}% of your monthly limit. Consider upgrading soon.`,
      }));
    }
  }

  // Resolve session with ownership validation
  let sid: string | null = sessionId || null;

  if (sid) {
    const existing = await chatSessionQueries.findById(sid);
    const validCreator = existing && existing.creatorId === creator.id;

    if (!existing || !validCreator) {
      sid = null;
    } else if (existing.userId) {
      // claimed session must match user
      if (!viewerUserId || existing.userId !== viewerUserId) {
        sid = null; // fallback: start new session (avoid leaking)
      }
    } else {
      // guest session requires visitorId match
      if (!visitorId || existing.visitorId !== visitorId) {
        sid = null;
      }
    }
  }

  if (!sid) {
    const s = await chatSessionQueries.create({
      creatorId: creator.id,
      visitorId: visitorId || null,
      userId: viewerUserId || null,
      platform: 'web',
    });
    sid = s.id;
  }

  await ensureDailyFreeReset(sid);

  // Get session row to check freeResetAt
  const sessionRow = await chatSessionQueries.findById(sid);

  // Count BEFORE adding this message (counts user messages only, after reset if present)
  const FREE_MESSAGE_LIMIT = 3;
  const sinceIso =
    sessionRow?.freeResetAt && !Number.isNaN(new Date(sessionRow.freeResetAt).getTime())
      ? new Date(sessionRow.freeResetAt).toISOString()
      : null;

  const messagesUsedBefore = sinceIso
    ? await chatMessageQueries.countBySessionSince(sid, sinceIso)
    : await chatMessageQueries.countBySession(sid);

  // Save user message (capture ID)
  const userMsgRow = await chatMessageQueries.add({ sessionId: sid, role: 'user', content: message });

  // Premium check
  const hasPremiumSession = await premiumSessionQueries.isSessionPremium(sid);

  // Subscription check (logged-in users only)
  let isSubscribed = false;
  if (viewerUserId) {
    const listing = await getPublicListingForCreator(creator.id);
    if (listing?.id) {
      isSubscribed = await hasActiveMarketplaceSubscription(viewerUserId, listing.id);
    }
  }

  const payPerChatAllowed = isFeatureEnabled('ENABLE_PAY_PER_CHAT') && isFeatureEnabled('ENABLE_PAYMENTS');
  const voiceAllowed = isFeatureEnabled('ENABLE_VOICE');
  const enablePayments = (creator.priceConfig as any)?.enablePayments === true;
  const priceConfig = creator.priceConfig as any;
  const forced = shouldForcePaywall(priceConfig);
  const smart = shouldSmartTriggerPaywall(message, priceConfig);

  // If premium active OR payments not enabled => full reply
  if (isSubscribed || !(payPerChatAllowed && enablePayments) || hasPremiumSession) {
    const result = await generateMirrorReplyWithLogging(creator.id, 'public_chat', message, {
      platform: 'web',
      sessionId: sid,
      visitorId,
    });

    let audioUrl: string | null = null;
    if (voiceAllowed && voiceEnabled && result.reply) {
      try {
        const voices = await voiceCloneQueries.findByUserId(creator.id);
        const defaultVoice = voices.find((v: any) => v.status === 'ready');
        if (defaultVoice) audioUrl = await generateVoiceAudio(creator.id, defaultVoice.id, result.reply);
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
      mirrorRunId: result.mirrorRunId,
      audioUrl,
      isSubscribed,
    });
  }

  // ✅ Determine paywall stage
  let paywallStage: 'none' | 'teaser' | 'hard' =
    messagesUsedBefore === FREE_MESSAGE_LIMIT ? 'teaser' : messagesUsedBefore > FREE_MESSAGE_LIMIT ? 'hard' : 'none';

  if (forced && paywallStage === 'none') {
    paywallStage = messagesUsedBefore === 0 ? 'teaser' : 'hard';
  }

  if (smart && paywallStage === 'none') {
    paywallStage = 'teaser';
  }

  if (paywallStage === 'none') {
    // 1-3 free messages => full
    const result = await generateMirrorReplyWithLogging(creator.id, 'public_chat', message, {
      platform: 'web',
      sessionId: sid,
      visitorId,
    });

    if (result.reply) await chatMessageQueries.add({ sessionId: sid, role: 'assistant', content: result.reply });

    return res.json({
      success: true,
      sessionId: sid,
      reply: result.reply || '',
      mirrorRunId: result.mirrorRunId,
      isSubscribed,
    });
  }

  // pricing tiers (use helper)
  const tiers = getPayPerChatTiers(priceConfig);
  const preferred = Number(priceConfig?.defaultTierCents || 0);
  const defaultAmount = tiers.includes(preferred) ? preferred : tiers[0];

  // teaser stage -> generate teaser, STORE it as truncated, return teaserMessageId
  if (paywallStage === 'teaser') {
    let previewReply = '';
    try {
      const teaserResult = await generateMirrorReplyWithLogging(creator.id, 'public_chat', message, {
        platform: 'web',
        sessionId: sid,
        visitorId,
        teaserOnly: true,
        maxTokens: 220, // longer so UI can blur "the rest"
      });

      previewReply = (teaserResult.reply || '').trim();
      if (previewReply.length > 900) previewReply = previewReply.slice(0, 900).trim() + '...';
    } catch (err: any) {
      logger.warn('[PublicChat] teaser generation failed:', err?.message || err);
      previewReply = "Here's a preview of what you'll get. Unlock to see the full detailed answer.";
    }

    const teaserRow = await chatMessageQueries.add({
      sessionId: sid,
      role: 'assistant',
      content: previewReply,
      truncated: true,
    });

    EventLogger.logSystemEvent(EVENT_TYPES.PAYMENT_REQUIRED, {
      creatorId: creator.id,
      sessionId: sid,
      visitorId: visitorId || null,
      paywallStage: 'teaser',
      messagesUsedBefore,
    }).catch(() => {});

    return res.json({
      success: true,
      sessionId: sid,
      requiresPayment: true,
      paywallStage: 'teaser',
      creatorId: creator.id,
      userMessageId: userMsgRow.id,
      teaserMessageId: teaserRow.id,
      previewReply,
      isSubscribed,
      paymentOptions: {
        tiers: tiers.map((amount: number) => ({ amount, label: `$${(amount / 100).toFixed(2)}` })),
        defaultAmount,
      },
    });
  }

  // hard stage -> no preview, just require payment
  EventLogger.logSystemEvent(EVENT_TYPES.PAYMENT_REQUIRED, {
    creatorId: creator.id,
    sessionId: sid,
    visitorId: visitorId || null,
    paywallStage: 'hard',
    messagesUsedBefore,
  }).catch(() => {});

  return res.json({
    success: true,
    sessionId: sid,
    requiresPayment: true,
    paywallStage: 'hard',
    creatorId: creator.id,
    userMessageId: userMsgRow.id,
    teaserMessageId: null,
    previewReply: '',
    isSubscribed,
    paymentOptions: {
      tiers: tiers.map((amount: number) => ({ amount, label: `$${(amount / 100).toFixed(2)}` })),
      defaultAmount,
    },
  });
}

const unlockBySubscriptionSchema = z.object({
  sessionId: z.string().min(1),
  teaserMessageId: z.string().optional(), // if omitted, unlock latest truncated assistant message
});

export async function unlockBySubscription(req: any, res: Response) {
  const viewerUserId = req.user?.id;
  if (!viewerUserId) return res.status(401).json({ error: 'Unauthorized' });

  const { sessionId, teaserMessageId } = unlockBySubscriptionSchema.parse(req.body);

  const s = await db.query(
    `SELECT id, "creatorId", "userId" FROM "chat_sessions" WHERE id=$1 LIMIT 1`,
    [sessionId]
  );
  const session = s.rows[0];
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!session.userId || session.userId !== viewerUserId) return res.status(403).json({ error: 'Session access denied' });

  const listing = await getPublicListingForCreator(session.creatorId);
  if (!listing?.id) return res.status(400).json({ error: 'Creator is not subscribable' });

  const ok = await hasActiveMarketplaceSubscription(viewerUserId, listing.id);
  if (!ok) return res.status(402).json({ error: 'Not subscribed' });

  // Find teaser message row
  const teaserRes = teaserMessageId
    ? await db.query(
        `SELECT id, "createdAt"
         FROM "chat_messages"
         WHERE id=$1 AND "sessionId"=$2 AND role='assistant' AND truncated=true
         LIMIT 1`,
        [teaserMessageId, sessionId]
      )
    : await db.query(
        `SELECT id, "createdAt"
         FROM "chat_messages"
         WHERE "sessionId"=$1 AND role='assistant' AND truncated=true
         ORDER BY "createdAt" DESC
         LIMIT 1`,
        [sessionId]
      );

  const teaser = teaserRes.rows[0];
  if (!teaser) return res.json({ success: true, unlocked: false });

  // Find the most recent user message before the teaser
  const userMsgRes = await db.query(
    `SELECT content
     FROM "chat_messages"
     WHERE "sessionId"=$1 AND role='user' AND "createdAt" <= $2
     ORDER BY "createdAt" DESC
     LIMIT 1`,
    [sessionId, teaser.createdAt]
  );
  const userMsg = userMsgRes.rows[0]?.content || '';
  if (!userMsg) return res.status(400).json({ error: 'No user message found to unlock' });

  const result = await generateMirrorReplyWithLogging(session.creatorId, 'public_chat', userMsg, {
    platform: 'web',
    sessionId,
    visitorId: null,
  });

  const full = (result.reply || '').trim();
  await db.query(`UPDATE "chat_messages" SET content=$1, truncated=false WHERE id=$2`, [full, teaser.id]);

  return res.json({ success: true, unlocked: true, teaserMessageId: teaser.id, reply: full });
}

/**
 * ✅ Public history: guest + authed
 * GET /api/public/history?sessionId=...&visitorId=...
 */
export async function publicHistory(req: any, res: Response) {
  const { sessionId, visitorId } = historySchema.parse({
    sessionId: req.query.sessionId,
    visitorId: req.query.visitorId,
  });

  const session = await chatSessionQueries.findById(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const viewerUserId = req.user?.id || null;

  if (session.userId) {
    if (!viewerUserId || session.userId !== viewerUserId) {
      return res.status(403).json({ error: 'Session access denied' });
    }
  } else {
    if (!visitorId || session.visitorId !== visitorId) {
      return res.status(403).json({ error: 'Session access denied' });
    }
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
      truncated: !!m.truncated, // NEW
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