import crypto from 'crypto';
import { logger } from '../config/logger';

const API_BASE = 'https://api.lemonsqueezy.com/v1';

export type Tier = 'starter' | 'growth' | 'scale';

function mustGet(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function variantIdForTier(tier: Tier): string {
  if (tier === 'starter') return mustGet('LEMONSQUEEZY_VARIANT_ID_STARTER');
  if (tier === 'growth') return mustGet('LEMONSQUEEZY_VARIANT_ID_GROWTH');
  return mustGet('LEMONSQUEEZY_VARIANT_ID_SCALE');
}

async function lemonFetch(path: string, init: RequestInit) {
  const apiKey = mustGet('LEMONSQUEEZY_API_KEY');

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    logger.error({ status: res.status, body: json || text }, '[LemonSqueezy] API error');
    throw new Error(`LemonSqueezy API error: ${res.status}`);
  }

  return json;
}

export async function createLemonCheckout(params: {
  tier: Tier;
  userId: string;
  email: string;
  name?: string | null;
  redirectUrl: string;
}): Promise<{ checkoutId: string; url: string }> {
  const storeId = mustGet('LEMONSQUEEZY_STORE_ID');
  const variantId = variantIdForTier(params.tier);

  // JSON:API payload (works on most Lemon setups; adjust if your dashboard expects different attributes)
  const payload = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          email: params.email,
          name: params.name || undefined,
          custom: { userId: params.userId, tier: params.tier },
        },
        product_options: { redirect_url: params.redirectUrl },
      },
      relationships: {
        store: { data: { type: 'stores', id: String(storeId) } },
        variant: { data: { type: 'variants', id: String(variantId) } },
      },
    },
  };

  const json = await lemonFetch('/checkouts', { method: 'POST', body: JSON.stringify(payload) });

  const checkoutId = String(json?.data?.id || '');
  const url = String(json?.data?.attributes?.url || '');
  if (!checkoutId || !url) throw new Error('Invalid LemonSqueezy checkout response');

  return { checkoutId, url };
}

export function verifyLemonWebhookSignature(params: {
  rawBody: Buffer;
  signatureHeader: string;
  secret: string;
}): boolean {
  const expected = crypto.createHmac('sha256', params.secret).update(params.rawBody).digest('hex');
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(params.signatureHeader, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function extractLemonEvent(payload: any): {
  eventName: string | null;
  custom: Record<string, any>;
  variantId: string | null;
  checkoutId: string | null;
  subscriptionId: string | null;
} {
  const eventName =
    payload?.meta?.event_name ||
    payload?.meta?.eventName ||
    payload?.meta?.event ||
    null;

  const custom =
    payload?.meta?.custom_data ||
    payload?.data?.attributes?.custom_data ||
    payload?.data?.attributes?.checkout_data?.custom ||
    {};

  const variantId = payload?.data?.attributes?.variant_id ? String(payload.data.attributes.variant_id) : null;
  const checkoutId = payload?.data?.attributes?.checkout_id ? String(payload.data.attributes.checkout_id) : null;
  const subscriptionId = payload?.data?.id ? String(payload.data.id) : null;

  return { eventName, custom, variantId, checkoutId, subscriptionId };
}

export async function createLemonCheckoutForVariant(params: {
  variantId: string;
  userId: string;
  email: string;
  name?: string | null;
  redirectUrl: string;
  custom: Record<string, any>;
}): Promise<{ checkoutId: string; url: string }> {
  const storeId = mustGet('LEMONSQUEEZY_STORE_ID');

  const payload = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          email: params.email,
          name: params.name || undefined,
          custom: params.custom,
        },
        product_options: { redirect_url: params.redirectUrl },
      },
      relationships: {
        store: { data: { type: 'stores', id: String(storeId) } },
        variant: { data: { type: 'variants', id: String(params.variantId) } },
      },
    },
  };

  const json = await lemonFetch('/checkouts', { method: 'POST', body: JSON.stringify(payload) });

  const checkoutId = String(json?.data?.id || '');
  const url = String(json?.data?.attributes?.url || '');
  if (!checkoutId || !url) throw new Error('Invalid LemonSqueezy checkout response');

  return { checkoutId, url };
}