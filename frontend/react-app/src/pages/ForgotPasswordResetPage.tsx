import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from '@/components/AuthShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

type Step = 'request' | 'verify';

export function ForgotPasswordResetPage() {
  const navigate = useNavigate();
  const q = useQuery();

  const [email, setEmail] = useState(q.get('email') || '');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>(q.get('email') ? 'verify' : 'request');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await apiFetch<{ redirect?: string; message?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      // Backend returns redirect: /forgot-password/reset?email=...
      if (result.redirect) {
        navigate(result.redirect, { replace: true });
      }
      setStep('verify');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await apiFetch<{ redirect?: string; message?: string }>('/api/auth/forgot-password/verify', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });

      // Backend returns redirect: /reset-password?email=...
      if (result.redirect) {
        navigate(result.redirect);
      }
    } catch (err: any) {
      setError(err.message || 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Forgot password" subtitle="We’ll send an OTP to verify it’s you.">
      <Card className="glass shadow-sm">
        <CardHeader>
          <CardTitle>Reset access</CardTitle>
          <CardDescription>
            {step === 'request' ? 'Enter your email to get an OTP.' : 'Enter the OTP sent to your email.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {step === 'request' ? (
            <form onSubmit={requestOtp} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
              </div>

              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  'Send OTP'
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">OTP</label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  placeholder="6-digit OTP"
                  required
                />
              </div>

              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify OTP'
                )}
              </Button>

              <Button type="button" variant="outline" className="w-full" onClick={() => setStep('request')} disabled={loading}>
                Resend OTP
              </Button>
            </form>
          )}

          <div className="text-center">
            <Link to="/auth" className="text-sm text-primary underline-offset-4 hover:underline">
              ← Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}