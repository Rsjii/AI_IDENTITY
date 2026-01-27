import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import {
  MessageSquare, DollarSign, Users, Clock,
  TrendingUp, Settings, Database, Tag,
  ExternalLink, BarChart3
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardData {
  planTier?: string;
  trialEndsAt?: string | null;
  chats: {
    total: number;
    today: number;
    week: number;
    month: number;
  };
  revenue: {
    thisMonthCents: number;
    totalCents?: number;
  };
  activeUsers?: number;
  analytics?: {
    topQuestions: Array<{ content: string; count: number }>;
    responseTime: { avg: number; min: number; max: number };
    satisfaction: { positive: number; negative: number; score: number };
    peakHours: Array<{ hour: number; count: number }>;
  };
  earnings?: Array<{
    id: string;
    amount: number;
    type: string;
    status: string;
    createdAt: string;
    platformFeeCents?: number;
    creatorEarningsCents?: number;
  }>;
}

export function CreatorDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'earnings'>('overview');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashboardRes, earningsRes] = await Promise.all([
          apiFetch('/api/creator/dashboard'),
          apiFetch('/api/creator/earnings').catch(() => ({ items: [] }))
        ]);
        setData({
          ...dashboardRes,
          earnings: earningsRes?.items || []
        });
      } catch (e) {
        console.error('Dashboard fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Creator Dashboard</h1>
            <p className="text-muted-foreground mt-1">Monitor your AI clone's performance</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.href = '/knowledge'}>
              <Database className="h-4 w-4 mr-2" />
              Knowledge Base
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/settings'}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          {(['overview', 'analytics', 'earnings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Current Plan Display */}
            <Card>
              <CardHeader>
                <CardTitle>Current Plan</CardTitle>
                <CardDescription>Your subscription tier and limits</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold capitalize">{data?.planTier || 'Free'}</div>
                    <div className="text-sm text-muted-foreground">
                      {data?.planTier === 'free' ? '500 chats/month' :
                       data?.planTier === 'starter' ? '5,000 chats/month' :
                       data?.planTier === 'growth' ? '25,000 chats/month' :
                       'Unlimited chats'}
                    </div>
                  </div>
                  <Button onClick={() => window.location.href = '/settings?tab=billing'}>
                    Manage Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="glass">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-full">
                      <MessageSquare className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{data?.chats?.today ?? 0}</div>
                      <div className="text-sm text-muted-foreground">Chats Today</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-full">
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{data?.chats?.week ?? 0}</div>
                      <div className="text-sm text-muted-foreground">This Week</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-full">
                      <BarChart3 className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{data?.chats?.month ?? 0}</div>
                      <div className="text-sm text-muted-foreground">This Month</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-yellow-100 rounded-full">
                      <DollarSign className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">
                        {formatCurrency(data?.revenue?.thisMonthCents ?? 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Revenue</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Active Users */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Active Users Right Now
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold">{data?.activeUsers ?? 0}</div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm text-muted-foreground">Live</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Links */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-4">
                  <Button variant="outline" className="justify-start h-auto py-3" onClick={() => window.location.href = '/identity'}>
                    <Settings className="h-4 w-4 mr-2" />
                    <div className="text-left">
                      <div className="font-medium">Edit Personality</div>
                      <div className="text-xs text-muted-foreground">Update your AI's behavior</div>
                    </div>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-3" onClick={() => window.location.href = '/knowledge'}>
                    <Database className="h-4 w-4 mr-2" />
                    <div className="text-left">
                      <div className="font-medium">Knowledge Base</div>
                      <div className="text-xs text-muted-foreground">Add more content</div>
                    </div>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-3" onClick={() => window.location.href = '/integrations'}>
                    <Tag className="h-4 w-4 mr-2" />
                    <div className="text-left">
                      <div className="font-medium">Set Pricing</div>
                      <div className="text-xs text-muted-foreground">Configure pay-per-chat</div>
                    </div>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-3" onClick={() => window.location.href = '/onboarding/deploy'}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    <div className="text-left">
                      <div className="font-medium">Share Links</div>
                      <div className="text-xs text-muted-foreground">Get embed code & QR</div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Most Asked Questions */}
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Most Asked Questions</CardTitle>
                  <CardDescription>Top 10 questions from your audience</CardDescription>
                </CardHeader>
                <CardContent>
                  {data?.analytics?.topQuestions && data.analytics.topQuestions.length > 0 ? (
                    <div className="space-y-3">
                      {data.analytics.topQuestions.map((q, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-xs font-medium">
                            {i + 1}
                          </div>
                          <div className="flex-1 truncate text-sm">{q.content}</div>
                          <div className="text-sm text-muted-foreground">{q.count}x</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No data yet. Questions will appear as users chat with your AI.</p>
                  )}
                </CardContent>
              </Card>

              {/* Response Times */}
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Response Times
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{data?.analytics?.responseTime?.avg ?? '-'}ms</div>
                      <div className="text-xs text-muted-foreground">Average</div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{data?.analytics?.responseTime?.min ?? '-'}ms</div>
                      <div className="text-xs text-muted-foreground">Fastest</div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{data?.analytics?.responseTime?.max ?? '-'}ms</div>
                      <div className="text-xs text-muted-foreground">Slowest</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Satisfaction Score */}
              <Card className="glass">
                <CardHeader>
                  <CardTitle>User Satisfaction</CardTitle>
                  <CardDescription>Based on user confirmations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    <div className="text-4xl font-bold">
                      {data?.analytics?.satisfaction?.score ?? 0}%
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Positive</span>
                        <span>{data?.analytics?.satisfaction?.positive ?? 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-red-600">Negative</span>
                        <span>{data?.analytics?.satisfaction?.negative ?? 0}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Peak Hours */}
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Peak Usage Hours</CardTitle>
                  <CardDescription>When your audience is most active</CardDescription>
                </CardHeader>
                <CardContent>
                  {data?.analytics?.peakHours && data.analytics.peakHours.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={data.analytics.peakHours}>
                        <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} />
                        <YAxis />
                        <Tooltip labelFormatter={(h) => `${h}:00`} />
                        <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground">No data yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Earnings Tab */}
        {activeTab === 'earnings' && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="glass">
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">This Month</div>
                  <div className="text-3xl font-bold">{formatCurrency(data?.revenue?.thisMonthCents ?? 0)}</div>
                </CardContent>
              </Card>
              <Card className="glass">
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Platform Fee (25%)</div>
                  <div className="text-3xl font-bold text-muted-foreground">
                    {formatCurrency(Math.floor((data?.revenue?.thisMonthCents ?? 0) * 0.25))}
                  </div>
                </CardContent>
              </Card>
              <Card className="glass">
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Your Earnings (75%)</div>
                  <div className="text-3xl font-bold text-green-600">
                    {formatCurrency(Math.floor((data?.revenue?.thisMonthCents ?? 0) * 0.75))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Transaction History */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Recent payments from your audience</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.earnings && data.earnings.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2">Date</th>
                          <th className="text-left py-3 px-2">Type</th>
                          <th className="text-right py-3 px-2">Amount</th>
                          <th className="text-right py-3 px-2">Your Earnings</th>
                          <th className="text-left py-3 px-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.earnings.map((tx) => (
                          <tr key={tx.id} className="border-b">
                            <td className="py-3 px-2">{formatDate(tx.createdAt)}</td>
                            <td className="py-3 px-2 capitalize">{tx.type}</td>
                            <td className="py-3 px-2 text-right">{formatCurrency(tx.amount)}</td>
                            <td className="py-3 px-2 text-right text-green-600">
                              {formatCurrency(tx.creatorEarningsCents ?? Math.floor(tx.amount * 0.75))}
                            </td>
                            <td className="py-3 px-2">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                tx.status === 'succeeded' ? 'bg-green-100 text-green-700' :
                                tx.status === 'failed' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {tx.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No transactions yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Payout Settings */}
        <Card className="glass">
              <CardHeader>
                <CardTitle>Payout Settings</CardTitle>
                <CardDescription>Configure how you receive your earnings</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect your bank account via Stripe to receive payouts automatically.
                </p>
                <Button onClick={() => alert('Stripe Connect integration coming soon!')}>
                  Setup Payouts
                </Button>
          </CardContent>
        </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}



