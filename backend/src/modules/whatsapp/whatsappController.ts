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

// ========== HELPERS ==========

function getUserId(req: Request): string | null {
  return req.user?.id || req.user?.userId || null;
}

// ========== CONNECTION MANAGEMENT ==========

const connectSchema = z.object({
  phoneNumber: z.string().min(10).max(15),
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

    // Generate AI reply
    const result = await generateMirrorReplyWithLogging(
      userId,
      'whatsapp',
      messageBody,
      { platform: 'whatsapp', fromNumber, messageSid }
    );

    if (result.decision === 'reply' && result.reply) {
      // Check if user has a voice clone for voice messages
      const defaultVoice = await getUserDefaultVoice(userId);

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

    // Respond with empty TwiML (we're sending async)
    return res.status(200).send('<Response></Response>');
  } catch (error: any) {
    logger.error('[WhatsApp] Webhook error:', error);
    return res.status(200).send('<Response></Response>');
  }
}

