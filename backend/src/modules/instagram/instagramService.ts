import { logger } from '../../config/logger';
import { platformIntegrationQueries } from '../../config/database';

const META_APP_ID = process.env.META_APP_ID || '';
const META_APP_SECRET = process.env.META_APP_SECRET || '';
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'selflyx_verify_token';

// ========== INSTAGRAM GRAPH API ==========

/**
 * Exchange short-lived token for long-lived token
 */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
  if (!META_APP_ID || !META_APP_SECRET) {
    throw new Error('META_APP_ID and META_APP_SECRET must be configured');
  }

  const url = new URL('https://graph.instagram.com/access_token');
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', META_APP_SECRET);
  url.searchParams.set('access_token', shortLivedToken);

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.text();
    logger.error('[Instagram] Token exchange failed:', error);
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

/**
 * Get Instagram user profile
 */
export async function getInstagramProfile(accessToken: string): Promise<{
  id: string;
  username: string;
  name?: string;
  profilePictureUrl?: string;
}> {
  const url = new URL('https://graph.instagram.com/me');
  url.searchParams.set('fields', 'id,username,name,profile_picture_url');
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.text();
    logger.error('[Instagram] Profile fetch failed:', error);
    throw new Error(`Profile fetch failed: ${response.status}`);
  }

  const data = await response.json() as { id: string; username: string; name?: string; profile_picture_url?: string };
  return {
    id: data.id,
    username: data.username,
    name: data.name,
    profilePictureUrl: data.profile_picture_url,
  };
}

/**
 * Send message via Instagram Messaging API
 */
export async function sendInstagramMessage(
  recipientId: string,
  message: string,
  accessToken: string
): Promise<{ messageId: string }> {
  const url = 'https://graph.instagram.com/v18.0/me/messages';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('[Instagram] Send message failed:', error);
    throw new Error(`Send message failed: ${response.status}`);
  }

  const data = await response.json() as { message_id: string };
  return { messageId: data.message_id };
}

/**
 * Verify webhook signature from Meta
 */
export function verifyWebhookSignature(
  signature: string,
  payload: string
): boolean {
  if (!META_APP_SECRET) {
    logger.warn('[Instagram] META_APP_SECRET not configured, skipping signature verification');
    return true; // In dev, allow without verification
  }

  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', META_APP_SECRET)
    .update(payload)
    .digest('hex');

  const providedSignature = signature.replace('sha256=', '');
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(providedSignature)
  );
}

/**
 * Get verify token for webhook setup
 */
export function getVerifyToken(): string {
  return META_VERIFY_TOKEN;
}

// ========== DATABASE OPERATIONS ==========

/**
 * Save Instagram connection
 */
export async function saveInstagramConnection(
  userId: string,
  accessToken: string,
  instagramUserId: string,
  username: string
) {
  return await platformIntegrationQueries.upsert(
    userId,
    'instagram',
    accessToken,
    {
      instagramUserId,
      username,
      connectedAt: new Date().toISOString(),
    }
  );
}

/**
 * Find user by Instagram sender ID
 */
export async function findUserByInstagramId(instagramUserId: string) {
  return await platformIntegrationQueries.findByPlatformAndConfigField(
    'instagram',
    'instagramUserId',
    instagramUserId
  );
}

/**
 * Get user's Instagram integration
 */
export async function getInstagramIntegration(userId: string) {
  const integrations = await platformIntegrationQueries.listByUserId(userId);
  return integrations.find((i: any) => i.platform === 'instagram' && i.status === 'active');
}
