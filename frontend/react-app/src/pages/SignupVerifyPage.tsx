import { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { AuthShell } from '@/components/AuthShell';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/lib/toast';
import { usePreventBack } from '@/hooks/useOnboardingGuard';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function SignupVerifyPage() {
  const navigate = useNavigate();
  const q = useQuery();
  const { refresh } = useAuth();

  const initialEmail = q.get('email') || '';
  const nextParam = q.get('next') || '';
  const safeNext = useMemo(() => {
    // only allow internal paths; also avoid looping back into auth/verify
    if (!nextParam.startsWith('/')) return '';
    if (nextParam.startsWith('/auth')) return '';
    if (nextParam.startsWith('/signup/verify')) return '';
    return nextParam;
  }, [nextParam]);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  
  // start timer immediately after first OTP (when arriving with email)
  const [lastSentEmail, setLastSentEmail] = useState(initialEmail);
  const [cooldown, setCooldown] = useState(initialEmail ? 30 : 0);

  // ✅ Prevent back navigation during signup flow
  usePreventBack();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const resend = async () => {
    if (!email) return;
    setResendLoading(true);
    try {
      await apiFetch('/api/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email, type: 'signup' }),
      });
      showToast('OTP sent to your email', 'success', 4000);
      setLastSentEmail(email);
      setCooldown(30);
    } catch (e: any) {
      showToast(e.message || 'Failed to resend OTP', 'error', 5000);
    } finally {
      setResendLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch<{ redirect?: string; message?: string }>(
        '/api/auth/signup/verify',
        { method: 'POST', body: JSON.stringify({ email, code }) }
      );
      await refresh(); // ✅ Refresh auth state after JWT cookie is set

      // ✅ If user originally came from a protected page, go there after verification.
      // ProtectedRoute will still enforce profile/onboarding steps if needed.
      if (safeNext) {
        navigate(safeNext, { replace: true });
        return;
      }

      if (result.redirect) navigate(result.redirect, { replace: true });
      else navigate('/onboarding', { replace: true });      
    } catch (err: any) {
      setError(err.message || 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Verify your email" subtitle="Enter the 6-digit OTP sent to your email.">
      <Card className="glass shadow-sm">
        <CardHeader>
          <CardTitle>Signup verification</CardTitle>
          <CardDescription>OTP expires soon — verify to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-4">
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
                placeholder="123456"
                required
              />
              <p className="text-xs text-muted-foreground">6 digits only</p>
            </div>

            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={resend}
              disabled={loading || resendLoading || (cooldown > 0 && email === lastSentEmail)}
            >
              {cooldown > 0 && email === lastSentEmail ? `Resend OTP (${cooldown}s)` : 'Resend OTP'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}