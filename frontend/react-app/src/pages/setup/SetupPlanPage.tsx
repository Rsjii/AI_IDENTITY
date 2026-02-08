import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { startPlanCheckout, getLastBillingCountry, setLastBillingCountry, type BillingCountry } from '@/lib/planCheckout';
import { useAuth } from '@/contexts/AuthContext';
import { formatMonthlyPrice } from '@/lib/planPriceBook';

const PLANS = [
  {
    id: 'trial',
    name: 'Free Trial',
    price: '$0',
    period: 'for 7 days',
    description: 'Then upgrade to a paid plan or downgrade to free',
    features: ['All features unlocked', '5,000 chats/month', 'Monetization enabled', 'Marketplace listing', 'Email support'],
    badge: '🎁 RECOMMENDED',
    recommended: true,
    action: 'trial',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$49',
    period: '/month',
    description: '5K chats/month',
    features: ['Marketplace listing', 'Monetization', 'Email support'],
    action: 'starter',
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$149',
    period: '/month',
    description: '25K chats/month',
    features: ['Everything in Starter', 'Custom branding', 'Priority support', 'Advanced analytics'],
    action: 'growth',
  },
  {
    id: 'scale',
    name: 'Scale',
    price: '$499',
    period: '/month',
    description: 'Unlimited chats',
    features: ['Everything in Growth', 'Unlimited chats', 'Dedicated manager', 'WhatsApp integration'],
    badge: '⚡ UNLIMITED',
    action: 'scale',
  },
];

export function SetupPlanPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [loading, setLoading] = useState('');

  const userPhone = state.status === 'authenticated' ? (state.user as any)?.phone || '' : '';
  const defaultBillingCountry: BillingCountry = useMemo(() => {
    const stored = getLastBillingCountry();
    if (stored) return stored;

    const p = String(userPhone || '').trim();
    if (p.startsWith('+91') || p.startsWith('91')) return 'IN';

    // Soft hint: browser locale/timezone
    if (typeof navigator !== 'undefined') {
      const lang = navigator.language || '';
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (lang.toLowerCase().includes('-in') || tz === 'Asia/Kolkata') return 'IN';
    }

    return 'OTHER';
  }, [userPhone]);

  const [billingCountry, setBillingCountry] = useState<BillingCountry>(defaultBillingCountry);

  const handleSelectPlan = async (action: string) => {
    setLoading(action);
    try {
      if (action === 'trial') {
        await apiFetch('/api/creator/trial/start', { method: 'POST' });
      } else {
        await startPlanCheckout({
          tier: action as any,
          returnUrl: '/setup?paid=1',
          billingCountry,
        });
        // Razorpay path continues:
        await apiFetch('/api/creator/setup/step', {
          method: 'POST',
          body: JSON.stringify({ step: 'plan', completed: true }),
        });
        showToast('Plan selected!', 'success');
        navigate('/setup');
        return;
      }

      await apiFetch('/api/creator/setup/step', {
        method: 'POST',
        body: JSON.stringify({ step: 'plan', completed: true }),
      });

      showToast('Plan selected!', 'success');
      navigate('/setup');
    } catch (error: any) {
      showToast(error.message || 'Failed to select plan', 'error');
    } finally {
      setLoading('');
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold gradient-text">Choose Your Platform Plan 📊</h1>
          <p className="text-lg text-muted-foreground">Start with a free trial, upgrade when ready</p>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Billing country</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">India → Razorpay • Outside India → LemonSqueezy</div>
            <select
              className="border rounded-md px-3 py-2 bg-background text-sm"
              value={billingCountry}
              onChange={(e) => {
                const v = e.target.value as BillingCountry;
                setBillingCountry(v);
                setLastBillingCountry(v);
              }}
              disabled={!!loading}
            >
              <option value="IN">India</option>
              <option value="OTHER">Outside India</option>
            </select>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-4 gap-6">
          {PLANS.map((plan) => (
            <Card key={plan.id} className={`relative glass transition-all hover:scale-105 ${plan.recommended ? 'border-2 border-accent-primary' : ''}`}>
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-none px-4 py-1">
                    {plan.badge}
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    {plan.action === 'trial' 
                      ? '$0'
                      : plan.action === 'starter' 
                        ? formatMonthlyPrice(billingCountry, 'starter').replace('/mo', '')
                        : plan.action === 'growth'
                          ? formatMonthlyPrice(billingCountry, 'growth').replace('/mo', '')
                          : plan.action === 'scale'
                            ? formatMonthlyPrice(billingCountry, 'scale').replace('/mo', '')
                            : plan.price}
                  </span>
                  <span className="text-muted-foreground text-sm ml-1">{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${plan.recommended ? 'bg-gradient-to-r from-accent-primary to-accent-secondary' : ''}`}
                  variant={plan.recommended ? 'default' : 'outline'}
                  onClick={() => handleSelectPlan(plan.action)}
                  disabled={loading === plan.action}
                >
                  {loading === plan.action ? 'Processing...' : plan.recommended ? 'Start Free Trial' : `Choose ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Compare Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Feature</th>
                    <th className="text-center py-3 px-4">Free</th>
                    <th className="text-center py-3 px-4">Starter</th>
                    <th className="text-center py-3 px-4">Growth</th>
                    <th className="text-center py-3 px-4">Scale</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b"><td className="py-3 px-4">Chats/month</td><td className="text-center">500</td><td className="text-center">5,000</td><td className="text-center">25,000</td><td className="text-center font-semibold">Unlimited</td></tr>
                  <tr className="border-b"><td className="py-3 px-4">Monetization</td><td className="text-center">❌</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td></tr>
                  <tr className="border-b"><td className="py-3 px-4">Marketplace</td><td className="text-center">❌</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td></tr>
                  <tr><td className="py-3 px-4">Custom branding</td><td className="text-center">❌</td><td className="text-center">❌</td><td className="text-center">✅</td><td className="text-center">✅</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full" onClick={() => navigate('/setup')}>Skip - Stay on Free</Button>
      </div>
    </Layout>
  );
}