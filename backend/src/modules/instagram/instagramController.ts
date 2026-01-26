import { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../../config/logger';
import { generateMirrorReplyWithLogging } from '../identity/identityService';
import {
  exchangeForLongLivedToken,
  getInstagramProfile,
  saveInstagramConnection,
  findUserByInstagramId,
  sendInstagramMessage,
  verifyWebhookSignature,
  getVerifyToken,
  getInstagramIntegration,
} from './instagramService';

// ========== HELPERS ==========

function getUserId(req: Request): string | null {
  return req.user?.id || req.user?.userId || null;
}

// ========== OAUTH FLOW ==========

const connectSchema = z.object({
  accessToken: z.string().min(1),
});

/**
 * POST /api/instagram/connect
 * User submits their short-lived token from Instagram OAuth flow
 */
export async function connectInstagram(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const parsed = connectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    const { accessToken: shortLivedToken } = parsed.data;

    // Exchange for long-lived token
    const longLivedToken = await exchangeForLongLivedToken(shortLivedToken);

    // Get Instagram profile
    const profile = await getInstagramProfile(longLivedToken);

    // Save to database
    await saveInstagramConnection(userId, longLivedToken, profile.id, profile.username);

    logger.info(`[Instagram] Connected user ${userId} to Instagram @${profile.username}`);

    return res.json({
      success: true,
      username: profile.username,
      instagramUserId: profile.id,
    });
  } catch (error: any) {
    logger.error('[Instagram] Connect error:', error);
    return res.status(500).json({ error: error.message || 'Connection failed' });
  }
}

/**
 * GET /api/instagram/status
 * Check if user has Instagram connected
 */
export async function getInstagramStatus(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const integration = await getInstagramIntegration(userId);

    if (!integration) {
      return res.json({ connected: false });
    }

    return res.json({
      connected: true,
      username: integration.config?.username || null,
      status: integration.status,
    });
  } catch (error: any) {
    logger.error('[Instagram] Status check error:', error);
    return res.status(500).json({ error: 'Failed to check status' });
  }
}

/**
 * POST /api/instagram/disconnect
 * Disconnect Instagram integration
 */
export async function disconnectInstagram(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Update status to disconnected
    const { db } = await import('../../config/database');
    await db.query(
      `UPDATE "platform_integrations" SET status = 'disconnected', "updatedAt" = CURRENT_TIMESTAMP
       WHERE "userId" = $1 AND platform = 'instagram'`,
      [userId]
    );

    logger.info(`[Instagram] Disconnected user ${userId}`);

    return res.json({ success: true });
  } catch (error: any) {
    logger.error('[Instagram] Disconnect error:', error);
    return res.status(500).json({ error: 'Disconnect failed' });
  }
}

// ========== WEBHOOK HANDLERS ==========

/**
 * GET /api/instagram/webhook
 * Webhook verification challenge from Meta
 */
export async function verifyWebhook(req: Request, res: Response) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === getVerifyToken()) {
    logger.info('[Instagram] Webhook verified successfully');
    return res.status(200).send(challenge);
  }

  logger.warn('[Instagram] Webhook verification failed', { mode, token });
  return res.status(403).send('Forbidden');
}

/**
 * POST /api/instagram/webhook
 * Receive messages from Instagram
 */
export async function handleWebhook(req: Request, res: Response) {
  try {
    // Verify signature (if in production)
    const signature = req.headers['x-hub-signature-256'] as string;
    if (signature && process.env.NODE_ENV === 'production') {
      const payload = JSON.stringify(req.body);
      if (!verifyWebhookSignature(signature, payload)) {
        logger.warn('[Instagram] Invalid webhook signature');
        return res.status(401).send('Invalid signature');
      }
    }

    const body = req.body;
    logger.info('[Instagram] Webhook received:', JSON.stringify(body, null, 2));

    // Instagram sends messaging events in this format
    if (body.object === 'instagram') {
      const entries = body.entry || [];

      for (const entry of entries) {
        const messaging = entry.messaging || [];

        for (const event of messaging) {
          // Process only message events (not read receipts, etc.)
          if (event.message && event.message.text) {
            await processIncomingMessage(event);
          }
        }
      }
    }

    // Always respond with 200 OK to acknowledge receipt
    return res.status(200).send('EVENT_RECEIVED');
  } catch (error: any) {
    logger.error('[Instagram] Webhook error:', error);
    // Still return 200 to prevent Meta from retrying
    return res.status(200).send('EVENT_RECEIVED');
  }
}

/**
 * Process incoming Instagram DM
 */
async function processIncomingMessage(event: any) {
  try {
    const senderId = event.sender?.id;
    const recipientId = event.recipient?.id;
    const messageText = event.message?.text;

    if (!senderId || !messageText) {
      logger.warn('[Instagram] Missing sender or message text');
      return;
    }

    logger.info(`[Instagram] Message from ${senderId}: ${messageText.substring(0, 50)}...`);

    // Find the user who owns this Instagram account
    const integration = await findUserByInstagramId(recipientId);

    if (!integration || integration.status !== 'active') {
      logger.warn(`[Instagram] No active integration found for recipient ${recipientId}`);
      return;
    }

    const userId = integration.userId;
    const accessToken = integration.accessToken;

    // Generate AI reply
    const result = await generateMirrorReplyWithLogging(
      userId,
      'instagram',
      messageText,
      { platform: 'instagram', senderId }
    );

    if (result.decision === 'reply' && result.reply) {
      // Send reply back via Instagram
      await sendInstagramMessage(senderId, result.reply, accessToken);
      logger.info(`[Instagram] Sent reply to ${senderId}`);
    } else {
      logger.info(`[Instagram] Decision: ${result.decision}, not sending reply`);
    }
  } catch (error: any) {
    logger.error('[Instagram] Process message error:', error);
  }
}
