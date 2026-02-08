// Stripe removed - stub functions for backward compatibility
// These functions are not used in runtime (Stripe routes disabled)

export function getStripe(): never {
  throw new Error('Stripe has been removed. Use Razorpay (India) or LemonSqueezy (International) instead.');
}

export function mustGetStripeWebhookSecret(): never {
  throw new Error('Stripe has been removed.');
}

export function getStripePriceId(_tier: 'starter' | 'growth' | 'scale'): never {
  throw new Error('Stripe has been removed. Use Razorpay or LemonSqueezy instead.');
}

export async function createWhatsAppPaymentLink(_params: {
  amountCents: number;
  creatorId: string;
  visitorId?: string | null;
  sessionId?: string | null;
  tierLabel?: string;
  returnUrl?: string;
}): Promise<never> {
  throw new Error('WhatsApp payment links are disabled (Stripe removed).');
}
