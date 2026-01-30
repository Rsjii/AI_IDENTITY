import Stripe from 'stripe';

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY missing');
    stripe = new Stripe(key, { apiVersion: '2023-10-16' });
  }
  return stripe;
}

export function mustGetStripeWebhookSecret(): string {
  const s = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s) throw new Error('STRIPE_WEBHOOK_SECRET missing');
  return s;
}

export function getStripePriceId(tier: 'starter' | 'growth' | 'scale'): string {
  const map = {
    starter: process.env.STRIPE_PRICE_STARTER,
    growth: process.env.STRIPE_PRICE_GROWTH,
    scale: process.env.STRIPE_PRICE_SCALE,
  };
  const v = map[tier];
  if (!v) throw new Error(`Stripe price id missing for tier=${tier}`);
  return v;
}

export async function createWhatsAppPaymentLink(params: {
  amountCents: number;
  creatorId: string;
  visitorId?: string | null;
  sessionId?: string | null;
  tierLabel?: string;
  returnUrl?: string;
}) {
  const stripeClient = getStripe();

  const label = params.tierLabel || `$${(params.amountCents / 100).toFixed(2)}`;
  const returnUrl = params.returnUrl || (process.env.FRONTEND_URL || 'https://selflyx.com');

  const link = await stripeClient.paymentLinks.create({
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: params.amountCents,
          product_data: {
            name: `Pay-per-chat (${label})`,
          },
        },
        quantity: 1,
      },
    ],
    after_completion: {
      type: 'redirect',
      redirect: { url: returnUrl },
    },
    metadata: {
      creatorId: params.creatorId,
      visitorId: params.visitorId || '',
      sessionId: params.sessionId || '',
      tierAmountCents: String(params.amountCents),
      tierLabel: label,
      platform: 'whatsapp',
    },
  });

  return link.url;
}