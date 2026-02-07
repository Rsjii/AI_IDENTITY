import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Zap, TrendingUp, Building2, HelpCircle } from 'lucide-react';
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
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Choose Your Plan</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free, upgrade anytime. Simple monthly pricing. Keep 75% of your earnings.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Plan Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Free Plan */}
          <Card className="glass border-border-default relative">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Free
                <Badge variant="outline">Testing</Badge>
              </CardTitle>
              <CardDescription>Perfect for trying out</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">
                $0
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
              <div className="text-sm text-muted-foreground mb-4">
                500 chats/month
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Create AI clone</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Upload content</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Chat link</span>
                </li>
                <li className="flex items-center gap-2">
                  <X className="h-4 w-4 text-red-500" />
                  <span className="text-muted-foreground">Public marketplace</span>
                </li>
                <li className="flex items-center gap-2">
                  <X className="h-4 w-4 text-red-500" />
                  <span className="text-muted-foreground">Monetization</span>
                </li>
                <li className="flex items-center gap-2">
                  <X className="h-4 w-4 text-red-500" />
                  <span className="text-muted-foreground">Website widget</span>
                </li>
              </ul>
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Zap className="h-3 w-3" />
                  <span>Best for: Testing your AI</span>
                </div>
                <Button variant="outline" className="w-full" disabled>
                  Current Plan
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Starter Plan */}
          <Card className="glass border-accent-primary/30 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-accent-primary text-white">Most Popular</Badge>
            </div>
            <CardHeader>
              <CardTitle>Starter</CardTitle>
              <CardDescription>Start earning money</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">
                $49
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
              <div className="text-sm text-muted-foreground mb-4">
                5,000 chats/month
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Everything in Free</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Public marketplace</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Monetization (earn $)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Website widget</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Standard analytics</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Email support</span>
                </li>
              </ul>
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <TrendingUp className="h-3 w-3" />
                  <span>Best for: Beginners</span>
                </div>
                <Button className="w-full" disabled={loading} onClick={() => goStripe('starter')}>
                  Choose Starter
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Growth Plan */}
          <Card className="glass border-border-default relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge variant="secondary">Best Value</Badge>
            </div>
            <CardHeader>
              <CardTitle>Growth</CardTitle>
              <CardDescription>Scale your audience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">
                $99
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
              <div className="text-sm text-muted-foreground mb-4">
                25,000 chats/month
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Everything in Starter</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>5x more chats</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Advanced analytics</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Priority support</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>All integrations</span>
                </li>
              </ul>
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <TrendingUp className="h-3 w-3" />
                  <span>Best for: Growing creators</span>
                </div>
                <Button className="w-full" disabled={loading} onClick={() => goStripe('growth')}>
                  Choose Growth
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Scale Plan */}
          <Card className="glass border-border-default relative">
            <CardHeader>
              <CardTitle>Scale</CardTitle>
              <CardDescription>Enterprise features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">
                $199
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
              <div className="text-sm text-muted-foreground mb-4">
                Unlimited chats
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Everything in Growth</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Unlimited chats</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>A/B Testing</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>White-label option</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Dedicated support</span>
                </li>
              </ul>
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Building2 className="h-3 w-3" />
                  <span>Best for: Established brands</span>
                </div>
                <Button className="w-full" disabled={loading} onClick={() => goStripe('scale')}>
                  Choose Scale
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Feature Comparison Table */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Feature Comparison</CardTitle>
            <CardDescription>See what's included in each plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">Feature</th>
                    <th className="text-center p-3 font-semibold">Free</th>
                    <th className="text-center p-3 font-semibold">Starter</th>
                    <th className="text-center p-3 font-semibold">Growth</th>
                    <th className="text-center p-3 font-semibold">Scale</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Price</td>
                    <td className="text-center p-3">$0</td>
                    <td className="text-center p-3">$49/mo</td>
                    <td className="text-center p-3">$99/mo</td>
                    <td className="text-center p-3">$199/mo</td>
                  </tr>
                  <tr className="border-b bg-bg-tertiary/30">
                    <td className="p-3 font-medium">Monthly Chats</td>
                    <td className="text-center p-3">500</td>
                    <td className="text-center p-3">5,000</td>
                    <td className="text-center p-3">25,000</td>
                    <td className="text-center p-3 font-semibold text-accent-primary">Unlimited</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">AI Clone Creation</td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Content Upload</td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                  </tr>
                  <tr className="border-b bg-red-500/5">
                    <td className="p-3 font-medium">Public Marketplace</td>
                    <td className="text-center p-3"><X className="h-4 w-4 mx-auto text-red-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                  </tr>
                  <tr className="border-b bg-red-500/5">
                    <td className="p-3 font-medium">Monetization (Earn Money)</td>
                    <td className="text-center p-3"><X className="h-4 w-4 mx-auto text-red-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Chat Link</td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                  </tr>
                  <tr className="border-b bg-red-500/5">
                    <td className="p-3 font-medium">Website Widget</td>
                    <td className="text-center p-3"><X className="h-4 w-4 mx-auto text-red-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Analytics</td>
                    <td className="text-center p-3 text-muted-foreground">Basic</td>
                    <td className="text-center p-3 text-muted-foreground">Standard</td>
                    <td className="text-center p-3 font-medium">Advanced</td>
                    <td className="text-center p-3 font-medium">Advanced</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Support</td>
                    <td className="text-center p-3 text-muted-foreground">Email</td>
                    <td className="text-center p-3 text-muted-foreground">Email</td>
                    <td className="text-center p-3 font-medium">Priority</td>
                    <td className="text-center p-3 font-medium">Dedicated</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">A/B Testing</td>
                    <td className="text-center p-3"><X className="h-4 w-4 mx-auto text-red-500" /></td>
                    <td className="text-center p-3"><X className="h-4 w-4 mx-auto text-red-500" /></td>
                    <td className="text-center p-3"><X className="h-4 w-4 mx-auto text-red-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">White-label</td>
                    <td className="text-center p-3"><X className="h-4 w-4 mx-auto text-red-500" /></td>
                    <td className="text-center p-3"><X className="h-4 w-4 mx-auto text-red-500" /></td>
                    <td className="text-center p-3"><X className="h-4 w-4 mx-auto text-red-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Can I upgrade later?</h3>
              <p className="text-sm text-muted-foreground">
                Yes! You can upgrade or downgrade your plan anytime. Changes take effect immediately.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What happens if I hit my chat limit?</h3>
              <p className="text-sm text-muted-foreground">
                You'll receive a notification when you're close to your limit. Upgrade to a higher plan for more chats, or wait until next month.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Can I monetize on the free plan?</h3>
              <p className="text-sm text-muted-foreground">
                No. Monetization (earning money from visitors) requires a paid plan (Starter, Growth, or Scale). Free plan is for testing only.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Can I make my AI public on the free plan?</h3>
              <p className="text-sm text-muted-foreground">
                No. Your AI clone will be private on the free plan. Upgrade to any paid plan to make it public in the marketplace.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">How much do I earn from monetization?</h3>
              <p className="text-sm text-muted-foreground">
                You keep 75% of all earnings. Platform takes 25% as a transaction fee. For example, if a visitor pays $10, you get $7.50.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
              <p className="text-sm text-muted-foreground">
                Yes, you can cancel your subscription anytime. You'll retain access until the end of your billing period.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
