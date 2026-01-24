import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export function AdminUserPage() {
  const { userId } = useParams();
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      setError('');
      try {
        const res = await apiFetch<any>(`/api/admin/users/${userId}`);
        setData(res?.data || null);
      } catch (err: any) {
        setError(err.message || 'Failed to load user.');
      }
    })();
  }, [userId]);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User</h1>
            <p className="text-muted-foreground mt-1">{userId}</p>
          </div>
          <Button variant="outline" onClick={() => window.location.href = '/admin'}>
            Back
          </Button>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="glass">
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>User information and activity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-card/40 p-4">
              <div className="text-sm font-medium">{data?.user?.email}</div>
              <div className="text-xs text-muted-foreground">
                {data?.user?.name ? `${data.user.name} • ` : ''}{data?.user?.handle ? `@${data.user.handle} • ` : ''}{data?.user?.profileCompleted ? 'Profile ✅' : 'Profile ❌'}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Created: {data?.user?.createdAt} • TZ: {data?.user?.timeZone || '—'}
              </div>
            </div>

            <div className="rounded-xl border bg-card/40 p-4">
              <div className="text-sm font-medium mb-2">Recent runs</div>
              <div className="space-y-3">
                {(data?.runs || []).slice(0, 20).map((r: any) => (
                  <div key={r.id} className="rounded-lg border bg-background/50 p-3">
                    <div className="text-xs text-muted-foreground">{r.createdAt} • {r.context} • {r.model}</div>
                    <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{r.incomingMessage}</div>
                    <div className="mt-2 text-sm whitespace-pre-wrap">{r.outputReply}</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Tokens: {(r.tokensIn || 0) + (r.tokensOut || 0)} • Confirm: {r.confirmEvent || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}