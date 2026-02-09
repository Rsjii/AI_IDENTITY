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
  onSessionId?: (sid: string) => void;
}

type PayPerChatIntentResponse =
  | { gateway: 'lemonsqueezy'; url: string; sessionId: string }
  | {
      gateway: 'razorpay';
      keyId: string;
      order: { id: string; amount: number; currency: string };
      creatorId: string;
      sessionId: string;
    };

type PaymentMode = 'pay-once' | 'subscribe';

export function PaymentPrompt(props: PaymentPromptProps) {
  const { state } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<PaymentMode>('pay-once');

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

  // Pay-per-chat unlock
  const unlockPayPerChat = async () => {
    setLoading(true);
    try {
      setLastBillingCountry(billingCountry);
      const intent = await apiFetch<PayPerChatIntentResponse>('/api/payments/pay-per-chat/intent', {
        method: 'POST',
        body: JSON.stringify({
          creatorId: props.creatorId,
          sessionId: props.sessionId || undefined,
          billingCountry,
          returnUrl: props.returnTo || window.location.pathname,
        }),
      });

      const resolvedSessionId = intent.sessionId || props.sessionId;
      if (resolvedSessionId && resolvedSessionId !== props.sessionId) {
        props.onSessionId?.(resolvedSessionId);
      }

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
                  sessionId: resolvedSessionId,
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

  // Subscribe
  const subscribe = async () => {
    if (!props.subscriptionOption) return;

    setLoading(true);
    try {
      setLastBillingCountry(billingCountry);

      // Call subscription checkout endpoint
      const response = await apiFetch<{ url: string }>('/api/marketplace/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          listingId: props.subscriptionOption.listingId,
          billingCountry,
          returnUrl: props.returnTo || window.location.pathname,
        }),
      });

      // Redirect to checkout
      window.location.href = response.url;
    } catch (e: any) {
      showToast(e.message || 'Subscription failed', 'error');
      setLoading(false);
    }
  };

  const payPerChatPriceCents = props.paymentOptions?.payPerChatPriceCents || 0;
  const subscriptionPriceCents = props.subscriptionOption?.priceCents || 0;

  const payPerChatPrice = billingCountry === 'IN'
    ? `₹${(payPerChatPriceCents / 100).toFixed(2)}`
    : `$${(payPerChatPriceCents / 100).toFixed(2)}`;

  const subscriptionPrice = billingCountry === 'IN'
    ? `₹${(subscriptionPriceCents / 100).toFixed(2)}`
    : `$${(subscriptionPriceCents / 100).toFixed(2)}`;

  // Calculate savings
  const monthlyEquivalentCents = payPerChatPriceCents * 30;
  const savingsPercent = subscriptionPriceCents > 0 && monthlyEquivalentCents > 0
    ? Math.round((1 - subscriptionPriceCents / monthlyEquivalentCents) * 100)
    : 0;

  const monthlyEquivalentPrice = billingCountry === 'IN'
    ? `₹${(monthlyEquivalentCents / 100).toFixed(0)}`
    : `$${(monthlyEquivalentCents / 100).toFixed(0)}`;

  // Only show tabs if both options are available
  const showTabs = payPerChatPriceCents > 0 && subscriptionPriceCents > 0;

  return (
    <Card className="glass shadow-sm">
      <CardHeader>
        <CardTitle>
          {showTabs ? 'Choose your plan' : 'Unlock to continue'}
        </CardTitle>
        <CardDescription>
          {showTabs
            ? `Get access to ${props.creatorName || 'this creator'}'s AI`
            : 'Pay to unlock 24h access for this creator\'s AI.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {props.previewText ? (
          <div className="text-sm text-muted-foreground border rounded-md p-3">
            {props.previewText}
          </div>
        ) : null}

        {/* Tabs */}
        {showTabs && (
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setActiveTab('pay-once')}
              disabled={loading}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'pay-once'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Pay Once
            </button>
            <button
              onClick={() => setActiveTab('subscribe')}
              disabled={loading}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'subscribe'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Subscribe
            </button>
          </div>
        )}

        {/* Pay Once Content */}
        {(activeTab === 'pay-once' || !showTabs) && payPerChatPriceCents > 0 && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <div className="text-3xl font-bold">{payPerChatPrice}</div>
              <div className="text-sm text-muted-foreground">One-time payment</div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Unlimited messages for 24 hours</span>
              </div>
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Full access to AI knowledge</span>
              </div>
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>No recurring charges</span>
              </div>
            </div>

            {showTabs && savingsPercent > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3 text-sm">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <div className="font-medium text-blue-900 dark:text-blue-100">💡 Tip: Subscribe to save {savingsPercent}%</div>
                    <div className="text-blue-700 dark:text-blue-300 mt-1">
                      Monthly subscription: {subscriptionPrice}/mo (vs {monthlyEquivalentPrice}/year pay-once)
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Subscribe Content */}
        {activeTab === 'subscribe' && showTabs && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <div className="text-3xl font-bold">{subscriptionPrice}<span className="text-lg text-muted-foreground">/month</span></div>
              <div className="text-sm text-muted-foreground">Cancel anytime</div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span><strong>Unlimited messages</strong> (no time limit)</span>
              </div>
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Access to future content updates</span>
              </div>
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Priority support</span>
              </div>
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Cancel anytime (no commitment)</span>
              </div>
            </div>

            {savingsPercent > 0 && (
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md p-3 text-sm">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <div className="font-medium text-green-900 dark:text-green-100">💰 Save {savingsPercent}% vs pay-per-chat</div>
                    <div className="text-green-700 dark:text-green-300 mt-1">
                      {subscriptionPrice}/mo vs {monthlyEquivalentPrice}/year
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Billing country selector */}
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

        {/* Action buttons */}
        <div className="space-y-2">
          {activeTab === 'pay-once' || !showTabs ? (
            <Button onClick={unlockPayPerChat} disabled={loading} className="w-full" size="lg">
              {loading ? 'Processing…' : `Pay ${payPerChatPrice} - 24h Access`}
            </Button>
          ) : (
            <Button onClick={subscribe} disabled={loading} className="w-full" size="lg">
              {loading ? 'Processing…' : `Subscribe - ${subscriptionPrice}/mo`}
            </Button>
          )}

          <Button onClick={props.onCancel} variant="outline" className="w-full" disabled={loading}>
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
