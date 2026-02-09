import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { TooltipIcon } from '@/components/ui/tooltip';

export function SetupPricingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState({
    payPerChatPriceCents: 1000,
    subscriptionPriceCents: 2000,
    freeMessageLimit: 3,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch('/api/creator/pricing', {
        method: 'POST',
        body: JSON.stringify(pricing),
      });

      await apiFetch('/api/creator/setup/step', {
        method: 'POST',
        body: JSON.stringify({ step: 'pricing', completed: true }),
      });

      showToast('Pricing saved successfully!', 'success');
      navigate('/setup');
    } catch (error: any) {
      showToast(error.message || 'Failed to save pricing', 'error');
    } finally {
      setLoading(false);
    }
  };

  const payPerChat = pricing.payPerChatPriceCents / 100;
  const subscription = pricing.subscriptionPriceCents / 100;
  const creatorEarnings = (pricing.payPerChatPriceCents * 0.75) / 100;
  const platformFee = (pricing.payPerChatPriceCents * 0.25) / 100;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-3xl gradient-text">Set Your Pricing 💰</CardTitle>
            <CardDescription>How much should visitors pay to chat with your AI?</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="payPerChat" className="flex items-center gap-1">
                  Pay-per-chat (24h access)
                  <TooltipIcon content="One-time payment for 24 hours of unlimited access. Great for users who want to try your AI without a recurring commitment. You keep 75% of the payment." />
                </Label>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-2xl">$</span>
                  <Input
                    id="payPerChat"
                    type="number"
                    min="5"
                    max="100"
                    value={payPerChat}
                    onChange={(e) => setPricing({ ...pricing, payPerChatPriceCents: parseFloat(e.target.value) * 100 })}
                    className="text-2xl font-bold p-4"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-1">Recommended: $5-25</p>
              </div>

              <div>
                <Label htmlFor="subscription" className="flex items-center gap-1">
                  Monthly subscription (unlimited)
                  <TooltipIcon content="Recurring monthly subscription for unlimited access. Perfect for building a loyal user base with predictable revenue. Subscribers get unlimited chats every month." />
                </Label>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-2xl">$</span>
                  <Input
                    id="subscription"
                    type="number"
                    min="10"
                    max="500"
                    value={subscription}
                    onChange={(e) => setPricing({ ...pricing, subscriptionPriceCents: parseFloat(e.target.value) * 100 })}
                    className="text-2xl font-bold p-4"
                  />
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Recommended: $10-50</p>
              </div>

              <div>
                <Label htmlFor="freeLimit" className="flex items-center gap-1">
                  Free preview messages
                  <TooltipIcon content="Let users send a few messages for free before requiring payment. This helps them experience your AI's value and increases conversion. Set to 0 to require immediate payment." />
                </Label>
                <Input
                  id="freeLimit"
                  type="number"
                  min="0"
                  max="10"
                  value={pricing.freeMessageLimit}
                  onChange={(e) => setPricing({ ...pricing, freeMessageLimit: parseInt(e.target.value) })}
                  className="mt-2"
                />
                <p className="text-sm text-muted-foreground mt-1">0-10 messages (3-5 recommended for best conversion)</p>
              </div>

              <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2">Revenue Split</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Visitor pays:</span>
                      <span className="font-semibold">${payPerChat.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>You earn (75%):</span>
                      <span className="font-semibold">${creatorEarnings.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Platform fee (25%):</span>
                      <span>${platformFee.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => navigate('/setup')}>
                  Skip for Now
                </Button>
                <Button type="submit" className="flex-1 bg-gradient-to-r from-accent-primary to-accent-secondary" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save & Continue'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
