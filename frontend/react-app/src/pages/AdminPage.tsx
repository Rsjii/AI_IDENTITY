import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '@/lib/api';

type Range = 'today' | '7d' | '30d';

export function AdminPage() {
  const [range, setRange] = useState<Range>('7d');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setError('');
      try {
        const o = await apiFetch<any>(`/api/admin/overview?range=${range}`);
        const u = await apiFetch<any>(`/api/admin/users?range=${range}&q=${encodeURIComponent(q)}`);
        setOverview(o?.data || null);
        setUsers(u?.rows || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load admin.');
      }
    })();
  }, [range, q]);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
          <p className="text-muted-foreground mt-1">Analytics + users.</p>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {(['today','7d','30d'] as Range[]).map((r) => (
            <Button key={r} size="sm" variant={range === r ? 'default' : 'outline'} onClick={() => setRange(r)}>
              {r}
            </Button>
          ))}
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>Admin overview.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="rounded-xl border bg-card/40 p-4">
              <div className="text-xs text-muted-foreground">Total users</div>
              <div className="text-2xl font-semibold">{overview?.usersTotal ?? 0}</div>
            </div>
            <div className="rounded-xl border bg-card/40 p-4">
              <div className="text-xs text-muted-foreground">New users</div>
              <div className="text-2xl font-semibold">{overview?.usersNew ?? 0}</div>
            </div>
            <div className="rounded-xl border bg-card/40 p-4">
              <div className="text-xs text-muted-foreground">Mirror runs</div>
              <div className="text-2xl font-semibold">{overview?.mirrorRuns ?? 0}</div>
            </div>
            <div className="rounded-xl border bg-card/40 p-4">
              <div className="text-xs text-muted-foreground">Tokens</div>
              <div className="text-2xl font-semibold">{overview?.tokens ?? 0}</div>
            </div>
            <div className="rounded-xl border bg-card/40 p-4">
              <div className="text-xs text-muted-foreground">Trust yes</div>
              <div className="text-2xl font-semibold">{overview?.trustYes ?? 0}</div>
            </div>
            <div className="rounded-xl border bg-card/40 p-4">
              <div className="text-xs text-muted-foreground">Trust no</div>
              <div className="text-2xl font-semibold">{overview?.trustNo ?? 0}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>Click a user to view details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by email / handle / name"
              />
            </div>
            <div className="space-y-2">
              {users.map((u: any) => (
                <Link
                  key={u.id}
                  to={`/admin/users/${u.id}`}
                  className="block rounded-xl border bg-card/40 p-3 hover:bg-card/60 transition-colors"
                >
                  <div className="text-sm font-medium">{u.email || u.handle || u.id}</div>
                  <div className="text-xs text-muted-foreground">
                    {u.name ? `${u.name} • ` : ''}{u.handle ? `@${u.handle} • ` : ''}{u.profileCompleted ? 'Profile ✅' : 'Profile ❌'} • {u.hasIdentity ? 'Identity ✅' : 'Identity ❌'} • Runs: {u.mirrorRuns} • Tokens: {u.tokens}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}