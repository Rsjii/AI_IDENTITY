import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Users, BarChart3, TrendingUp, Shield, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

type Range = 'today' | '7d' | '30d';

export function AdminPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [range, setRange] = useState<Range>('7d');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is admin, if not redirect to 404
    if (state.status === 'authenticated' && !state.user?.isAdmin) {
      navigate('/404', { replace: true });
      return;
    }
    if (state.status === 'unauthenticated') {
      navigate('/auth', { replace: true });
      return;
    }
    if (state.status === 'loading') {
      return;
    }
  }, [state, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated' || !state.user?.isAdmin) return;

    (async () => {
      setError('');
      setLoading(true);
      try {
        const o = await apiFetch<any>(`/api/admin/overview?range=${range}`);
        const u = await apiFetch<any>(`/api/admin/users?range=${range}&q=${encodeURIComponent(q)}`);
        setOverview(o?.data || null);
        setUsers(u?.rows || []);
      } catch (err: any) {
        // If 403, redirect to 403 page; if 404, redirect to 404 page
        const status = (err as any)?.status;
        if (status === 403) {
          navigate('/403', { replace: true });
          return;
        }
        if (status === 404 || err.message?.includes('Not found')) {
          navigate('/404', { replace: true });
          return;
        }
        setError(err.message || 'Failed to load admin.');
      } finally {
        setLoading(false);
      }
    })();
  }, [range, q, state, navigate]);

  if (state.status === 'loading' || loading) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto">
          <div className="text-center py-12 text-muted-foreground">Loading admin dashboard...</div>
        </div>
      </Layout>
    );
  }

  if (state.status !== 'authenticated' || !state.user?.isAdmin) {
    return null; // Will redirect
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">System analytics and user management</p>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {(['today','7d','30d'] as Range[]).map((r) => (
            <Button 
              key={r} 
              size="sm" 
              variant={range === r ? 'default' : 'outline'} 
              onClick={() => setRange(r)}
              className="transition-all"
            >
              {r === 'today' ? 'Today' : r === '7d' ? '7 Days' : '30 Days'}
            </Button>
          ))}
        </div>

        <Card className="glass border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Overview
            </CardTitle>
            <CardDescription>System-wide statistics for selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="rounded-xl border-2 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <div className="text-xs font-medium text-blue-700 dark:text-blue-300">Total Users</div>
                </div>
                <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">{overview?.usersTotal ?? 0}</div>
              </div>
              <div className="rounded-xl border-2 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <div className="text-xs font-medium text-green-700 dark:text-green-300">New Users</div>
                </div>
                <div className="text-3xl font-bold text-green-900 dark:text-green-100">{overview?.usersNew ?? 0}</div>
              </div>
              <div className="rounded-xl border-2 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <div className="text-xs font-medium text-purple-700 dark:text-purple-300">Mirror Runs</div>
                </div>
                <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">{overview?.mirrorRuns ?? 0}</div>
              </div>
              <div className="rounded-xl border-2 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <div className="text-xs font-medium text-orange-700 dark:text-orange-300">Tokens</div>
                </div>
                <div className="text-3xl font-bold text-orange-900 dark:text-orange-100">{overview?.tokens?.toLocaleString() ?? 0}</div>
              </div>
              <div className="rounded-xl border-2 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Trust ✓</div>
                </div>
                <div className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">{overview?.trustYes ?? 0}</div>
              </div>
              <div className="rounded-xl border-2 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-xs font-medium text-red-700 dark:text-red-300">Trust ✗</div>
                </div>
                <div className="text-3xl font-bold text-red-900 dark:text-red-100">{overview?.trustNo ?? 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Events Analytics */}
        {overview?.eventsByType && Object.keys(overview.eventsByType).length > 0 && (
          <Card className="glass border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Events Analytics
              </CardTitle>
              <CardDescription>System events tracked for selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(overview.eventsByType).map(([type, count]: [string, any]) => (
                  <div key={type} className="rounded-lg border bg-card/60 p-3">
                    <div className="text-xs font-medium text-muted-foreground mb-1">{type.replace(/_/g, ' ')}</div>
                    <div className="text-2xl font-bold">{count}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="glass border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users
            </CardTitle>
            <CardDescription>Search and manage user accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by email, name, or handle..."
                className="max-w-md"
              />
            </div>
            <div className="space-y-2">
              {users.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No users found.</div>
              ) : (
                users.map((u: any) => (
                  <Link
                    key={u.id}
                    to={`/admin/users/${u.id}`}
                    className="block rounded-xl border-2 bg-card/60 p-4 hover:bg-card/80 hover:border-primary/50 transition-all shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-semibold mb-1">{u.email || u.handle || u.id}</div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                          {u.name && <span>{u.name}</span>}
                          {u.handle && <span>@{u.handle}</span>}
                          <span className={u.profileCompleted ? 'text-green-600' : 'text-red-600'}>
                            {u.profileCompleted ? 'Profile ✓' : 'Profile ✗'}
                          </span>
                          <span className={u.hasIdentity ? 'text-green-600' : 'text-red-600'}>
                            {u.hasIdentity ? 'Identity ✓' : 'Identity ✗'}
                          </span>
                          <span>Runs: {u.mirrorRuns || 0}</span>
                          <span>Tokens: {u.tokens?.toLocaleString() || 0}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">View →</Button>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}