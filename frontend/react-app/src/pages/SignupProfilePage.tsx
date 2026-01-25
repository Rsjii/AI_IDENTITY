import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { AuthShell } from '@/components/AuthShell';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function SignupProfilePage() {
  const navigate = useNavigate();
  const q = useQuery();

  const email = q.get('email') || '';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch<{ redirect?: string }>(
        '/api/auth/signup/profile',
        {
          method: 'POST',
          body: JSON.stringify({
            email,
            name,
            phone: phone || undefined,
            profileImage: null,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        }
      );
      if (result.redirect) navigate(result.redirect);
    } catch (err: any) {
      setError(err.message || 'Profile save failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Complete profile" subtitle="One last step before you start mirroring.">
      <Card className="glass shadow-sm">
        <CardHeader>
          <CardTitle>Profile details</CardTitle>
          <CardDescription>This helps personalize your identity.</CardDescription>
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
              <Input value={email} type="email" readOnly disabled />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your full name" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Phone (optional)</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 1234567890" />
              <p className="text-xs text-muted-foreground">Format: +[country code] [10 digits]</p>
            </div>

            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
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