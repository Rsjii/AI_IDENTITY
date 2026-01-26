import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { Loader2 } from 'lucide-react';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface PaymentPromptProps {
  creatorId: string;
  sessionId: string;
  paymentOptions: {
    premium: { amount: number; label: string };
    vip: { amount: number; label: string };
  };
  onSuccess: () => void;
  onCancel: () => void;
}

const CheckoutForm: React.FC<{
  creatorId: string;
  sessionId: string;
  paymentOptions: PaymentPromptProps['paymentOptions'];
  onSuccess: () => void;
  onCancel: () => void;
}> = ({ creatorId, sessionId, paymentOptions, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<'premium' | 'vip'>('premium');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState<string>('');

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
      if (!selectedTier) return;
      setLoading(true);
      setMessage(null);
      try {
        const res = await apiFetch<{ clientSecret: string }>(
          '/api/payments/pay-per-chat/intent',
          {
            method: 'POST',
            body: JSON.stringify({
              creatorId,
              tier: selectedTier,
              visitorId,
              sessionId,
            }),
          }
        );
        setClientSecret(res.clientSecret);
      } catch (err: any) {
        setMessage(err.message || 'Failed to create payment intent.');
      } finally {
        setLoading(false);
      }
    };
    fetchPaymentIntent();
  }, [creatorId, selectedTier, visitorId, sessionId]);

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
          return_url: `${window.location.origin}/chat/${creatorId}?payment_success=true`,
        },
        redirect: 'if_required',
      });

      if (error) {
        setMessage(error.message || 'Payment failed.');
        setLoading(false);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Confirm payment on backend
        try {
          await apiFetch('/api/payments/pay-per-chat/confirm', {
            method: 'POST',
            body: JSON.stringify({
              paymentIntentId: paymentIntent.id,
              sessionId,
              creatorId,
              tier: selectedTier,
            }),
          });
          setMessage('Payment succeeded!');
          setTimeout(() => {
            onSuccess();
          }, 1000);
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tier-select">Choose your tier:</Label>
        <Select
          value={selectedTier}
          onValueChange={(value: 'premium' | 'vip') => {
            setSelectedTier(value);
            setClientSecret(null); // Reset to fetch new intent
          }}
        >
          <SelectTrigger id="tier-select">
            <SelectValue placeholder="Select a tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="premium">
              {paymentOptions.premium.label} - ${(paymentOptions.premium.amount / 100).toFixed(2)}
            </SelectItem>
            <SelectItem value="vip">
              {paymentOptions.vip.label} - ${(paymentOptions.vip.amount / 100).toFixed(2)}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {clientSecret && (
        <PaymentElement options={{ layout: 'tabs' }} />
      )}

      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={loading || !stripe || !elements || !clientSecret}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Pay Now'
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
      {message && (
        <div className={`text-sm text-center ${message.includes('succeeded') ? 'text-green-600' : 'text-red-500'}`}>
          {message}
        </div>
      )}
    </form>
  );
};

export function PaymentPrompt(props: PaymentPromptProps) {
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
        <CardDescription>Choose a tier to get a detailed response.</CardDescription>
      </CardHeader>
      <CardContent>
        {stripePromise && (
          <Elements stripe={stripePromise}>
            <CheckoutForm {...props} />
          </Elements>
        )}
      </CardContent>
    </Card>
  );
}
