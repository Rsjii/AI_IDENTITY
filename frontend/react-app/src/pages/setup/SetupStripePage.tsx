import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';

export function SetupStripePage() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // ✅ Verify real status from backend
  useEffect(() => {
    apiFetch('/api/creator/stripe/status')
      .then((s: any) => {
        const ok = s?.connected === true && s?.detailsSubmitted === true && s?.payoutsEnabled === true;
        if (ok) {
          setConnected(true);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const markComplete = async () => {
    await apiFetch('/api/creator/setup/step', {
      method: 'POST',
      body: JSON.stringify({ step: 'stripe', completed: true }),
    });
  };

  // ✅ If verified, mark complete once (best-effort)
  useEffect(() => {
    if (!connected || checking) return;
    markComplete()
      .then(() => {
        showToast('Stripe connected & verified!', 'success');
        setTimeout(() => navigate('/setup'), 1200);
      })
      .catch(() => {});
  }, [connected, checking]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/creator/stripe/connect', { method: 'POST' });
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to connect', 'error');
      setLoading(false);
    }
  };

  if (connected) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Card className="glass max-w-md">
            <CardContent className="pt-6 text-center">
              <Check className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Stripe Connected!</h2>
              <p className="text-muted-foreground">Redirecting to setup...</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-3xl gradient-text">Connect Stripe to Get Paid 💳</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <p className="text-lg">Link your Stripe account to receive payouts from visitor payments.</p>

            <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
              <CardContent className="pt-6 space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Secure OAuth (1-click)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Instant payouts to your bank</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Automatic 75/25 split</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Tax compliant</span>
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full bg-gradient-to-r from-accent-primary to-accent-secondary text-white py-6 text-lg"
              onClick={handleConnect}
              disabled={loading}
            >
              {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Connecting...</> : 'Connect Stripe Account'}
            </Button>

            <p className="text-sm text-muted-foreground text-center">
              Don&apos;t have Stripe? We&apos;ll help you create an account (takes 2 min)
            </p>

            <Button variant="outline" className="w-full" onClick={() => navigate('/setup')}>
              Skip for Now
            </Button>

            <p className="text-xs text-muted-foreground text-center">(You can connect later in Settings)</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}