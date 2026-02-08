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

export type CheckoutResponse =
  | { gateway: 'lemonsqueezy'; url: string }
  | { gateway: 'razorpay'; keyId: string; tier: string; order: { id: string; amount: number; currency: string } };

export async function startPlanCheckout(params: {
  tier: TierInput;
  returnUrl?: string;
  billingCountry: BillingCountry;
}): Promise<CheckoutResponse> {
  console.log('[PLAN-CHECKOUT] === Starting plan checkout ===');
  console.log('[PLAN-CHECKOUT] Params:', params);
  
  // ✅ persist last choice (works even if we redirect to LemonSqueezy)
  setLastBillingCountry(params.billingCountry);
  console.log('[PLAN-CHECKOUT] 💾 Saved billing country to localStorage:', params.billingCountry);

  console.log('[PLAN-CHECKOUT] 📤 Calling /api/billing/checkout...');
  const r = await apiFetch<CheckoutResponse>('/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({
      tier: params.tier,
      returnUrl: params.returnUrl,
      billingCountry: params.billingCountry,
    }),
  });
  console.log('[PLAN-CHECKOUT] ✅ Checkout API response:', r);

  if (r.gateway === 'lemonsqueezy') {
    console.log('[PLAN-CHECKOUT] 🍋 Redirecting to LemonSqueezy:', r.url);
    window.location.href = r.url;
    return r; // ✅ never return void
  }

  // Razorpay
  console.log('[PLAN-CHECKOUT] 💳 Setting up Razorpay payment...');
  if (!window.Razorpay) {
    console.error('[PLAN-CHECKOUT] ❌ Razorpay SDK not loaded');
    throw new Error('Razorpay not loaded');
  }
  console.log('[PLAN-CHECKOUT] ✅ Razorpay SDK loaded');

  await new Promise<void>((resolve, reject) => {
    console.log('[PLAN-CHECKOUT] 🔧 Creating Razorpay instance with:', {
      key: r.keyId,
      amount: r.order.amount,
      currency: r.order.currency,
      order_id: r.order.id,
    });
    
    const rz = new window.Razorpay({
      key: r.keyId,
      amount: r.order.amount,
      currency: r.order.currency,
      order_id: r.order.id,
      name: 'Selflyx',
      description: `Plan: ${r.tier}`,
      handler: async (resp: any) => {
        console.log('[PLAN-CHECKOUT] ✅ Razorpay payment successful:', resp);
        console.log('[PLAN-CHECKOUT] 📤 Verifying payment with backend...');
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
          console.log('[PLAN-CHECKOUT] ✅ Payment verified successfully');
          resolve();
        } catch (e: any) {
          console.error('[PLAN-CHECKOUT] ❌ Payment verification failed:', e);
          reject(new Error(e?.message || 'Verification failed'));
        }
      },
      modal: {
        ondismiss: () => {
          console.log('[PLAN-CHECKOUT] ⚠️ Payment modal dismissed by user');
          reject(new Error('Payment cancelled'));
        },
      },
    });

    console.log('[PLAN-CHECKOUT] 🚀 Opening Razorpay payment modal...');
    rz.open();
  });

  return r; // ✅ Razorpay callers can log/order-id etc
}