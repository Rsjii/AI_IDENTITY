import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function PricingPage() {
  const { state } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const goStripe = async (tier: 'starter' | 'growth' | 'scale') => {
    if (state.status !== 'authenticated') {
      window.location.href = '/auth';
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await apiFetch<{ url: string }>('/api/billing/stripe/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ tier }),
      });
      window.location.href = r.url;
    } catch (e: any) {
      setError(e.message || 'Stripe checkout failed');
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Pricing</h1>
          <p className="text-muted-foreground">7-day free trial + paid plans via Stripe</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-4 gap-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Free</CardTitle>
              <CardDescription>500 chats/month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Basic features only</li>
              </ul>
              <Button className="w-full" variant="outline">Current</Button>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Starter</CardTitle>
              <CardDescription>$49/mo (5K chats)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Website widget</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> All features</li>
              </ul>
              <Button className="w-full" disabled={loading} onClick={() => goStripe('starter')}>Choose</Button>
            </CardContent>
          </Card>

          <Card className="glass border-primary/30">
            <CardHeader>
              <CardTitle>Growth</CardTitle>
              <CardDescription>$149/mo (25K chats)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" disabled={loading} onClick={() => goStripe('growth')}>Choose</Button>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Scale</CardTitle>
              <CardDescription>$499/mo (Unlimited)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" disabled={loading} onClick={() => goStripe('scale')}>Choose</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
