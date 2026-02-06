import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useOnboardingGuard, usePreventBack } from '@/hooks/useOnboardingGuard';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, DollarSign, CreditCard, MessageSquare, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function OnboardingPricingPage() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [saving, setSaving] = useState(false);

  // Pricing state
  const [payPerChatPriceCents, setPayPerChatPriceCents] = useState<number>(1000); // $10 default
  const [subscriptionPriceCents, setSubscriptionPriceCents] = useState<number>(2000); // $20 default
  const [freeMessageLimit, setFreeMessageLimit] = useState<number>(3);

  // ✅ Redirect to dashboard if onboarding is already complete
  useOnboardingGuard();

  // ✅ Prevent back navigation
  usePreventBack();

  // Load existing pricing if available
  useEffect(() => {
    const loadPricing = async () => {
      try {
        const data = await apiFetch<{
          payPerChatPriceCents?: number;
          subscriptionPriceCents?: number;
          freeMessageLimit?: number;
        }>('/api/creator/pricing');
        
        if (data.payPerChatPriceCents) setPayPerChatPriceCents(data.payPerChatPriceCents);
        if (data.subscriptionPriceCents) setSubscriptionPriceCents(data.subscriptionPriceCents);
        if (data.freeMessageLimit !== undefined) setFreeMessageLimit(data.freeMessageLimit);
      } catch (err) {
        // Ignore errors, use defaults
        console.log('No existing pricing found, using defaults');
      }
    };
    loadPricing();
  }, []);

  const handleSave = async () => {
    // Validation
    if (payPerChatPriceCents < 500 || payPerChatPriceCents > 10000) {
      showToast('Pay-per-chat price must be between $5 and $100', 'error');
      return;
    }
    if (subscriptionPriceCents < 1000 || subscriptionPriceCents > 50000) {
      showToast('Subscription price must be between $10 and $500/month', 'error');
      return;
    }
    if (freeMessageLimit < 0 || freeMessageLimit > 10) {
      showToast('Free message limit must be between 0 and 10', 'error');
      return;
    }

    setSaving(true);
    try {
      await apiFetch('/api/creator/pricing', {
        method: 'POST',
        body: JSON.stringify({
          payPerChatPriceCents,
          subscriptionPriceCents,
          freeMessageLimit,
        }),
      });

      // Update onboarding step to 'plan'
      await apiFetch('/api/creator/onboarding/step', {
        method: 'POST',
        body: JSON.stringify({ step: 'plan' }),
      });

      await refresh();
      showToast('Pricing saved!', 'success');
      nav('/onboarding/plan', { replace: true });
    } catch (error: any) {
      showToast(error.message || 'Failed to save pricing', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Set Your Pricing</h1>
          <p className="text-muted-foreground mt-1">
            Choose how much visitors will pay to chat with your AI. You can change these anytime.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex gap-2">
          {['Quiz', 'Content', 'Pricing', 'Plan', 'Deploy'].map((step, i) => (
            <div key={step} className={`h-2 flex-1 rounded ${i <= 2 ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        {/* Pricing Form */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Monetization Settings</CardTitle>
            <CardDescription>
              Set your prices. You keep 75% of all earnings, platform takes 25%.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Pay-per-chat */}
            <div className="space-y-2">
              <Label htmlFor="pay-per-chat" className="text-base font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Pay-per-chat (24h access)
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  id="pay-per-chat"
                  type="number"
                  min="5"
                  max="100"
                  step="1"
                  value={payPerChatPriceCents / 100}
                  onChange={(e) => {
                    const value = Math.max(5, Math.min(100, Number(e.target.value) || 5));
                    setPayPerChatPriceCents(value * 100);
                  }}
                  className="flex-1"
                />
                <span className="text-muted-foreground text-sm">per 24h unlock</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Recommended: $5-25. Visitors pay this once for 24 hours of unlimited access.
              </p>
            </div>

            {/* Monthly subscription */}
            <div className="space-y-2">
              <Label htmlFor="subscription" className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Monthly subscription
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  id="subscription"
                  type="number"
                  min="10"
                  max="500"
                  step="1"
                  value={subscriptionPriceCents / 100}
                  onChange={(e) => {
                    const value = Math.max(10, Math.min(500, Number(e.target.value) || 10));
                    setSubscriptionPriceCents(value * 100);
                  }}
                  className="flex-1"
                />
                <span className="text-muted-foreground text-sm">/month</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Recommended: $10-50. Visitors subscribe monthly for unlimited access.
              </p>
            </div>

            {/* Free message limit */}
            <div className="space-y-2">
              <Label htmlFor="free-limit" className="text-base font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Free preview messages
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="free-limit"
                  type="number"
                  min="0"
                  max="10"
                  step="1"
                  value={freeMessageLimit}
                  onChange={(e) => {
                    const value = Math.max(0, Math.min(10, Number(e.target.value) || 0));
                    setFreeMessageLimit(value);
                  }}
                  className="w-24"
                />
                <span className="text-muted-foreground text-sm">messages before paywall</span>
              </div>
              <p className="text-xs text-muted-foreground">
                How many free messages visitors get before hitting the paywall. Default: 3.
              </p>
            </div>

            {/* Revenue split info */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Revenue Split:</strong> You earn 75% of all payments, platform takes 25% as fee.
                <br />
                Example: If a visitor pays $10, you get $7.50 and platform gets $2.50.
              </AlertDescription>
            </Alert>

            {/* Action buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1"
                size="lg"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Continue to Plan Selection'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

