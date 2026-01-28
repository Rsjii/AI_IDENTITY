import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle, Users, BarChart3, TrendingUp, Shield, Activity,
  AlertTriangle, Zap, DollarSign, Clock, RefreshCw,
  ArrowUp, ArrowDown, Target, UserCheck, CreditCard
} from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('overview');

  // Data states
  const [overview, setOverview] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any>(null);
  const [businessMetrics, setBusinessMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (state.status === 'authenticated' && !state.user?.isAdmin) {
      navigate('/404', { replace: true });
      return;
    }
    if (state.status === 'unauthenticated') {
      navigate('/auth', { replace: true });
      return;
    }
  }, [state, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated' || !state.user?.isAdmin) return;
    loadData();
  }, [range, q, state, activeTab]);

  const loadData = async () => {
    setError('');
    setLoading(true);
    try {
      // Always load overview and users
      const [o, u] = await Promise.all([
        apiFetch<any>(`/api/admin/overview?range=${range}`),
        apiFetch<any>(`/api/admin/users?range=${range}&q=${encodeURIComponent(q)}`)
      ]);
      setOverview(o?.data || null);
      setUsers(u?.rows || []);

      // Load tab-specific data
      if (activeTab === 'errors') {
        const e = await apiFetch<any>(`/api/admin/errors?range=${range}&limit=50`);
        setErrors(e?.data || []);
      }
      if (activeTab === 'performance') {
        const p = await apiFetch<any>(`/api/admin/performance?range=${range}`);
        setPerformance(p?.data || null);
      }
      if (activeTab === 'business') {
        const b = await apiFetch<any>(`/api/admin/business-metrics?range=${range}`);
        setBusinessMetrics(b?.data || null);
      }
    } catch (err: any) {
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
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600 text-white';
      case 'error': return 'bg-red-500 text-white';
      case 'warning': return 'bg-yellow-500 text-black';
      case 'info': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

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
    return null;
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">System analytics, monitoring, and user management</p>
          </div>
          <Button onClick={loadData} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="errors" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Errors
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-2">
              <Zap className="h-4 w-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="business" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Business
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
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
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
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
          </TabsContent>

          {/* Errors Tab */}
          <TabsContent value="errors" className="space-y-4">
            <Card className="glass border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Error Tracking
                </CardTitle>
                <CardDescription>Recent system errors and warnings</CardDescription>
              </CardHeader>
              <CardContent>
                {errors.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No errors recorded in this period.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {errors.map((err: any, idx: number) => (
                      <div
                        key={err.id || idx}
                        className="rounded-lg border bg-card/60 p-4 hover:bg-card/80 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={getSeverityColor(err.severity)}>
                                {err.severity?.toUpperCase()}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {err.source || 'backend'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(err.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm font-medium break-words">{err.message}</p>
                            {err.stack && (
                              <details className="mt-2">
                                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                  View Stack Trace
                                </summary>
                                <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">
                                  {err.stack}
                                </pre>
                              </details>
                            )}
                            {err.userId && (
                              <Link to={`/admin/users/${err.userId}`} className="text-xs text-primary hover:underline mt-1 inline-block">
                                View User →
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="glass border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Realtime Performance
                  </CardTitle>
                  <CardDescription>Current system response times</CardDescription>
                </CardHeader>
                <CardContent>
                  {performance?.realtime?.overall ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg border bg-card/60 p-4">
                          <div className="text-xs text-muted-foreground mb-1">Total Requests</div>
                          <div className="text-2xl font-bold">{performance.realtime.overall.count || 0}</div>
                        </div>
                        <div className="rounded-lg border bg-card/60 p-4">
                          <div className="text-xs text-muted-foreground mb-1">Avg Response</div>
                          <div className="text-2xl font-bold">{performance.realtime.overall.avg?.toFixed(0) || 0}ms</div>
                        </div>
                        <div className="rounded-lg border bg-card/60 p-4">
                          <div className="text-xs text-muted-foreground mb-1">p95 Latency</div>
                          <div className="text-2xl font-bold">{performance.realtime.overall.p95?.toFixed(0) || 0}ms</div>
                        </div>
                        <div className="rounded-lg border bg-card/60 p-4">
                          <div className="text-xs text-muted-foreground mb-1">p99 Latency</div>
                          <div className="text-2xl font-bold">{performance.realtime.overall.p99?.toFixed(0) || 0}ms</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No performance data available.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-orange-500" />
                    Slowest Routes
                  </CardTitle>
                  <CardDescription>Routes with highest latency</CardDescription>
                </CardHeader>
                <CardContent>
                  {performance?.realtime?.slowestRoutes?.length > 0 ? (
                    <div className="space-y-2">
                      {performance.realtime.slowestRoutes.map((route: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between rounded-lg border bg-card/60 p-3">
                          <code className="text-xs">{route.route}</code>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{route.avgDuration?.toFixed(0) || 0}ms</span>
                            <Badge variant="outline" className="text-xs">{route.count} req</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No route data available.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {performance?.historical && (
              <Card className="glass border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Historical Trends
                  </CardTitle>
                  <CardDescription>Performance over selected period</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-lg border bg-card/60 p-4">
                      <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-blue-500" />
                        API Latency (All /api routes)
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-muted-foreground">Avg</div>
                          <div className="text-xl font-bold">{performance.historical.api?.latency?.avg || 0}ms</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">p50</div>
                          <div className="text-xl font-bold">{performance.historical.api?.latency?.p50 || 0}ms</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">p95</div>
                          <div className="text-xl font-bold">{performance.historical.api?.latency?.p95 || 0}ms</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">p99</div>
                          <div className="text-xl font-bold">{performance.historical.api?.latency?.p99 || 0}ms</div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        {performance.historical.api?.latency?.total || 0} requests · {performance.historical.api?.latency?.verySlowRequests || 0} &gt; 5s
                      </div>
                    </div>

                    <div className="rounded-lg border bg-card/60 p-4">
                      <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-purple-500" />
                        LLM Latency (mirror_runs)
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-muted-foreground">Avg</div>
                          <div className="text-xl font-bold">{performance.historical.llm?.latency?.avg || 0}ms</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">p50</div>
                          <div className="text-xl font-bold">{performance.historical.llm?.latency?.p50 || 0}ms</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">p95</div>
                          <div className="text-xl font-bold">{performance.historical.llm?.latency?.p95 || 0}ms</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">p99</div>
                          <div className="text-xl font-bold">{performance.historical.llm?.latency?.p99 || 0}ms</div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        {performance.historical.llm?.latency?.total || 0} requests · {performance.historical.llm?.latency?.verySlowRequests || 0} &gt; 5s
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Business Metrics Tab */}
          <TabsContent value="business" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Revenue Metrics */}
              <Card className="glass border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-4">
                    <div className="text-xs text-muted-foreground mb-1">Monthly Recurring Revenue</div>
                    <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                      ${businessMetrics?.revenue?.mrr?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border bg-card/60 p-3">
                      <div className="text-xs text-muted-foreground mb-1">Total Revenue</div>
                      <div className="text-xl font-bold">${businessMetrics?.revenue?.totalRevenue?.toFixed(2) || '0.00'}</div>
                    </div>
                    <div className="rounded-lg border bg-card/60 p-3">
                      <div className="text-xs text-muted-foreground mb-1">ARPU</div>
                      <div className="text-xl font-bold">${businessMetrics?.revenue?.arpu?.toFixed(2) || '0.00'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Conversion Metrics */}
              <Card className="glass border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-500" />
                    Conversions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-card/60 p-4">
                    <div className="text-xs text-muted-foreground mb-1">Free → Paid Rate</div>
                    <div className="text-3xl font-bold flex items-center gap-2">
                      {businessMetrics?.conversion?.conversionRate?.toFixed(1) || 0}%
                      {businessMetrics?.conversion?.conversionRate > 5 ? (
                        <ArrowUp className="h-5 w-5 text-green-500" />
                      ) : (
                        <ArrowDown className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border bg-card/60 p-3">
                      <div className="text-xs text-muted-foreground mb-1">Free Users</div>
                      <div className="text-xl font-bold">{businessMetrics?.conversion?.freeUsers || 0}</div>
                    </div>
                    <div className="rounded-lg border bg-card/60 p-3">
                      <div className="text-xs text-muted-foreground mb-1">Paid Users</div>
                      <div className="text-xl font-bold">{businessMetrics?.conversion?.paidUsers || 0}</div>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-card/60 p-3">
                    <div className="text-xs text-muted-foreground mb-1">Churn Rate</div>
                    <div className="text-xl font-bold flex items-center gap-2">
                      {businessMetrics?.conversion?.churnRate?.toFixed(1) || 0}%
                      {businessMetrics?.conversion?.churnRate < 5 ? (
                        <Badge variant="outline" className="text-green-600">Healthy</Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600">High</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Engagement Metrics */}
              <Card className="glass border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-purple-500" />
                    Engagement
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-card/60 p-4">
                    <div className="text-xs text-muted-foreground mb-1">Active Users (Period)</div>
                    <div className="text-3xl font-bold">{businessMetrics?.engagement?.activeUsers || 0}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border bg-card/60 p-3">
                      <div className="text-xs text-muted-foreground mb-1">Avg Messages</div>
                      <div className="text-xl font-bold">{businessMetrics?.engagement?.avgMessagesPerUser?.toFixed(1) || 0}</div>
                    </div>
                    <div className="rounded-lg border bg-card/60 p-3">
                      <div className="text-xs text-muted-foreground mb-1">Total Sessions</div>
                      <div className="text-xl font-bold">{businessMetrics?.engagement?.totalSessions || 0}</div>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-card/60 p-3">
                    <div className="text-xs text-muted-foreground mb-1">Avg Session Length</div>
                    <div className="text-xl font-bold">{businessMetrics?.engagement?.avgSessionLength || 0} msgs</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* User Funnel */}
            <Card className="glass border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  User Funnel
                </CardTitle>
                <CardDescription>User journey progression</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-2">
                  {[
                    { label: 'Registered', value: businessMetrics?.userFunnel?.registered || 0, color: 'from-blue-500 to-blue-600' },
                    { label: 'Onboarding Done', value: businessMetrics?.userFunnel?.onboardingComplete || 0, color: 'from-cyan-500 to-cyan-600' },
                    { label: 'Identity Ready', value: businessMetrics?.userFunnel?.identityReady || 0, color: 'from-teal-500 to-teal-600' },
                    { label: 'First Chat', value: businessMetrics?.userFunnel?.firstChat || 0, color: 'from-green-500 to-green-600' },
                    { label: 'Paid', value: businessMetrics?.userFunnel?.paid || 0, color: 'from-emerald-500 to-emerald-600' },
                  ].map((step, idx, arr) => (
                    <div key={step.label} className="flex-1 flex items-center">
                      <div className="flex-1">
                        <div className={`rounded-lg bg-gradient-to-r ${step.color} p-4 text-white text-center`}>
                          <div className="text-2xl font-bold">{step.value}</div>
                          <div className="text-xs opacity-90">{step.label}</div>
                        </div>
                        {idx > 0 && arr[idx - 1].value > 0 && (
                          <div className="text-center text-xs text-muted-foreground mt-1">
                            {((step.value / arr[idx - 1].value) * 100).toFixed(0)}%
                          </div>
                        )}
                      </div>
                      {idx < arr.length - 1 && (
                        <div className="px-2 text-muted-foreground">→</div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Plan Distribution */}
            {businessMetrics?.planDistribution && businessMetrics.planDistribution.length > 0 && (
              <Card className="glass border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Plan Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {businessMetrics.planDistribution.map((plan: any) => (
                      <div key={plan.plan} className="rounded-lg border bg-card/60 p-4">
                        <div className="text-xs text-muted-foreground mb-1">{plan.plan || 'Free'}</div>
                        <div className="text-2xl font-bold">{plan.count}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
