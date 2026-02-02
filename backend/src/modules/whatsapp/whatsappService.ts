import { logger } from '../../config/logger';
import { platformIntegrationQueries } from '../../config/database';
import { generateVoiceAudio } from '../voice/voiceService';
import { voiceCloneQueries } from '../../config/database';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || '';

// ========== TWILIO WHATSAPP API ==========

/**
 * Send WhatsApp text message via Twilio
 */
export async function sendWhatsAppMessage(
  toNumber: string,
  message: string
): Promise<{ messageSid: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
    throw new Error('Twilio credentials not configured');
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

  const formData = new URLSearchParams();
  formData.append('From', `whatsapp:${TWILIO_WHATSAPP_NUMBER}`);
  formData.append('To', `whatsapp:${toNumber}`);
  formData.append('Body', message);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('[WhatsApp] Send message failed:', error);
    throw new Error(`Send message failed: ${response.status}`);
  }

  const data = await response.json() as { sid: string };
  return { messageSid: data.sid };
}

/**
 * Send WhatsApp voice message via Twilio (using media URL)
 */
export async function sendWhatsAppVoiceMessage(
  toNumber: string,
  audioUrl: string,
  caption?: string
): Promise<{ messageSid: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
    throw new Error('Twilio credentials not configured');
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

  const formData = new URLSearchParams();
  formData.append('From', `whatsapp:${TWILIO_WHATSAPP_NUMBER}`);
  formData.append('To', `whatsapp:${toNumber}`);
  formData.append('MediaUrl', audioUrl);
  if (caption) {
    formData.append('Body', caption);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('[WhatsApp] Send voice message failed:', error);
    throw new Error(`Send voice message failed: ${response.status}`);
  }

  const data = await response.json() as { sid: string };
  return { messageSid: data.sid };
}

/**
 * Validate Twilio webhook signature
 */
export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  if (!TWILIO_AUTH_TOKEN) {
    logger.warn('[WhatsApp] TWILIO_AUTH_TOKEN not configured, skipping signature verification');
    return true; // In dev, allow without verification
  }

  const crypto = require('crypto');

  // Build the data string (URL + sorted params)
  let data = url;
  const sortedKeys = Object.keys(params).sort();
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  const expectedSignature = crypto
    .createHmac('sha1', TWILIO_AUTH_TOKEN)
    .update(data)
    .digest('base64');

  return signature === expectedSignature;
}

// ========== DATABASE OPERATIONS ==========

/**
 * Save WhatsApp connection
 */
export async function saveWhatsAppConnection(
  userId: string,
  toNumber: string
) {
  return await platformIntegrationQueries.upsert(
    userId,
    'whatsapp',
    null, // No access token for WhatsApp (uses shared Twilio account)
    {
      toNumber,
      connectedAt: new Date().toISOString(),
    }
  );
}

/**
 * Find user by WhatsApp number
 */
export async function findUserByWhatsAppNumber(toNumber: string) {
  return await platformIntegrationQueries.findByPlatformAndConfigField(
    'whatsapp',
    'toNumber',
    toNumber
  );
}

/**
 * Get user's WhatsApp integration
 */
export async function getWhatsAppIntegration(userId: string) {
  const integrations = await platformIntegrationQueries.listByUserId(userId);
  return integrations.find((i: any) => i.platform === 'whatsapp' && i.status === 'active');
}

/**
 * Get user's default voice clone (for voice messages)
 */
export async function getUserDefaultVoice(userId: string) {
  const voices = await voiceCloneQueries.findByUserId(userId);
  return voices.find((v: any) => v.status === 'ready') || null;
}

/**
 * Generate voice audio for reply
 */
export async function generateVoiceReply(
  userId: string,
  voiceCloneId: string,
  text: string
): Promise<string> {
  return await generateVoiceAudio(userId, voiceCloneId, text);
}
