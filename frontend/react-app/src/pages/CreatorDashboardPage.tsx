import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { showToast } from '@/lib/toast';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import {
  MessageSquare, DollarSign, Clock, Star, TrendingUp, TrendingDown,
  Settings, Database, BarChart3, Zap, 
  FileText, AlertCircle, CheckCircle2, ArrowUp, Globe, Lock
} from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { MirrorPage } from './MirrorPage';
import { apiFetch } from '@/lib/api';

type RecentConversation = {
  sessionId: string;
  label: string;        // e.g. "@handle" or "Visitor ab12"
  preview: string;      // last user message
  lastMessageAt: string; // ISO string
  rating?: 'positive' | 'negative' | null;
};

interface DashboardData {
  planTier?: 'free' | 'starter' | 'growth' | 'scale';
  trialEndsAt?: string | null;
  chats: {
    total: number;
    today: number;
    week: number;
    month: number;
    lastWeek?: number;
    trend?: number; // percentage change
  };
  revenue: {
    thisMonthCents: number;
    payPerChatEarningsCents?: number;
    subscriptionRevenueCents?: number;
    totalCents?: number;
  };
  subscribers?: {
    active: number;
  };
  activeUsers?: number;
  analytics?: {
    topQuestions: Array<{ content: string; count: number }>;
    responseTime: { avg: number; min: number; max: number };
    satisfaction: { positive: number; negative: number; score: number; totalRatings?: number };
    peakHours: Array<{ hour: number; count: number }>;
    conversationsOverTime?: Array<{ date: string; count: number }>;
    modelUsed?: string;
    peakHour?: number;
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
  const nav = useNavigate();
  const { state, refresh } = useAuth();
  const user = state.status === 'authenticated' ? state.user : null;
  
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] =
    useState<'engagement' | 'revenue' | 'content' | 'ai-health' | 'test'>('engagement');
  const [messagesToday, setMessagesToday] = useState(0);
  const [aiStatus, setAiStatus] = useState<'active' | 'training' | 'inactive' | 'not_setup'>('not_setup');
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');

  // NEW: real recent chats (no more hardcoded demo)
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([]);

  // Marketplace listing state for public/private toggle
  const [listingData, setListingData] = useState<{ isPublic: boolean; id?: string } | null>(null);
  const [togglingPublic, setTogglingPublic] = useState(false);

  // Setup status banner state
  const [setupStatus, setSetupStatus] = useState<any>(null);
  const [showSetupBanner, setShowSetupBanner] = useState(true);

  // FIX: polling closure stale state (use refs)
  const lastChatCountRef = useRef(0);
  const lastRevenueRef = useRef(0);

  // Fetch setup status for banner
  useEffect(() => {
    const fetchSetupStatus = async () => {
      try {
        const data = await apiFetch('/api/creator/setup/status');
        setSetupStatus(data);
        setShowSetupBanner(!data.setupDismissed && data.completionPercentage < 100);
      } catch (error) {
        console.error('Failed to fetch setup status', error);
      }
    };
    fetchSetupStatus();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashboardRes, earningsRes, identityRes, recentRes, listingRes] = await Promise.all([
          apiFetch('/api/creator/dashboard'),
          apiFetch('/api/creator/earnings').catch(() => ({ items: [] })),
          apiFetch('/api/identity/active').catch(() => ({ identity: null })),
          apiFetch('/api/creator/chats/recent?limit=3').catch(() => ({ items: [] })), // NEW
          apiFetch('/api/marketplace/my-listing').catch(() => ({ item: null })), // Marketplace listing
        ]);

        setData({
          ...dashboardRes,
          earnings: earningsRes?.items || [],
        });

        const todayChats = dashboardRes?.chats?.today || 0;
        const monthRevenue = dashboardRes?.revenue?.thisMonthCents || 0;
        
        // ✅ Refresh auth state if dashboard shows updated planTier
        if (dashboardRes?.planTier && dashboardRes.planTier !== (user as any)?.planTier) {
          refresh();
        }

        setMessagesToday(todayChats);
        lastChatCountRef.current = todayChats;
        lastRevenueRef.current = monthRevenue;

        setRecentConversations((recentRes as any)?.items || []);

        // Set marketplace listing data (handle both single item and array)
        const listingData = (listingRes as any)?.item || ((listingRes as any)?.items && (listingRes as any).items[0]);
        if (listingData) {
          setListingData({
            isPublic: listingData.isPublic ?? false,
            id: listingData.id,
          });
        } else {
          setListingData(null);
        }

        if (identityRes?.identity?.activeVersionId) setAiStatus('active');
        else if (identityRes?.identity) setAiStatus('training');
        else setAiStatus('not_setup');
      } catch (e) {
        console.error('Dashboard fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // ✅ Real-time updates: Poll every 5 seconds + on window focus
    const updateDashboard = async () => {
      try {
        const res = await apiFetch('/api/creator/dashboard');

        const newChatCount = res?.chats?.today || 0;
        const newRevenue = res?.revenue?.thisMonthCents || 0;

        if (lastChatCountRef.current > 0 && newChatCount > lastChatCountRef.current) {
          const diff = newChatCount - lastChatCountRef.current;
          showToast(
            `New Chat${diff > 1 ? 's' : ''}: ${diff} new conversation${diff > 1 ? 's' : ''}`,
            'success'
          );
        }

        if (lastRevenueRef.current > 0 && newRevenue > lastRevenueRef.current) {
          const diff = newRevenue - lastRevenueRef.current;
          showToast(`Earned $${(diff / 100).toFixed(2)}!`, 'success');
        }

        lastChatCountRef.current = newChatCount;
        lastRevenueRef.current = newRevenue;

        setMessagesToday(newChatCount);
        setData((prev) => ({
          ...prev,
          ...res,
          earnings: prev?.earnings || res?.earnings || [],
        }));
      } catch {
        // ignore
      }
    };    
    
    const interval = setInterval(updateDashboard, 5000);
    const handleFocus = () => updateDashboard();
    window.addEventListener('focus', handleFocus);

    const handleVisibilityChange = () => {
      if (!document.hidden) updateDashboard();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);  

  // ✅ Use dashboard API planTier as primary source, auth state as fallback
  const planTier = data?.planTier || (user as any)?.planTier || 'free';
  const trialEndsAt = data?.trialEndsAt || (user as any)?.trialEndsAt;
  const isTrialActive = trialEndsAt && new Date(trialEndsAt) > new Date();
  const isFreeTier = planTier === 'free' && !isTrialActive;

  // Toggle public/private
  const togglePublic = async () => {
    if (isFreeTier) {
      showToast('Upgrade to Starter plan to make your AI public', 'error');
      nav('/pricing');
      return;
    }

    setTogglingPublic(true);
    try {
      const newIsPublic = !listingData?.isPublic;
      await apiFetch('/api/marketplace/listings', {
        method: 'POST',
        body: JSON.stringify({
          isPublic: newIsPublic,
        }),
      });
      
      setListingData((prev) => ({
        ...prev,
        isPublic: newIsPublic,
      } as any));
      
      showToast(
        newIsPublic 
          ? 'Your AI is now public and discoverable' 
          : 'Your AI is now private',
        'success'
      );
    } catch (err: any) {
      if (err.status === 403) {
        showToast('Upgrade to Starter plan to make your AI public', 'error');
        nav('/pricing');
        return;
      }

      // ✅ Show EXACT missing prereqs + send user to the right page
      if (err.status === 400 && err.errorCode === 'PUBLISH_PREREQ_FAILED') {
        const missingLabels: Record<string, string> = {
          title: 'Title',
          thumbnail: 'Thumbnail',
          category: 'Category',
          description: 'Description',
          choose_monetization: 'Enable monetization (Subscription or Pay-per-chat)',
          subscription_price: 'Subscription price',
          pay_per_chat_price: 'Pay-per-chat price',
          stripe_connect_verified: 'Payout setup (currently unavailable)',
        };
        const missing: string[] = Array.isArray(err.missing) ? err.missing : [];
        const msg = missing.length
          ? missing.map((m) => missingLabels[m] || m).join(', ')
          : 'Complete listing basics + pricing to publish.';
        showToast(`Cannot make public yet. Missing: ${msg}`, 'error', 7000);
        nav('/marketplace/manage');
        return;
      }

      showToast(err.message || 'Failed to update visibility', 'error');
    } finally {
      setTogglingPublic(false);
    }
  };

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

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const handleExportChat = async (format: 'csv' | 'json' = 'csv') => {
    setExporting(true);
    try {
      const rows = (data?.analytics?.conversationsOverTime || sparklineData) as Array<{ date: string; count: number }>;
      const d = new Date().toISOString().split('T')[0];
  
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conversations-over-time-${d}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast('Exported conversations-over-time JSON', 'success');
        return;
      }
  
      const csv = ['date,count', ...rows.map((r) => `"${String(r.date).replace(/"/g, '""')}",${r.count}`)].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversations-over-time-${d}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('Exported conversations-over-time CSV', 'success');
    } catch {
      showToast('Failed to export conversations over time', 'error');
    } finally {
      setExporting(false);
    }
  };  

const top = data?.analytics?.topQuestions?.[0]?.content || '—';
const topCount = data?.analytics?.topQuestions?.[0]?.count || 0;

const negativeToReview = data?.analytics?.satisfaction?.negative ?? 0;
const negativeToReviewLabel =
  negativeToReview === 1
    ? '1 negative rating needs review'
    : `${negativeToReview} negative ratings need review`;

const payPerChatCents = data?.revenue?.payPerChatEarningsCents ?? 0;
const subscriptionCents = data?.revenue?.subscriptionRevenueCents ?? 0;
const activeSubs = data?.subscribers?.active ?? 0;

const handleGenerateInsightsReport = () => {
  const d = new Date().toISOString().split('T')[0];

  const report = [
    `# AI Insights Report (${d})`,
    ``,
    `## Summary`,
    `- Total conversations (all-time): ${data?.chats?.total ?? 0}`,
    `- Conversations today: ${data?.chats?.today ?? 0}`,
    `- Avg response time: ${data?.analytics?.responseTime?.avg ?? 0}ms`,
    `- Satisfaction score: ${data?.analytics?.satisfaction?.score ?? 0}/100`,
    ``,
    `## Top questions (last 30 days)`,
    ...(data?.analytics?.topQuestions?.length
      ? data.analytics.topQuestions.slice(0, 10).map((q) => `- ${q.content} (${q.count})`)
      : [`- —`]),
    ``,
  ].join('\n');

  const blob = new Blob([report], { type: 'text/markdown' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-insights-report-${d}.md`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

  // Generate sparkline data (last 7 days) - mock data if not available
  const sparklineData =
    data?.analytics?.conversationsOverTime?.length
      ? data.analytics.conversationsOverTime.slice(-7)
      : Array.from({ length: 7 }, (_, i) => ({
          date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          count: 0,
        }));

  const trend =
    typeof data?.chats?.trend === 'number'
      ? data.chats.trend
      : data?.chats?.lastWeek
        ? Math.round(((data.chats.week - data.chats.lastWeek) / Math.max(1, data.chats.lastWeek)) * 100)
        : 0;

  const peakHour =
    typeof data?.analytics?.peakHour === 'number'
      ? data.analytics.peakHour
      : data?.analytics?.peakHours?.length
        ? data.analytics.peakHours.reduce((max, h) => (h.count > max.count ? h : max), data.analytics.peakHours[0]).hour
        : null;      

  // Get satisfaction rating (convert score to 5-star)
  const satisfactionRating = data?.analytics?.satisfaction?.score ? 
    ((data.analytics.satisfaction.score / 100) * 5).toFixed(1) : '0.0';

  // Response time status
  const responseTimeStatus = (avg: number) => {
    if (avg < 1000) return { text: 'Excellent', color: 'text-success' };
    if (avg < 2000) return { text: 'Good', color: 'text-success' };
    if (avg < 3000) return { text: 'Fair', color: 'text-warning' };
    return { text: 'Slow', color: 'text-error' };
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto space-y-6 px-6 py-8">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-bg-secondary border border-border-default rounded-lg p-6 space-y-4">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-12 w-32" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
          <div className="bg-bg-secondary border border-border-default rounded-lg p-6 space-y-4">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 px-6 py-8">
        {/* Setup completion banner */}
        {showSetupBanner && setupStatus && setupStatus.completionPercentage < 100 && (
          <Alert className="mb-6 border-accent-primary/30 bg-accent-primary/10">
            <AlertCircle className="h-4 w-4 text-accent-primary" />
            <AlertDescription>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <strong>Complete your setup to start earning</strong>
                    <span className="text-sm">{setupStatus.completionPercentage}% done</span>
                  </div>
                  <Progress value={setupStatus.completionPercentage} className="h-2" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => nav('/setup')} size="sm">Continue Setup</Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await apiFetch('/api/creator/setup/dismiss', { method: 'POST' });
                      setShowSetupBanner(false);
                    }}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Phase 2: Free tier upgrade banner */}
        {isFreeTier && (
          <Alert className="border-orange-500/30 bg-orange-500/10">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div>
                  <strong>Upgrade to unlock marketplace & monetization</strong>
                  <p className="text-sm mt-1">
                    Free tier creators cannot list on marketplace or monetize. Upgrade to Starter plan 
                    to make your AI discoverable and start earning from visitors.
                  </p>
                </div>
                <Button onClick={() => nav('/pricing')} size="sm" className="ml-4">
                  <ArrowUp className="h-4 w-4 mr-2" />
                  Upgrade Now
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-text-primary">Creator Dashboard</h1>
              {/* AI Status Indicator */}
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                aiStatus === 'active' 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : aiStatus === 'training'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  aiStatus === 'active' ? 'bg-green-400 animate-pulse' 
                  : aiStatus === 'training' ? 'bg-yellow-400 animate-pulse'
                  : 'bg-gray-400'
                }`} />
                {aiStatus === 'active' ? 'AI Active' 
                  : aiStatus === 'training' ? 'Training...' 
                  : 'Not Setup'}
              </div>
            </div>
            <p className="text-text-secondary mt-1">Monitor your AI clone's performance</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => nav('/my-ai?tab=train')}
              className="border-border-default text-text-secondary hover:text-text-primary"
            >
              <Database className="h-4 w-4 mr-2" />
              Knowledge Base
            </Button>
            <Button
              variant="outline"
              onClick={() => nav('/my-ai?tab=setup')}
              className="border-border-default text-text-secondary hover:text-text-primary"
            >
              <Settings className="h-4 w-4 mr-2" />
              My AI
            </Button>
          </div>
        </div>

        {/* Empty State: AI not yet set up */}
        {aiStatus === 'not_setup' && (
          <div className="rounded-xl border border-accent-primary/30 bg-gradient-to-r from-accent-primary/[0.08] to-accent-primary/[0.03] p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Your AI clone isn't set up yet</h2>
              <p className="text-sm text-text-secondary mt-1">
                Complete your AI setup to start receiving conversations, earn revenue, and see analytics here.
              </p>
            </div>
            <Button onClick={() => nav('/my-ai?tab=setup')} className="shrink-0">
              <Zap className="h-4 w-4 mr-2" />
              Set up My AI
            </Button>
          </div>
        )}

        {/* Quick Public/Private Toggle - Only show when AI is active */}
        {aiStatus === 'active' && (
          <Card className="glass border-accent-primary/20">
            <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6">
              <div className="flex items-start gap-3">
                {listingData?.isPublic ? (
                  <Globe className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <Lock className="h-5 w-5 text-gray-500 mt-0.5 shrink-0" />
                )}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-text-primary">AI Visibility</h3>
                    {listingData?.isPublic ? (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-600 dark:text-green-400 rounded-full">
                        Public
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-medium bg-gray-500/20 text-gray-600 dark:text-gray-400 rounded-full">
                        Private
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary">
                    {listingData?.isPublic 
                      ? 'Your AI is public and discoverable in marketplace. Anyone can find and chat with it.'
                      : 'Your AI is private. Only people with your direct link can access it.'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant={listingData?.isPublic ? "outline" : "default"}
                  onClick={togglePublic}
                  disabled={togglingPublic || isFreeTier}
                  className="min-w-[140px]"
                >
                  {togglingPublic ? (
                    <>
                      <Settings className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : listingData?.isPublic ? (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Make Private
                    </>
                  ) : (
                    <>
                      <Globe className="h-4 w-4 mr-2" />
                      Make Public
                    </>
                  )}
                </Button>
                {isFreeTier && (
                  <Button
                    variant="outline"
                    onClick={() => nav('/pricing')}
                    className="min-w-[120px]"
                  >
                    <ArrowUp className="h-4 w-4 mr-2" />
                    Upgrade
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Row: 4 Large Metric Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Conversations */}
          <Card className="bg-bg-secondary border-border-default hover:border-accent-primary/50 transition-all cursor-pointer card-hover">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <MessageSquare className="h-8 w-8 text-accent-primary" />
                {trend > 0 ? (
                  <div className="flex items-center gap-1 text-success">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-semibold">+{Math.abs(trend)}%</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-error">
                    <TrendingDown className="h-4 w-4" />
                    <span className="text-sm font-semibold">{trend}%</span>
                  </div>
                )}
              </div>
              <div className="text-4xl md:text-5xl font-bold text-text-primary mb-2">
                {data?.chats?.total?.toLocaleString() || 0}
              </div>
              <div className="text-sm text-text-secondary mb-4">Total Conversations</div>
              {/* Sparkline */}
              <div className="h-12 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparklineData}>
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#8B5CF6" 
                      fill="url(#gradient)" 
                      strokeWidth={2}
                    />
                    <defs>
                      <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="text-xs text-text-tertiary mt-2">Last 7 days</div>
            </CardContent>
          </Card>

          {/* Card 2: Messages Today */}
          <Card className="bg-bg-secondary border-border-default hover:border-accent-primary/50 transition-all">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <Zap className="h-8 w-8 text-accent-primary" />
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                  <span className="text-xs text-text-tertiary">Live</span>
                </div>
              </div>
              <div className="text-4xl md:text-5xl font-bold text-text-primary mb-2">
                {messagesToday.toLocaleString()}
              </div>
              <div className="text-sm text-text-secondary mb-2">Messages Today</div>
              <div className="text-xs text-text-tertiary">
                Busiest at {peakHour === null ? '—' : `${peakHour}:00`}
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Avg Response Time */}
          <Card className="bg-bg-secondary border-border-default hover:border-accent-primary/50 transition-all">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <Clock className="h-8 w-8 text-accent-primary" />
                <span className={`text-sm font-semibold ${responseTimeStatus(data?.analytics?.responseTime?.avg || 0).color}`}>
                  {responseTimeStatus(data?.analytics?.responseTime?.avg || 0).text}
                </span>
              </div>
              <div className="text-4xl md:text-5xl font-bold text-text-primary mb-2">
                {formatTime(data?.analytics?.responseTime?.avg || 0)}
              </div>
              <div className="text-sm text-text-secondary mb-2">Avg Response Time</div>
              <div className="text-xs text-text-tertiary">
                Model: {data?.analytics?.modelUsed || '-'}
              </div>
            </CardContent>
          </Card>

          {/* Card 4: User Satisfaction */}
          <Card className="bg-bg-secondary border-border-default hover:border-accent-primary/50 transition-all cursor-pointer card-hover">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <Star className="h-8 w-8 text-accent-primary" />
              </div>
              <div className="text-4xl md:text-5xl font-bold text-text-primary mb-2">
                {satisfactionRating}/5
              </div>
              <div className="text-sm text-text-secondary mb-2">User Satisfaction</div>
              <div className="text-xs text-text-tertiary">
                Based on {data?.analytics?.satisfaction?.totalRatings || ((data?.analytics?.satisfaction?.positive || 0) + (data?.analytics?.satisfaction?.negative || 0)) || 0} ratings
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Middle Row: Tabbed Analytics */}
        <Card className="bg-bg-secondary border-border-default">
          <CardHeader>
            <div className="flex gap-2 border-b border-border-default">
              {([
                { id: 'engagement' as const, label: 'Engagement', icon: BarChart3 },
                { id: 'revenue' as const, label: 'Revenue', icon: DollarSign },
                { id: 'content' as const, label: 'Content Performance', icon: FileText },
                { id: 'ai-health' as const, label: 'AI Health', icon: Zap },
                { id: 'test' as const, label: 'Test AI', icon: MessageSquare },
              ]).map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 flex items-center gap-2 border-b-2 -mb-px transition-colors ${
                      activeTab === tab.id
                        ? 'border-accent-primary text-accent-primary'
                        : 'border-transparent text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Engagement Tab */}
            {activeTab === 'engagement' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold text-text-primary">Conversations Over Time</h3>
                  <div className="flex items-center gap-2">
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
                      className="px-3 py-1.5 text-sm border border-border-default rounded bg-bg-secondary text-text-primary"
                      disabled={exporting}
                    >
                      <option value="csv">CSV</option>
                      <option value="json">JSON</option>
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border-default text-text-secondary"
                      onClick={() => handleExportChat(exportFormat)}
                      disabled={exporting}
                    >
                      {exporting ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}`}
                    </Button>
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data?.analytics?.conversationsOverTime || sparklineData}>
                      <XAxis dataKey="date" stroke="#71717A" />
                      <YAxis stroke="#71717A" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#18181B', 
                          border: '1px solid #3F3F46',
                          borderRadius: '8px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#8B5CF6" 
                        strokeWidth={2}
                        dot={{ fill: '#8B5CF6', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 bg-bg-tertiary rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">New Users</div>
                    <div className="text-2xl font-bold text-text-primary">
                      {Math.floor((data?.chats?.total || 0) * 0.6).toLocaleString()}
                    </div>
                  </div>
                  <div className="p-4 bg-bg-tertiary rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">Returning Users</div>
                    <div className="text-2xl font-bold text-text-primary">
                      {Math.floor((data?.chats?.total || 0) * 0.4).toLocaleString()}
                    </div>
                  </div>
                  <div className="p-4 bg-bg-tertiary rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">Peak Hour</div>
                    <div className="text-2xl font-bold text-text-primary">
                      {peakHour === null ? '—' : `${peakHour}:00`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Revenue Tab */}
            {activeTab === 'revenue' && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 bg-bg-tertiary rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">Pay‑per‑chat earnings</div>
                    <div className="text-2xl font-bold text-text-primary">{formatCurrency(payPerChatCents)}</div>
                  </div>
                  <div className="p-4 bg-bg-tertiary rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">Subscription revenue</div>
                    <div className="text-2xl font-bold text-text-primary">{formatCurrency(subscriptionCents)}</div>
                  </div>
                  <div className="p-4 bg-bg-tertiary rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">Active subscribers</div>
                    <div className="text-2xl font-bold text-text-primary">{activeSubs.toLocaleString()}</div>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="p-4 bg-bg-tertiary rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">Total Earned</div>
                    <div className="text-2xl font-bold text-text-primary">
                      {formatCurrency(data?.revenue?.thisMonthCents || 0)}
                    </div>
                  </div>
                  <div className="p-4 bg-bg-tertiary rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">Your Earnings (75%)</div>
                    <div className="text-2xl font-bold text-success">
                      {formatCurrency(Math.floor((data?.revenue?.thisMonthCents || 0) * 0.75))}
                    </div>
                  </div>
                  <div className="p-4 bg-bg-tertiary rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">Avg Transaction</div>
                    <div className="text-2xl font-bold text-text-primary">
                      {data?.earnings?.length ? 
                        formatCurrency(Math.floor(data.earnings.reduce((sum, e) => sum + e.amount, 0) / data.earnings.length)) :
                        '$0.00'}
                    </div>
                  </div>
                  <div className="p-4 bg-bg-tertiary rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">Conversion Rate</div>
                    <div className="text-2xl font-bold text-text-primary">
                      {data?.chats?.total ? 
                        ((data.earnings?.length || 0) / data.chats.total * 100).toFixed(1) : 
                        '0.0'}%
                    </div>
                  </div>
                </div>
                {data?.earnings && data.earnings.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.earnings.slice(-10)}>
                        <XAxis dataKey="createdAt" tickFormatter={formatDate} stroke="#71717A" />
                        <YAxis stroke="#71717A" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#18181B', 
                            border: '1px solid #3F3F46',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="amount" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState
                    title="No earnings yet"
                    description="Your earnings from pay-per-chat will appear here once users start paying for premium answers."
                    action={
                      <Button
                        variant="outline"
                        onClick={() => window.location.href = '/settings?tab=payment'}
                      >
                        Configure Payment Settings
                      </Button>
                    }
                  />
                )}
              </div>
            )}

            {/* Content Performance Tab */}
            {activeTab === 'content' && (
              <div className="space-y-6">
                <div className="p-4 bg-accent-primary/10 border border-accent-primary/20 rounded-lg">
                  <p className="text-sm text-text-primary">
                    💡 <strong>Insight:</strong> Your 'Marketing Guide' is most referenced. 
                    Consider adding more content on this topic.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-4 text-sm font-semibold text-text-secondary pb-2 border-b border-border-default">
                    <div>Source Name</div>
                    <div className="text-right">Times Referenced</div>
                    <div className="text-right">Avg Confidence</div>
                    <div className="text-right">Last Used</div>
                  </div>
                  {[
                    { name: 'Marketing Guide.pdf', references: 234, confidence: 0.92, lastUsed: '2 hours ago' },
                    { name: 'Blog Posts.txt', references: 156, confidence: 0.87, lastUsed: '5 hours ago' },
                    { name: 'YouTube Transcript', references: 89, confidence: 0.78, lastUsed: '1 day ago' },
                  ].map((source, i) => (
                    <div key={i} className="grid grid-cols-4 gap-4 py-3 border-b border-border-default">
                      <div className="text-text-primary">{source.name}</div>
                      <div className="text-right text-text-primary">{source.references}</div>
                      <div className="text-right text-text-primary">{(source.confidence * 100).toFixed(0)}%</div>
                      <div className="text-right text-text-tertiary">{source.lastUsed}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Health Tab */}
            {activeTab === 'ai-health' && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="p-4 bg-bg-tertiary rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">Avg Tokens</div>
                    <div className="text-2xl font-bold text-text-primary">1,234</div>
                  </div>
                  <div className="p-4 bg-bg-tertiary rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">Failover Rate</div>
                    <div className="text-2xl font-bold text-success">2.1%</div>
                  </div>
                  <div className="p-4 bg-bg-tertiary rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">Error Rate</div>
                    <div className="text-2xl font-bold text-success">0.5%</div>
                  </div>
                  <div className="p-4 bg-bg-tertiary rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">Monthly Cost</div>
                    <div className="text-2xl font-bold text-text-primary">$45.20</div>
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h4 className="text-sm font-semibold text-text-secondary mb-4">Model Usage</h4>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Groq Llama 3.1', value: 85 },
                              { name: 'OpenAI GPT-4', value: 12 },
                              { name: 'Groq Mixtral', value: 3 },
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {[
                              { name: 'Groq Llama 3.1', value: 85, color: '#8B5CF6' },
                              { name: 'OpenAI GPT-4', value: 12, color: '#6366F1' },
                              { name: 'Groq Mixtral', value: 3, color: '#A78BFA' },
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-text-secondary mb-4">Recent Errors</h4>
                    <div className="space-y-2">
                      <div className="p-3 bg-bg-tertiary rounded-lg border-l-2 border-error">
                        <div className="text-sm text-text-primary">Rate limit exceeded</div>
                        <div className="text-xs text-text-tertiary">2 hours ago</div>
                      </div>
                      <div className="p-3 bg-bg-tertiary rounded-lg border-l-2 border-warning">
                        <div className="text-sm text-text-primary">Timeout on long query</div>
                        <div className="text-xs text-text-tertiary">1 day ago</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ✅ D1: Test AI Tab - Polished */}
            {activeTab === 'test' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-accent-primary/10 to-accent-secondary/10 rounded-lg p-6 border border-accent-primary/20">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-text-primary mb-2">Test Your AI Clone</h3>
                      <p className="text-text-secondary text-sm">
                        Send test messages to see how your AI clone responds. This helps you refine your AI's personality and responses.
                      </p>
                      <p className="text-xs text-text-tertiary mt-2 flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        Test chats don't count toward your message limit
                      </p>
                    </div>
                  </div>
                </div>
                <MirrorPage
                  embedded
                  suggestions={[
                    'Give me a 30-second intro of who you are.',
                    'What are your top 3 principles you live by?',
                    'Explain your biggest failure and what you learned.',
                    'How would you help a beginner get started in your field?',
                    'What tools/workflows do you use every day?',
                    'What do you believe that most people disagree with?',
                  ]}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom Row: Quick Actions */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Recent Conversations */}
          <Card className="bg-bg-secondary border-border-default">
            <CardHeader>
              <CardTitle className="text-lg">Recent Conversations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentConversations.length === 0 ? (
                  <EmptyState
                    title="No conversations yet"
                    description="Once visitors chat with your AI, recent conversations will show up here."
                  />
                ) : recentConversations.map((conv, i) => (
                  <div
                    key={conv.sessionId || i}
                    className="p-3 bg-bg-tertiary rounded-lg hover:bg-bg-elevated transition-colors cursor-pointer"
                    onClick={() => nav(`/conversations/${encodeURIComponent(conv.sessionId)}`)}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-accent-primary/20 rounded-full flex items-center justify-center text-xs font-semibold text-accent-primary">
                          {(conv.label || 'U').replace('@', '').slice(0, 1).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-text-primary">{conv.label}</span>
                      </div>
                
                      {conv.rating === 'positive' ? <span className="text-lg">👍</span> : null}
                      {conv.rating === 'negative' ? <span className="text-lg">👎</span> : null}
                    </div>
                
                    <p className="text-sm text-text-secondary truncate mb-1">{conv.preview}</p>
                    <p className="text-xs text-text-tertiary">{formatDate(conv.lastMessageAt)}</p>
                  </div>
                ))}                
              </div>
              <Button variant="outline" className="w-full mt-4 border-border-default text-text-secondary" onClick={() => nav('/conversations')}>
                View All
              </Button>
            </CardContent>
          </Card>

          {/* AI Insights */}
          <Card className="bg-bg-secondary border-border-default">
            <CardHeader>
              <CardTitle className="text-lg">AI Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-3 bg-bg-tertiary rounded-lg">
                  <div className="text-sm font-semibold text-text-primary mb-1">Most asked topic:</div>
                  <div className="text-sm text-text-secondary">
                  {top}{topCount ? ` (${topCount})` : ''}
                  </div>
                </div>
                <div className="p-3 bg-bg-tertiary rounded-lg">
                  <div className="text-sm font-semibold text-text-primary mb-1">Users struggle with:</div>
                  <div className="text-sm text-text-secondary">State management</div>
                </div>
                <div className="p-3 bg-bg-tertiary rounded-lg">
                  <div className="text-sm font-semibold text-text-primary mb-1">Suggestion:</div>
                  <div className="text-sm text-text-secondary">Create content on Redux patterns</div>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-4 border-border-default text-text-secondary"
                onClick={handleGenerateInsightsReport}>
                Generate Report
              </Button>
            </CardContent>
          </Card>

          {/* Action Items */}
          <Card className="bg-bg-secondary border-border-default">
            <CardHeader>
              <CardTitle className="text-lg">Action Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-text-primary">{negativeToReviewLabel}</div>
                    {negativeToReview > 0 ? (
                      <Button
                        variant="link"
                        className="p-0 h-auto text-xs text-accent-primary mt-1"
                        onClick={() => nav('/history?range=30d&filter=disliked')}
                      >
                        Review now →
                      </Button>
                    ) : (
                      <div className="text-xs text-text-tertiary mt-1">Nothing to review yet.</div>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-bg-tertiary rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm text-text-primary">Update pricing settings</div>
                    <div className="text-xs text-text-tertiary">Completed 2 days ago</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-bg-tertiary rounded-lg">
                  <FileText className="h-5 w-5 text-accent-primary mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm text-text-primary">Add more content on topic X</div>
                    <div className="text-xs text-text-tertiary">Pending</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
