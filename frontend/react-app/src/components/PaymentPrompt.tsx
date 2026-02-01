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

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface PaymentPromptProps {
  creatorId: string;
  sessionId: string;
  paymentOptions: {
    tiers: { amount: number; label: string }[];
    defaultAmount?: number;
  };
  onSuccess: (reply?: string) => void;
  onCancel: () => void;
}

const CheckoutForm: React.FC<{
  creatorId: string;
  sessionId: string;
  paymentOptions: PaymentPromptProps['paymentOptions'];
  onSuccess: () => void;
  onCancel: () => void;
  onClientSecretChange: (secret: string | null) => void;
}> = ({ creatorId, sessionId, paymentOptions, onSuccess, onCancel, onClientSecretChange }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(() => {
    const fallback = paymentOptions.tiers?.[0]?.amount || 500;
    return paymentOptions.defaultAmount && paymentOptions.tiers.some((t) => t.amount === paymentOptions.defaultAmount)
      ? paymentOptions.defaultAmount
      : fallback;
  });
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState<string>('');
  const [payerEmail, setPayerEmail] = useState<string>('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    // Get visitor ID from localStorage
    const k = 'selflyx_visitor_id';
    const existing = localStorage.getItem(k);
    if (existing) {
      setVisitorId(existing);
    }
  }, []);

  useEffect(() => {
    const fetchPaymentIntent = async () => {
      if (!selectedAmount) return;
      setLoading(true);
      setMessage(null);
      try {
        const selectedTier = paymentOptions.tiers.find((t) => t.amount === selectedAmount);
        const res = await apiFetch<{ clientSecret: string }>(
          '/api/payments/pay-per-chat/intent',
          {
            method: 'POST',
            body: JSON.stringify({
              creatorId,
              amountCents: selectedAmount,
              tierLabel: selectedTier?.label || `$${(selectedAmount / 100).toFixed(2)}`,
              visitorId,
              sessionId,
              payerEmail: payerEmail || undefined,
            }),
          }
        );
        setClientSecret(res.clientSecret);
        onClientSecretChange(res.clientSecret);
      } catch (err: any) {
        setMessage(err.message || 'Failed to create payment intent.');
        onClientSecretChange(null);
      } finally {
        setLoading(false);
      }
    };
    fetchPaymentIntent();
  }, [creatorId, selectedAmount, visitorId, sessionId, payerEmail, onClientSecretChange, paymentOptions.tiers]);

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
        },
        redirect: 'if_required',
      });

      if (error) {
        setMessage(error.message || 'Payment failed.');
        setLoading(false);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Confirm payment on backend and get reply
        try {
          const result = await apiFetch<{ success: boolean; reply?: string }>('/api/payments/pay-per-chat/confirm', {
            method: 'POST',
            body: JSON.stringify({
              paymentIntentId: paymentIntent.id,
              sessionId,
              creatorId,
              amountCents: selectedAmount,
            }),
          });
          setPaymentSuccess(true);
          setMessage('Payment succeeded! Your full answer is ready 🎉');
          
          // ✅ Confetti animation on payment success
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#8B5CF6', '#6366F1', '#EC4899', '#F59E0B'],
          });
          
          setTimeout(() => {
            // ✅ Pass the reply to onSuccess callback
            onSuccess(result.reply);
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
      <div className="space-y-2">
        <Label htmlFor="email-input" className="text-base font-semibold">Email (for receipt + full answer):</Label>
        <Input
          id="email-input"
          type="email"
          value={payerEmail}
          onChange={(e) => setPayerEmail(e.target.value)}
          placeholder="your@email.com"
          className="h-12"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tier-select" className="text-base font-semibold">Choose your tier:</Label>
        <Select
          value={String(selectedAmount)}
          onValueChange={(value: string) => {
            const amount = Number(value);
            setSelectedAmount(amount);
            setClientSecret(null); // Reset to fetch new intent
            onClientSecretChange(null);
          }}
        >
          <SelectTrigger id="tier-select" className="h-12">
            <SelectValue placeholder="Select a tier" />
          </SelectTrigger>
          <SelectContent>
            {paymentOptions.tiers.map((tier) => (
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

      {clientSecret ? (
        <div className="space-y-3">
          <div className="bg-bg-tertiary/50 p-4 rounded-lg border border-border-default">
            <PaymentElement options={{ layout: 'tabs' }} />
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border-default rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading payment form...</span>
            </div>
          ) : (
            'Select a tier to continue'
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button 
          type="submit" 
          className="flex-1 h-12 bg-gradient-to-r from-accent-primary to-accent-secondary hover:opacity-90 transition-all font-semibold" 
          disabled={loading || !stripe || !elements || !clientSecret || paymentSuccess}
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

export function PaymentPrompt(props: PaymentPromptProps) {
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);

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
          Choose a tier to unlock a detailed response. You'll receive the full answer via email after payment.
          <div className="mt-2 text-xs text-muted-foreground">
            Platform fee: 25% | Creator earnings: 75%
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stripePromise && (
          <Elements 
            stripe={stripePromise} 
            options={clientSecret ? { clientSecret } : undefined}
          >
            <CheckoutForm {...props} onClientSecretChange={setClientSecret} />
          </Elements>
        )}
      </CardContent>
    </Card>
  );
}