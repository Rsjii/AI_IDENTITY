import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { AuthShell } from '@/components/AuthShell';
import { useAuth } from '@/contexts/AuthContext';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function LoginVerifyPage() {
  const navigate = useNavigate();
  const q = useQuery();
  const { refresh } = useAuth();

  const [email, setEmail] = useState(q.get('email') || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch<{ redirect?: string; message?: string }>(
        '/api/auth/login/verify',
        { method: 'POST', body: JSON.stringify({ email, code }) }
      );

      await refresh(); // ✅ Refresh auth state after JWT cookie is set
      if (result.redirect) navigate(result.redirect, { replace: true });
      else navigate('/onboarding', { replace: true });      
    } catch (err: any) {
      setError(err.message || 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Confirm login" subtitle="Enter the 6-digit OTP to continue.">
      <Card className="glass shadow-sm">
        <CardHeader>
          <CardTitle>Login verification</CardTitle>
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
                'Continue'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}