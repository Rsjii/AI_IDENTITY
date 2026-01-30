import { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../../config/logger';
import { generateMirrorReplyWithLogging } from '../identity/identityService';
import {
  sendWhatsAppMessage,
  sendWhatsAppVoiceMessage,
  saveWhatsAppConnection,
  findUserByWhatsAppNumber,
  getWhatsAppIntegration,
  getUserDefaultVoice,
  generateVoiceReply,
} from './whatsappService';
import { db, userQueries, whatsappConversationQueries } from '../../config/database';

// ========== HELPERS ==========

function getUserId(req: Request): string | null {
  return req.user?.id || req.user?.userId || null;
}

// ========== CONNECTION MANAGEMENT ==========

const connectSchema = z.object({
  phoneNumber: z.string().min(10).max(15),
});

const settingsSchema = z.object({
  autoReply: z.boolean().optional(),
  businessHours: z.string().optional(),
  greeting: z.string().max(500).optional(),
  paymentEnabled: z.boolean().optional(),
});

/**
 * POST /api/whatsapp/connect
 * Register user's phone number for WhatsApp replies
 */
export async function connectWhatsApp(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const parsed = connectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    let { phoneNumber } = parsed.data;

    // Normalize phone number (ensure it starts with +)
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = '+' + phoneNumber;
    }

    // Save to database
    await saveWhatsAppConnection(userId, phoneNumber);

    logger.info(`[WhatsApp] Connected user ${userId} to phone ${phoneNumber}`);

    return res.json({
      success: true,
      phoneNumber,
    });
  } catch (error: any) {
    logger.error('[WhatsApp] Connect error:', error);
    return res.status(500).json({ error: error.message || 'Connection failed' });
  }
}

/**
 * GET /api/whatsapp/status
 * Check if user has WhatsApp connected
 */
export async function getWhatsAppStatus(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const integration = await getWhatsAppIntegration(userId);

    if (!integration) {
      return res.json({ connected: false });
    }

    return res.json({
      connected: true,
      phoneNumber: integration.config?.toNumber || null,
      status: integration.status,
      settings: integration.config?.settings || {},
    });
  } catch (error: any) {
    logger.error('[WhatsApp] Status check error:', error);
    return res.status(500).json({ error: 'Failed to check status' });
  }
}

/**
 * POST /api/whatsapp/disconnect
 * Disconnect WhatsApp integration
 */
export async function disconnectWhatsApp(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { db } = await import('../../config/database');
    await db.query(
      `UPDATE "platform_integrations" SET status = 'disconnected', "updatedAt" = CURRENT_TIMESTAMP
       WHERE "userId" = $1 AND platform = 'whatsapp'`,
      [userId]
    );

    logger.info(`[WhatsApp] Disconnected user ${userId}`);

    return res.json({ success: true });
  } catch (error: any) {
    logger.error('[WhatsApp] Disconnect error:', error);
    return res.status(500).json({ error: 'Disconnect failed' });
  }
}

/**
 * POST /api/whatsapp/settings
 * Update WhatsApp settings
 */
export async function updateWhatsAppSettings(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const parsed = settingsSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid settings', details: parsed.error.errors });
    }

    const { db } = await import('../../config/database');
    const existing = await db.query(
      `SELECT config FROM "platform_integrations" WHERE "userId"=$1 AND platform='whatsapp' LIMIT 1`,
      [userId]
    );
    const currentConfig = existing.rows[0]?.config || {};
    const nextConfig = {
      ...currentConfig,
      settings: {
        ...(currentConfig.settings || {}),
        ...parsed.data,
      },
    };

    await db.query(
      `UPDATE "platform_integrations" SET config=$1, "updatedAt"=CURRENT_TIMESTAMP
       WHERE "userId"=$2 AND platform='whatsapp'`,
      [JSON.stringify(nextConfig), userId]
    );

    return res.json({ success: true, settings: nextConfig.settings });
  } catch (error: any) {
    logger.error('[WhatsApp] Settings update error:', error);
    return res.status(500).json({ error: 'Failed to update settings' });
  }
}

/**
 * GET /api/whatsapp/stats
 * Basic WhatsApp stats for dashboard UI
 */
export async function getWhatsAppStats(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const messageStats = await db.query(
      `SELECT
         COUNT(*)::int AS "totalMessages",
         COUNT(*) FILTER (WHERE mr."createdAt" >= date_trunc('day', now()))::int AS "todayMessages"
       FROM "mirror_runs" mr
       JOIN "identity_versions" iv ON iv.id = mr."identityVersionId"
       JOIN "identities" i ON i.id = iv."identityId"
       WHERE i."userId"=$1 AND mr."platform"='whatsapp'`,
      [userId]
    );

    const paymentStats = await db.query(
      `SELECT
         COUNT(*)::int AS "todayConversions",
         COALESCE(SUM(amount),0)::int AS "todayRevenueCents"
       FROM "stripe_payments"
       WHERE "creatorId"=$1
         AND "status"='succeeded'
         AND "type"='pay_per_chat'
         AND "createdAt" >= date_trunc('day', now())`,
      [userId]
    );

    const messages = messageStats.rows[0] || { totalMessages: 0, todayMessages: 0 };
    const payments = paymentStats.rows[0] || { todayConversions: 0, todayRevenueCents: 0 };

    return res.json({
      totalMessages: messages.totalMessages || 0,
      todayMessages: messages.todayMessages || 0,
      todayConversions: payments.todayConversions || 0,
      todayRevenueCents: payments.todayRevenueCents || 0,
    });
  } catch (error: any) {
    logger.error('[WhatsApp] Stats error:', error);
    return res.status(500).json({ error: 'Failed to load WhatsApp stats' });
  }
}

// ========== WEBHOOK HANDLER ==========

/**
 * POST /api/whatsapp/webhook
 * Receive messages from Twilio WhatsApp
 */
export async function handleWebhook(req: Request, res: Response) {
  try {
    // Twilio sends form-urlencoded data
    const body = req.body;

    logger.info('[WhatsApp] Webhook received:', JSON.stringify(body, null, 2));

    // Extract message details
    const fromNumber = body.From?.replace('whatsapp:', '') || '';
    const toNumber = body.To?.replace('whatsapp:', '') || '';
    const messageBody = body.Body || '';
    const messageSid = body.MessageSid || '';

    if (!fromNumber || !messageBody) {
      logger.warn('[WhatsApp] Missing from number or message body');
      return res.status(200).send('<Response></Response>');
    }

    // Find user by the FROM number (the person messaging us)
    const integration = await findUserByWhatsAppNumber(fromNumber);

    if (!integration || integration.status !== 'active') {
      logger.warn(`[WhatsApp] No active integration found for ${fromNumber}`);
      // Still respond with empty TwiML
      return res.status(200).send('<Response></Response>');
    }

    const userId = integration.userId;
    const settings = integration.config?.settings || {};
    if (settings.autoReply === false) {
      return res.status(200).send('<Response></Response>');
    }
    const user = await userQueries.findById(userId);
    if (!user) {
      return res.status(200).send('<Response></Response>');
    }

    // ✅ Conversation state (rate limit + context)
    const convo = await whatsappConversationQueries.findByPhoneNumber(fromNumber);
    const convoData = (convo?.conversationData as any) || {};
    const now = Date.now();
    const hourlyResetAt = convoData.hourlyResetAt ? Number(convoData.hourlyResetAt) : 0;
    let hourlyCount = Number(convoData.hourlyCount || 0);
    if (!hourlyResetAt || now > hourlyResetAt) {
      hourlyCount = 0;
    }
    hourlyCount += 1;

    // Rate limit: 200 messages/hour
    if (hourlyCount > 200) {
      await whatsappConversationQueries.upsert(userId, fromNumber, {
        ...convoData,
        hourlyCount,
        hourlyResetAt: now + 60 * 60 * 1000,
      });
      logger.warn(`[WhatsApp] Rate limit exceeded for ${fromNumber}`);
      return res.status(200).send('<Response></Response>');
    }

    const recentMessages: string[] = Array.isArray(convoData.recentMessages) ? convoData.recentMessages : [];
    const updatedMessages = [...recentMessages, messageBody].slice(-5);

    // ✅ Pay-per-chat gating for WhatsApp
    const enablePayments = (user.priceConfig as any)?.enablePayments === true && settings.paymentEnabled !== false;
    if (enablePayments) {
      const { shouldRequirePayment } = await import('../identity/intelligentPricing');
      const decision = shouldRequirePayment(messageBody, updatedMessages, user.priceConfig);
      if (decision.requiresPayment) {
        const slug = user.publicSlug || user.handle || '';
        const paymentLink = slug ? `${process.env.FRONTEND_URL || 'https://selflyx.com'}/chat/${slug}?upgrade=1` : '';
        const teaser = `This is a premium request. ${paymentLink ? `Pay here: ${paymentLink}` : 'Please visit the chat link to unlock.'}`;
        await sendWhatsAppMessage(fromNumber, teaser);
        await whatsappConversationQueries.upsert(userId, fromNumber, {
          ...convoData,
          recentMessages: updatedMessages,
          hourlyCount,
          hourlyResetAt: now + 60 * 60 * 1000,
        });
        return res.status(200).send('<Response></Response>');
      }
    }

    // Generate AI reply (use fromNumber as visitorId for chat history)
    const result = await generateMirrorReplyWithLogging(
      userId,
      'whatsapp',
      messageBody,
      {
        platform: 'whatsapp' as any,
        visitorId: fromNumber, // Use phone number as visitorId for chat history tracking
      }
    );

    if (result.decision?.action === 'reply' && result.reply) {
      // Check if user has a voice clone for voice messages
      const defaultVoice = await getUserDefaultVoice(userId);

      if (!convoData.greeted && settings.greeting) {
        try {
          await sendWhatsAppMessage(fromNumber, settings.greeting);
          convoData.greeted = true;
        } catch (greetErr: any) {
          logger.warn('[WhatsApp] Greeting failed:', greetErr?.message || greetErr);
        }
      }

      if (defaultVoice) {
        try {
          // Generate voice and send as audio message
          const audioUrl = await generateVoiceReply(userId, defaultVoice.id, result.reply);
          await sendWhatsAppVoiceMessage(fromNumber, audioUrl, result.reply.substring(0, 100));
          logger.info(`[WhatsApp] Sent voice reply to ${fromNumber}`);
        } catch (voiceError: any) {
          logger.error('[WhatsApp] Voice generation failed, sending text:', voiceError);
          // Fallback to text
          await sendWhatsAppMessage(fromNumber, result.reply);
        }
      } else {
        // No voice clone, send text only
        await sendWhatsAppMessage(fromNumber, result.reply);
        logger.info(`[WhatsApp] Sent text reply to ${fromNumber}`);
      }
    } else {
      logger.info(`[WhatsApp] Decision: ${result.decision}, not sending reply`);
    }

    await whatsappConversationQueries.upsert(userId, fromNumber, {
      ...convoData,
      greeted: !!convoData.greeted,
      recentMessages: updatedMessages,
      hourlyCount,
      hourlyResetAt: now + 60 * 60 * 1000,
    });

    // Respond with empty TwiML (we're sending async)
    return res.status(200).send('<Response></Response>');
  } catch (error: any) {
    logger.error('[WhatsApp] Webhook error:', error);
    return res.status(200).send('<Response></Response>');
  }
}

