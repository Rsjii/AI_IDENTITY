import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

type Tier = 'free' | 'pro' | 'teams';

export function PricingPage() {
  const { state } = useAuth();
  const [tier, setTier] = useState<Tier>('free');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (state.status === 'authenticated') {
      apiFetch<any>('/api/payment/subscription')
        .then((r) => setTier((r?.tier as Tier) || 'free'))
        .catch(() => setTier('free'));
    }
  }, [state.status]);

  const loadRazorpay = (): Promise<void> =>
    new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve();
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load Razorpay'));
      document.body.appendChild(s);
    });

  const upgrade = async (t: 'pro' | 'teams') => {
    if (state.status !== 'authenticated') {
      window.location.href = '/auth';
      return;
    }

    setLoading(true);
    setError('');

    try {
      const orderRes = await apiFetch<any>('/api/payment/create-order', {
        method: 'POST',
        body: JSON.stringify({ tier: t }),
      });

      if (!orderRes?.success) {
        throw new Error(orderRes?.error || 'Payments are disabled (server).');
      }

      await loadRazorpay();

      const key = import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!key) throw new Error('Missing VITE_RAZORPAY_KEY_ID');

      const options = {
        key,
        order_id: orderRes.order.id,
        amount: orderRes.order.amount,
        currency: orderRes.order.currency,
        name: 'Selflyx',
        description: `Upgrade to ${t.toUpperCase()}`,
        handler: async (resp: any) => {
          try {
            const verifyRes = await apiFetch<any>('/api/payment/verify', {
              method: 'POST',
              body: JSON.stringify({
                tier: t,
                orderId: resp.razorpay_order_id,
                paymentId: resp.razorpay_payment_id,
                signature: resp.razorpay_signature,
              }),
            });

            if (!verifyRes?.success) throw new Error(verifyRes?.error || 'Verification failed');
            setTier(t);
          } catch (e: any) {
            setError(e?.message || 'Payment verification failed');
          } finally {
            setLoading(false);
          }
        },
        modal: { ondismiss: () => setLoading(false) },
        prefill: { email: state.user?.email || '', name: state.user?.name || '' },
        theme: { color: '#6366f1' },
      };

      new window.Razorpay(options).open();
    } catch (e: any) {
      setError(e?.message || 'Payment failed');
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Pricing</h1>
          <p className="text-muted-foreground">Choose the plan that fits your needs</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Free</CardTitle>
              <CardDescription>Perfect for trying out</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">₹0<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> 10 mirrors/month</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> 1 identity</li>
              </ul>
              <Button className="w-full" variant="outline" disabled={tier === 'free'}>{tier === 'free' ? 'Current Plan' : 'Free'}</Button>
            </CardContent>
          </Card>

          <Card className={`glass ${tier === 'pro' ? 'border-primary' : ''}`}>
            <CardHeader>
              <CardTitle>Pro</CardTitle>
              <CardDescription>₹999/mo unlimited</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Unlimited mirrors</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Gmail extension</li>
              </ul>
              <Button className="w-full" disabled={loading || tier === 'pro'} onClick={() => upgrade('pro')}>
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>) : tier === 'pro' ? 'Current Plan' : 'Upgrade to Pro'}
              </Button>
            </CardContent>
          </Card>

          <Card className={`glass ${tier === 'teams' ? 'border-primary' : ''}`}>
            <CardHeader>
              <CardTitle>Teams</CardTitle>
              <CardDescription>₹4999/mo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> 5 users</li>
              </ul>
              <Button className="w-full" variant="outline" disabled={loading || tier === 'teams'} onClick={() => upgrade('teams')}>
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>) : tier === 'teams' ? 'Current Plan' : 'Upgrade to Teams'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
