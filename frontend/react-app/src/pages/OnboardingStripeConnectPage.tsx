import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useOnboardingGuard, usePreventBack } from '@/hooks/useOnboardingGuard';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CreditCard, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export function OnboardingStripeConnectPage() {
  const nav = useNavigate();
  const { state, refresh } = useAuth();
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);

  const user = state.status === 'authenticated' ? state.user : null;
  const planTier = (user as any)?.planTier || 'free';
  const stripeConnectId = (user as any)?.stripeConnectId;

  // ✅ Redirect to dashboard if onboarding is already complete
  useOnboardingGuard();

  // ✅ Prevent back navigation
  usePreventBack();

  // Check if Stripe is already connected
  useEffect(() => {
    const checkStatus = async () => {
      if (stripeConnectId) {
        try {
          const status = await apiFetch('/api/creator/stripe/status');
          if (status.connected) {
            setStripeConnected(true);
            // Auto-proceed to deploy if already connected
            setTimeout(async () => {
              try {
                await apiFetch('/api/creator/onboarding/step', {
                  method: 'POST',
                  body: JSON.stringify({ step: 'deploy' }),
                });
                await refresh();
                nav('/onboarding/deploy', { replace: true });
              } catch (error: any) {
                // Ignore errors, user can click continue manually
              }
            }, 1000);
          }
        } catch (err) {
          // Ignore errors
        }
      }
    };
    checkStatus();
  }, [stripeConnectId, refresh, nav]);

  // If free tier, skip this step
  useEffect(() => {
    if (planTier === 'free') {
      nav('/onboarding/deploy', { replace: true });
    }
  }, [planTier, nav]);

  const handleConnectStripe = async () => {
    setConnecting(true);
    try {
      const frontendUrl = window.location.origin;
      const returnUrl = `${frontendUrl}/onboarding/stripe-connect?connected=1`;
      const refreshUrl = `${frontendUrl}/onboarding/stripe-connect?refresh=1`;

      const res = await apiFetch<{ url: string }>('/api/creator/stripe/connect', {
        method: 'POST',
        body: JSON.stringify({
          returnUrl,
          refreshUrl,
        }),
      });

      if (res.url) {
        window.location.href = res.url;
      } else {
        showToast('Failed to generate Stripe Connect link', 'error');
        setConnecting(false);
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to connect Stripe', 'error');
      setConnecting(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      // Update onboarding step to deploy (skip Stripe Connect)
      await apiFetch('/api/creator/onboarding/step', {
        method: 'POST',
        body: JSON.stringify({ step: 'deploy' }),
      });

      await refresh();
      nav('/onboarding/deploy', { replace: true });
    } catch (error: any) {
      showToast(error.message || 'Failed to continue', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    setLoading(true);
    try {
      // Update onboarding step to deploy
      await apiFetch('/api/creator/onboarding/step', {
        method: 'POST',
        body: JSON.stringify({ step: 'deploy' }),
      });

      await refresh();
      nav('/onboarding/deploy', { replace: true });
    } catch (error: any) {
      showToast(error.message || 'Failed to continue', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Check if returning from Stripe OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      // Refresh auth to get updated stripeConnectId
      refresh().then(async () => {
        setStripeConnected(true);
        showToast('Stripe account connected successfully!', 'success');
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
        
        // Auto-proceed to deploy after a short delay
        setTimeout(async () => {
          try {
            await apiFetch('/api/creator/onboarding/step', {
              method: 'POST',
              body: JSON.stringify({ step: 'deploy' }),
            });
            await refresh();
            nav('/onboarding/deploy', { replace: true });
          } catch (error: any) {
            showToast(error.message || 'Failed to continue', 'error');
          }
        }, 1500);
      });
    }
  }, [refresh, nav]);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Get Paid</h1>
          <p className="text-muted-foreground mt-1">
            Connect your Stripe account to receive earnings from visitor payments.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex gap-2">
          {['Quiz', 'Content', 'Pricing', 'Plan', 'Stripe', 'Deploy'].map((step, i) => (
            <div key={step} className={`h-2 flex-1 rounded ${i <= 4 ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        {/* Main Content */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Connect Stripe Account</CardTitle>
            <CardDescription>
              To receive payments from visitors, you need to connect a Stripe account. 
              This is secure and takes just a few minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {stripeConnected ? (
              // Already connected
              <div className="space-y-4">
                <Alert className="border-green-500/30 bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription>
                    <strong>Stripe account connected!</strong> You're all set to receive payments.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <h3 className="font-semibold">What happens next?</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>When visitors pay, 75% goes directly to your Stripe account</li>
                    <li>Platform fee (25%) is automatically deducted</li>
                    <li>You can withdraw funds anytime from your Stripe dashboard</li>
                    <li>Payouts are typically processed within 2-7 business days</li>
                  </ul>
                </div>

                <Button
                  onClick={handleContinue}
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Continuing...
                    </>
                  ) : (
                    <>
                      Continue to Deploy
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            ) : (
              // Not connected
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Why connect Stripe?
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Receive 75% of all visitor payments directly to your bank</li>
                    <li>Secure OAuth connection (we never see your banking details)</li>
                    <li>Instant payouts to your bank account</li>
                    <li>Required to accept payments from visitors</li>
                  </ul>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Don't have a Stripe account?</strong> No problem! The connection process 
                    will guide you through creating one. It only takes a few minutes.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleConnectStripe}
                    disabled={connecting || loading}
                    className="flex-1"
                    size="lg"
                  >
                    {connecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Connect Stripe Account
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleSkip}
                    disabled={connecting || loading}
                    variant="outline"
                    size="lg"
                  >
                    Skip for Now
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  You can connect Stripe later from Settings → Billing. However, you won't be able 
                  to receive payments until Stripe is connected.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

