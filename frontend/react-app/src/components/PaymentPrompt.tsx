import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/contexts/AuthContext';
import { getLastBillingCountry, setLastBillingCountry, type BillingCountry } from '@/lib/planCheckout';

interface PaymentPromptProps {
  creatorId: string;
  sessionId: string;
  paymentOptions: {
    payPerChatPriceCents?: number;
    tiers?: { amount: number; label: string }[];
    defaultAmount?: number;
  };
  subscriptionOption?: {
    listingId: string;
    priceCents: number;
    currency?: string;
  };
  returnTo?: string;
  previewText?: string;
  messageIdToUnlock?: string;
  creatorName?: string;
  onSuccess: (reply?: string, premiumExpiresAt?: string) => void;
  onCancel: () => void;
}

type PayPerChatIntentResponse =
  | { gateway: 'lemonsqueezy'; url: string }
  | { gateway: 'razorpay'; keyId: string; order: { id: string; amount: number; currency: string }; creatorId: string; sessionId: string };

export function PaymentPrompt(props: PaymentPromptProps) {
  const { state } = useAuth();
  const [loading, setLoading] = useState(false);

  const userPhone = state.status === 'authenticated' ? (state.user as any)?.phone || '' : '';
  const defaultBillingCountry: BillingCountry = useMemo(() => {
    const stored = getLastBillingCountry();
    if (stored) return stored;

    const p = String(userPhone || '').trim();
    if (p.startsWith('+91') || p.startsWith('91')) return 'IN';

    if (typeof navigator !== 'undefined') {
      const lang = navigator.language || '';
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (lang.toLowerCase().includes('-in') || tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'IN';
    }

    return 'OTHER';
  }, [userPhone]);

  const [billingCountry, setBillingCountry] = useState<BillingCountry>(defaultBillingCountry);

  const unlock = async () => {
    setLoading(true);
    try {
      setLastBillingCountry(billingCountry);
      const intent = await apiFetch<PayPerChatIntentResponse>('/api/payments/pay-per-chat/intent', {
        method: 'POST',
        body: JSON.stringify({
          creatorId: props.creatorId,
          sessionId: props.sessionId,
          billingCountry,
          returnUrl: props.returnTo || window.location.pathname,
        }),
      });

      if (intent.gateway === 'lemonsqueezy') {
        window.location.href = intent.url;
        return;
      }

      if (!window.Razorpay) throw new Error('Razorpay not loaded');

      const rz = new window.Razorpay({
        key: intent.keyId,
        amount: intent.order.amount,
        currency: intent.order.currency,
        order_id: intent.order.id,
        name: 'Selflyx',
        description: 'Unlock 24h access',
        handler: async (resp: any) => {
          try {
            const confirm = await apiFetch<{ success: true; premiumExpiresAt?: string }>(
              '/api/payments/pay-per-chat/confirm',
              {
                method: 'POST',
                body: JSON.stringify({
                  creatorId: props.creatorId,
                  sessionId: props.sessionId,
                  orderId: intent.order.id,
                  paymentId: resp.razorpay_payment_id,
                  signature: resp.razorpay_signature,
                }),
              }
            );

            showToast('Unlocked!', 'success');
            props.onSuccess(undefined, confirm.premiumExpiresAt);
          } catch (e: any) {
            showToast(e.message || 'Payment confirmation failed', 'error');
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
      });

      rz.open();
    } catch (e: any) {
      showToast(e.message || 'Payment failed', 'error');
      setLoading(false);
    }
  };

  const priceCents = props.paymentOptions?.payPerChatPriceCents || 0;
  const priceDisplay = priceCents > 0 
    ? (billingCountry === 'IN' ? `₹${(priceCents / 100).toFixed(2)}` : `$${(priceCents / 100).toFixed(2)}`)
    : '';

  return (
    <Card className="glass shadow-sm">
      <CardHeader>
        <CardTitle>Unlock to continue</CardTitle>
        <CardDescription>Pay to unlock 24h access for this creator's AI.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.previewText ? (
          <div className="text-sm text-muted-foreground border rounded-md p-3">
            {props.previewText}
          </div>
        ) : null}

        {priceDisplay && (
          <div className="text-center text-2xl font-bold">
            {priceDisplay}
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Billing country:</span>
          <select
            value={billingCountry}
            onChange={(e) => setBillingCountry(e.target.value as BillingCountry)}
            className="px-2 py-1 border rounded"
            disabled={loading}
          >
            <option value="IN">India (Razorpay)</option>
            <option value="OTHER">Outside India (LemonSqueezy)</option>
          </select>
        </div>

        <Button onClick={unlock} disabled={loading} className="w-full">
          {loading ? 'Processing…' : 'Unlock now'}
        </Button>

        <Button onClick={props.onCancel} variant="outline" className="w-full" disabled={loading}>
          Close
        </Button>
      </CardContent>
    </Card>
  );
}
