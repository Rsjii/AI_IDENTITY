import { apiFetch } from './api';

export type BillingCountry = 'IN' | 'OTHER';
type TierInput = 'starter' | 'growth' | 'scale';

const BILLING_COUNTRY_KEY = 'selflyx.billingCountry';

export function getLastBillingCountry(): BillingCountry | null {
  try {
    const v = localStorage.getItem(BILLING_COUNTRY_KEY);
    return v === 'IN' || v === 'OTHER' ? v : null;
  } catch {
    return null;
  }
}

export function setLastBillingCountry(v: BillingCountry) {
  try {
    localStorage.setItem(BILLING_COUNTRY_KEY, v);
  } catch {}
}

type CheckoutResponse =
  | { gateway: 'lemonsqueezy'; url: string }
  | { gateway: 'razorpay'; keyId: string; tier: string; order: { id: string; amount: number; currency: string } };

export async function startPlanCheckout(params: {
  tier: TierInput;
  returnUrl?: string;
  billingCountry: BillingCountry;
}) {
  // ✅ persist last choice (works even if we redirect to LemonSqueezy)
  setLastBillingCountry(params.billingCountry);

  const r = await apiFetch<CheckoutResponse>('/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({
      tier: params.tier,
      returnUrl: params.returnUrl,
      billingCountry: params.billingCountry,
    }),
  });

  if (r.gateway === 'lemonsqueezy') {
    window.location.href = r.url;
    return;
  }

  // Razorpay
  if (!window.Razorpay) throw new Error('Razorpay not loaded');

  await new Promise<void>((resolve, reject) => {
    const rz = new window.Razorpay({
      key: r.keyId,
      amount: r.order.amount,
      currency: r.order.currency,
      order_id: r.order.id,
      name: 'Selflyx',
      description: `Plan: ${r.tier}`,
      handler: async (resp: any) => {
        try {
          await apiFetch('/api/billing/razorpay/verify', {
            method: 'POST',
            body: JSON.stringify({
              tier: r.tier,
              orderId: r.order.id,
              paymentId: resp.razorpay_payment_id,
              signature: resp.razorpay_signature,
            }),
          });
          resolve();
        } catch (e: any) {
          reject(new Error(e?.message || 'Verification failed'));
        }
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    });

    rz.open();
  });
}