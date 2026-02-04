import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '@/contexts/AuthContext';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface PaymentPromptProps {
  creatorId: string;
  sessionId: string;
  paymentOptions: {
    tiers: { amount: number; label: string }[];
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

export function PaymentPrompt(props: PaymentPromptProps) {
  const { state } = useAuth();
  const isAuthed = state.status === 'authenticated';
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = React.useState<number>(() => {
    const fallback = props.paymentOptions.tiers?.[0]?.amount || 500;
    return props.paymentOptions.defaultAmount && props.paymentOptions.tiers.some((t) => t.amount === props.paymentOptions.defaultAmount)
      ? props.paymentOptions.defaultAmount
      : fallback;
  });
  const [payerEmail, setPayerEmail] = React.useState<string>('');
  const [visitorId, setVisitorId] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [subLoading, setSubLoading] = React.useState(false);

  // Get visitor ID from localStorage
  useEffect(() => {
    const k = 'selflyx_visitor_id';
    const existing = localStorage.getItem(k);
    if (existing) {
      setVisitorId(existing);
    }
  }, []);

  // Fetch payment intent when amount/email changes
  const fetchPaymentIntent = React.useCallback(async () => {
    if (!selectedAmount || !payerEmail) return;
    setLoading(true);
    setError(null);
    setClientSecret(null);
    try {
      const selectedTier = props.paymentOptions.tiers.find((t) => t.amount === selectedAmount);
      const res = await apiFetch<{ clientSecret: string }>(
        '/api/payments/pay-per-chat/intent',
        {
          method: 'POST',
          body: JSON.stringify({
            creatorId: props.creatorId,
            amountCents: selectedAmount,
            tierLabel: selectedTier?.label || `$${(selectedAmount / 100).toFixed(2)}`,
            visitorId,
            sessionId: props.sessionId,
            payerEmail: payerEmail || undefined,
          }),
        }
      );
      setClientSecret(res.clientSecret);
    } catch (err: any) {
      setError(err.message || 'Failed to create payment intent.');
    } finally {
      setLoading(false);
    }
  }, [props.creatorId, selectedAmount, visitorId, props.sessionId, payerEmail, props.paymentOptions.tiers]);

  const startSubscription = async () => {
    const opt = props.subscriptionOption;
    if (!opt?.listingId || !opt.priceCents) return;

    const returnTo = props.returnTo || window.location.pathname + window.location.search;

    if (!isAuthed) {
      window.location.href = `/auth?next=${encodeURIComponent(returnTo)}`;
      return;
    }

    setSubLoading(true);
    try {
      const res = await apiFetch<{ url: string }>('/api/marketplace/subscriptions/checkout', {
        method: 'POST',
        body: JSON.stringify({
          listingId: opt.listingId,
          successUrl: `${window.location.origin}${returnTo}${returnTo.includes('?') ? '&' : '?'}subscribed=1`,
          cancelUrl: `${window.location.origin}${returnTo}${returnTo.includes('?') ? '&' : '?'}cancelled=1`,
        }),
      });
      window.location.href = res.url;
    } catch (e: any) {
      if (e.message?.includes('not connected Stripe') || e.message?.includes('Creator has not connected')) {
        setError('This creator has not set up payouts yet. Subscription is temporarily unavailable.');
      } else {
        setError(e.message || 'Failed to start subscription.');
      }
    } finally {
      setSubLoading(false);
    }
  };

  if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
    return (
      <Card className="glass shadow-sm">
        <CardHeader>
          <CardTitle>Payment Unavailable</CardTitle>
          <CardDescription>Stripe is not configured.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="glass shadow-sm">
      <CardHeader>
        <CardTitle>Unlock Premium Content</CardTitle>
        <CardDescription>
          Unlock the full answer and get <strong>24-hour unlimited access</strong> to this session.
          You'll also receive the full answer via email after payment.
          <div className="mt-2 text-xs text-muted-foreground">
            Platform fee: 25% | Creator earnings: 75%
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {props.subscriptionOption?.priceCents ? (
          <div className="mb-4 rounded-xl border border-border-default bg-bg-tertiary/30 p-4">
            <div className="text-sm font-semibold text-text-primary">Better value</div>
            <div className="text-sm text-text-secondary mt-1">
              Subscribe for <strong>${(props.subscriptionOption.priceCents / 100).toFixed(2)}/month</strong> — unlimited chats.
            </div>
            <div className="mt-3">
              <Button className="w-full h-12" onClick={startSubscription} disabled={subLoading}>
                {subLoading ? 'Starting…' : 'Subscribe monthly'}
              </Button>
              <div className="text-xs text-muted-foreground mt-2">Requires account</div>
            </div>
          </div>
        ) : null}

        {/* Step 1: Collect email and tier BEFORE creating Elements */}
        {!clientSecret ? (
          <div className="space-y-4">
            {props.previewText ? (
              <div className="mb-4 p-3 rounded-lg border border-border-default bg-bg-tertiary/40">
                <div className="text-xs font-semibold mb-1">Preview</div>
                <div className="text-sm max-h-28 overflow-hidden" style={{ maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)' }}>
                  {props.previewText}
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="email-input" className="text-base font-semibold">Email (for receipt + full answer):</Label>
              <Input
                id="email-input"
                type="email"
                value={payerEmail}
                onChange={(e) => setPayerEmail(e.target.value)}
                placeholder="your@email.com"
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier-select" className="text-base font-semibold">Choose your tier:</Label>
              <Select
                value={String(selectedAmount)}
                onValueChange={(value: string) => setSelectedAmount(Number(value))}
              >
                <SelectTrigger id="tier-select" className="h-12">
                  <SelectValue placeholder="Select a tier" />
                </SelectTrigger>
                <SelectContent>
                  {props.paymentOptions.tiers.map((tier) => (
                    <SelectItem key={tier.amount} value={String(tier.amount)} className="py-3">
                      <div className="flex items-center justify-between w-full">
                        <span>{tier.label}</span>
                        <span className="font-semibold ml-4">${(tier.amount / 100).toFixed(2)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && (
              <div className="text-sm text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                {error}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={fetchPaymentIntent}
                className="flex-1 h-12 bg-gradient-to-r from-accent-primary to-accent-secondary hover:opacity-90 transition-all font-semibold"
                disabled={loading || !payerEmail}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Continue to Payment
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={props.onCancel} disabled={loading} className="h-12">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* Step 2: Only render Elements AFTER clientSecret is ready */
          <Elements
            stripe={stripePromise}
            options={{ clientSecret }}
          >
            <CheckoutFormWithPayment
              selectedAmount={selectedAmount}
              payerEmail={payerEmail}
              clientSecret={clientSecret}
              onSuccess={props.onSuccess}
              onCancel={props.onCancel}
              onBack={() => setClientSecret(null)}
              sessionId={props.sessionId}
              creatorId={props.creatorId}
              messageIdToUnlock={props.messageIdToUnlock}
            />
          </Elements>
        )}
      </CardContent>
    </Card>
  );
}

// Separate component that only renders when clientSecret is available
const CheckoutFormWithPayment: React.FC<{
  selectedAmount: number;
  payerEmail: string;
  clientSecret: string;
  onSuccess: (reply?: string, premiumExpiresAt?: string) => void;
  onCancel: () => void;
  onBack: () => void;
  sessionId: string;
  creatorId: string;
  messageIdToUnlock?: string;
}> = ({ selectedAmount, payerEmail, clientSecret, onSuccess, onCancel, onBack, sessionId, creatorId, messageIdToUnlock }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: window.location.href,
          receipt_email: payerEmail,
        },
        redirect: 'if_required',
      });

      if (error) {
        setMessage(error.message || 'Payment failed.');
        setLoading(false);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        try {
          const result = await apiFetch<{ success: boolean; reply?: string; premiumExpiresAt?: string }>('/api/payments/pay-per-chat/confirm', {
            method: 'POST',
            body: JSON.stringify({
              paymentIntentId: paymentIntent.id,
              sessionId,
              creatorId,
              amountCents: selectedAmount,
              messageId: messageIdToUnlock || undefined, // NEW
            }),
          });
          setPaymentSuccess(true);
          setMessage('Payment succeeded! Your full answer is ready');

          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#8B5CF6', '#6366F1', '#EC4899', '#F59E0B'],
          });

          setTimeout(() => {
            onSuccess(result.reply, result.premiumExpiresAt);
          }, 2000);
        } catch (err: any) {
          setMessage(err.message || 'Payment succeeded but confirmation failed.');
          setLoading(false);
        }
      } else {
        setMessage('Payment processing. Please wait.');
        setLoading(false);
      }
    } catch (err: any) {
      setMessage(err.message || 'Payment failed.');
      setLoading(false);
    }
  };

  if (paymentSuccess) {
    return (
      <div className="space-y-4 text-center py-8 animate-fade-in">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <CheckCircle2 className="h-16 w-16 text-green-500 animate-scale-in" />
            <Sparkles className="h-8 w-8 text-yellow-400 absolute -top-2 -right-2 animate-pulse" />
          </div>
        </div>
        <h3 className="text-2xl font-bold text-text-primary">Payment Successful!</h3>
        <p className="text-text-secondary">
          Your full answer is being prepared. You'll receive it in the chat and via email.
        </p>
        <div className="pt-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-full">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              Unlocked: ${((selectedAmount || 0) / 100).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-sm text-muted-foreground mb-2">
        Paying ${(selectedAmount / 100).toFixed(2)} • {payerEmail}
        <button type="button" onClick={onBack} className="ml-2 text-accent-primary hover:underline">
          Change
        </button>
      </div>

      <div className="bg-bg-tertiary/50 p-4 rounded-lg border border-border-default">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          type="submit"
          className="flex-1 h-12 bg-gradient-to-r from-accent-primary to-accent-secondary hover:opacity-90 transition-all font-semibold"
          disabled={loading || !stripe || !elements || paymentSuccess}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing Payment...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Pay ${((selectedAmount || 0) / 100).toFixed(2)}
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading || paymentSuccess} className="h-12">
          Cancel
        </Button>
      </div>
      {message && (
        <div className={`text-sm text-center p-3 rounded-lg ${
          message.includes('succeeded')
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
        }`}>
          {message}
        </div>
      )}
    </form>
  );
};