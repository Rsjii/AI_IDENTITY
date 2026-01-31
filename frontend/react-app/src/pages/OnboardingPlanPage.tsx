import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';

export function OnboardingPlanPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  // ✅ Prevent back navigation to profile page
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const startTrial = async () => {
    setLoading(true);
    await apiFetch('/api/creator/trial/start', { method: 'POST', body: JSON.stringify({}) });
    nav('/onboarding/deploy');
  };

  const checkout = async (tier: 'pro' | 'growth' | 'scale') => {
    setLoading(true);
    try {
      const r = await apiFetch<{ url: string }>('/api/billing/stripe/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ tier }),
      });
      if (r.url) {
        window.location.href = r.url;
      } else {
        showToast('Failed to create checkout session. Please try again.', 'error');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      
      // Handle specific Stripe setup errors
      if (error.errorCode === 'STRIPE_ACCOUNT_SETUP_REQUIRED') {
        showToast('Stripe account setup required. Please complete Stripe setup and try again.', 'warning', 6000);
      } else {
        showToast(error.message || 'Failed to start checkout. Please try again.', 'error');
      }
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Choose your plan</CardTitle>
            <CardDescription>Start with a 7-day free trial or subscribe.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-4">
            <div className="border rounded-md p-4">
              <div className="font-semibold">Free Trial</div>
              <div className="text-sm text-muted-foreground">7 days unlocked</div>
              <Button className="mt-3 w-full" disabled={loading} onClick={startTrial}>Start trial</Button>
            </div>
            <div className="border rounded-md p-4">
              <div className="font-semibold">Pro</div>
              <div className="text-sm text-muted-foreground">$49/mo</div>
              <Button className="mt-3 w-full" disabled={loading} onClick={() => checkout('pro')}>Choose</Button>
            </div>
            <div className="border rounded-md p-4">
              <div className="font-semibold">Growth</div>
              <div className="text-sm text-muted-foreground">$149/mo</div>
              <Button className="mt-3 w-full" disabled={loading} onClick={() => checkout('growth')}>Choose</Button>
            </div>
            <div className="border rounded-md p-4">
              <div className="font-semibold">Scale</div>
              <div className="text-sm text-muted-foreground">$499/mo</div>
              <Button className="mt-3 w-full" disabled={loading} onClick={() => checkout('scale')}>Choose</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}