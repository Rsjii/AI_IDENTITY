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

  const goStripe = async (tier: 'starter' | 'pro' | 'scale') => {
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
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Pricing</h1>
          <p className="text-muted-foreground">Simple monthly pricing. No transaction fees. Keep 100% of your earnings.</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Basic</CardTitle>
              <CardDescription>5,000 chats/month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-2xl font-bold">
                $49
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Website widget</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Chat link</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Email support</li>
              </ul>
              <Button className="w-full" disabled={loading} onClick={() => goStripe('starter')}>Choose</Button>
            </CardContent>
          </Card>

          <Card className="glass border-primary/30 border-2 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full font-semibold">
              Most Popular
            </div>
            <CardHeader>
              <CardTitle>Pro</CardTitle>
              <CardDescription>25,000 chats/month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-2xl font-bold">
                $99
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Everything in Basic</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> All integrations</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Priority support</li>
              </ul>
              <Button className="w-full" disabled={loading} onClick={() => goStripe('pro')}>Choose</Button>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Scale</CardTitle>
              <CardDescription>Unlimited chats</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-2xl font-bold">
                $199
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Everything in Pro</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Unlimited chats</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> White-label option</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Dedicated support</li>
              </ul>
              <Button className="w-full" disabled={loading} onClick={() => goStripe('scale')}>Choose</Button>
            </CardContent>
          </Card>
        </div>

        {/* Comparison Table */}
        <Card className="glass mt-8">
          <CardHeader>
            <CardTitle>Feature Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Feature</th>
                    <th className="text-center p-2">Basic</th>
                    <th className="text-center p-2">Pro</th>
                    <th className="text-center p-2">Scale</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2">Monthly Chats</td>
                    <td className="text-center p-2">5,000</td>
                    <td className="text-center p-2">25,000</td>
                    <td className="text-center p-2">Unlimited</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">Website Widget</td>
                    <td className="text-center p-2"><Check className="h-4 w-4 mx-auto text-primary" /></td>
                    <td className="text-center p-2"><Check className="h-4 w-4 mx-auto text-primary" /></td>
                    <td className="text-center p-2"><Check className="h-4 w-4 mx-auto text-primary" /></td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">Chat Link</td>
                    <td className="text-center p-2"><Check className="h-4 w-4 mx-auto text-primary" /></td>
                    <td className="text-center p-2"><Check className="h-4 w-4 mx-auto text-primary" /></td>
                    <td className="text-center p-2"><Check className="h-4 w-4 mx-auto text-primary" /></td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">Priority Support</td>
                    <td className="text-center p-2">-</td>
                    <td className="text-center p-2"><Check className="h-4 w-4 mx-auto text-primary" /></td>
                    <td className="text-center p-2"><Check className="h-4 w-4 mx-auto text-primary" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Testimonials */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-center mb-6">What Creators Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="glass">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-4">
                  "Selflyx has transformed how I interact with my audience. The AI clone handles questions 24/7 and I can focus on creating content."
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-semibold">JD</div>
                  <div>
                    <div className="font-semibold text-sm">John Doe</div>
                    <div className="text-xs text-muted-foreground">Content Creator</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-4">
                  "Simple pricing, no hidden fees. I keep 100% of my earnings and the AI handles all my audience questions."
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-semibold">SM</div>
                  <div>
                    <div className="font-semibold text-sm">Sarah Miller</div>
                    <div className="text-xs text-muted-foreground">Business Coach</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-4">
                  "Easy to set up, powerful features, and the support team is amazing. Highly recommend!"
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-semibold">MJ</div>
                  <div>
                    <div className="font-semibold text-sm">Mike Johnson</div>
                    <div className="text-xs text-muted-foreground">Tech Influencer</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
