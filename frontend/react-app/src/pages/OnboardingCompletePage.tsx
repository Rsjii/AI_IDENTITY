import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingGuard, useRedirectBack } from '@/hooks/useOnboardingGuard';
import {
  Loader2,
  DollarSign,
  BarChart3,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  Zap,
} from 'lucide-react';

export function OnboardingCompletePage() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [loading, setLoading] = useState(false);

  // Redirect to dashboard if onboarding is already complete
  useOnboardingGuard();

  // ✅ Back should go to dashboard (not Step2)
  useRedirectBack('/dashboard');

  const handleSetupMonetization = async () => {
    setLoading(true);
    try {
      // Don't mark onboarding as done yet, go to setup flow
      nav('/setup', { replace: true });
    } catch (error: any) {
      showToast(error.message || 'Failed to continue', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExploreDashboard = async () => {
    setLoading(true);
    try {
      // Mark onboarding as done
      await apiFetch('/api/creator/onboarding/step', {
        method: 'POST',
        body: JSON.stringify({ step: 'done' }),
      });

      await refresh();
      nav('/dashboard', { replace: true });
    } catch (error: any) {
      showToast(error.message || 'Failed to continue', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center p-6">
      <div className="w-full max-w-4xl space-y-6">
        {/* Success Header */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
          <div>
            <h1 className="text-4xl font-bold mb-2">Your AI is Live!</h1>
            <p className="text-text-secondary text-lg">
              Congratulations! Your AI clone is ready to chat with visitors.
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex gap-2 max-w-md mx-auto">
          {['Start', 'Upload', 'Preview', 'Complete'].map((step) => (
            <div key={step} className={`h-2 flex-1 rounded bg-accent-primary`} />
          ))}
        </div>

        {/* Choice Cards */}
        <div className="grid md:grid-cols-2 gap-6 mt-8">
          {/* Card 1: Setup Monetization */}
          <Card className="glass hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-accent-primary/50">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent-primary to-purple-600 flex items-center justify-center mb-4">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-xl">Setup Monetization</CardTitle>
              <CardDescription className="text-base">
                Configure pricing, plans, and payment methods to start earning from your AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-accent-primary" />
                  <span>Set your pricing (pay-per-chat & subscription)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-accent-primary" />
                  <span>Choose your creator plan</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-accent-primary" />
                  <span>Connect Stripe to receive payments</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-accent-primary" />
                  <span>Share your AI with the world</span>
                </div>
              </div>

              <div className="rounded-lg bg-accent-primary/10 border border-accent-primary/20 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-accent-primary" />
                  <span className="font-semibold">Recommended for creators who want to monetize</span>
                </div>
              </div>

              <Button
                onClick={handleSetupMonetization}
                disabled={loading}
                className="w-full bg-accent-gradient hover:opacity-90 text-white"
                size="lg"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <>
                    Setup Now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-xs text-text-tertiary text-center">
                Takes 5 minutes - Can be changed anytime
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Explore Dashboard */}
          <Card className="glass hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-accent-primary/50">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-xl">Explore Dashboard</CardTitle>
              <CardDescription className="text-base">
                Skip setup for now and explore your creator dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  <span>View AI conversations and analytics</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  <span>Manage your content and AI training</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  <span>Customize AI personality and responses</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  <span>Setup monetization later from settings</span>
                </div>
              </div>

              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-blue-500" />
                  <span className="font-semibold">Get familiar with the platform first</span>
                </div>
              </div>

              <Button
                onClick={handleExploreDashboard}
                disabled={loading}
                variant="outline"
                size="lg"
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <>
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-xs text-text-tertiary text-center">
                You can setup monetization anytime from the dashboard
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Info Banner */}
        <div className="rounded-xl bg-gradient-to-r from-accent-primary/10 to-purple-500/10 border border-accent-primary/20 p-6 text-center">
          <Sparkles className="h-8 w-8 text-accent-primary mx-auto mb-3" />
          <h3 className="font-semibold text-lg mb-2">What's Next?</h3>
          <p className="text-sm text-text-secondary max-w-2xl mx-auto">
            Whether you choose to setup monetization now or explore first, you can always configure
            pricing, plans, and payment methods from your dashboard settings. There's no wrong choice!
          </p>
        </div>
      </div>
    </div>
  );
}
