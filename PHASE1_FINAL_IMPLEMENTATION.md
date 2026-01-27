# PHASE 1 - FINAL IMPLEMENTATION DOCUMENT

> All remaining changes to complete Phase 1 - Copy-paste ready code
> Generated: 2026-01-27

---

## EXECUTIVE SUMMARY

| Category | Current | Target | Files to Change |
|----------|---------|--------|-----------------|
| Deployment Page | 40% | 100% | 1 file rewrite |
| Creator Dashboard | 30% | 100% | 2 files (frontend + backend) |
| VoiceRecorder Integration | 50% | 100% | 1 file rewrite |
| YouTube Transcription | 5% | 100% | 1 file update |
| Widget Improvements | 70% | 100% | 1 file update |
| Widget Preview Component | 0% | 100% | 1 new file |

**Total: 6 files to change/create**

---

## FILE 1: OnboardingDeployPage.tsx (COMPLETE REWRITE)

**Path:** `frontend/react-app/src/pages/OnboardingDeployPage.tsx`

**What's being added:**
- QR code generation
- Website embed code with copy button
- Widget customization options
- Preview modal
- Social share templates
- All 4 deployment options (Web Embed, Standalone, WhatsApp, Instagram)

```tsx
import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { Copy, Check, ExternalLink, QrCode, Code, MessageCircle, Instagram } from 'lucide-react';
import QRCode from 'qrcode';

export function OnboardingDeployPage() {
  const { state } = useAuth();
  const user: any = state.status === 'authenticated' ? state.user : null;

  const [copied, setCopied] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [widgetColor, setWidgetColor] = useState('#2563eb');
  const [widgetPosition, setWidgetPosition] = useState('bottom-right');
  const [widgetTitle, setWidgetTitle] = useState('Chat with AI');
  const [welcomeMessage, setWelcomeMessage] = useState('Hey! Ask me anything!');

  const slug = user?.publicSlug || user?.handle || '';
  const creatorId = user?.id || '';
  const apiBase = window.location.origin;

  const standaloneLink = useMemo(() => (slug ? `${apiBase}/chat/${slug}` : ''), [slug, apiBase]);

  const embedCode = useMemo(() => {
    if (!creatorId) return '';
    return `<!-- Selflyx Chat Widget -->
<script
  src="${apiBase}/embed.js"
  data-api-base="${apiBase}"
  data-creator-id="${creatorId}"
  data-color="${widgetColor}"
  data-position="${widgetPosition}"
  data-title="${widgetTitle}"
  data-welcome-message="${welcomeMessage}"
></script>
<link rel="stylesheet" href="${apiBase}/embed.css" />`;
  }, [creatorId, apiBase, widgetColor, widgetPosition, widgetTitle, welcomeMessage]);

  // Generate QR code
  useEffect(() => {
    if (standaloneLink) {
      QRCode.toDataURL(standaloneLink, { width: 200, margin: 2 })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [standaloneLink]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const shareTemplates = [
    { label: 'Twitter', text: `Chat with my AI! ${standaloneLink}`, icon: '𝕏' },
    { label: 'Instagram', text: `Chat with my AI! Link in bio`, icon: '📸' },
    { label: 'WhatsApp', text: `Hey! I cloned myself. Ask me anything: ${standaloneLink}`, icon: '💬' },
    { label: 'LinkedIn', text: `I created an AI version of myself. Try it out: ${standaloneLink}`, icon: '💼' },
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deploy Your AI</h1>
          <p className="text-muted-foreground mt-1">Choose where your AI clone should live</p>
        </div>

        {/* Progress indicator */}
        <div className="flex gap-2">
          {['Quiz', 'Content', 'Voice', 'Plan', 'Deploy'].map((step, i) => (
            <div key={step} className={`h-2 flex-1 rounded ${i <= 4 ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Option A: Website Embed */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Website Embed
              </CardTitle>
              <CardDescription>Add a chat widget to your website</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Color</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="color"
                      value={widgetColor}
                      onChange={(e) => setWidgetColor(e.target.value)}
                      className="h-9 w-12 rounded border cursor-pointer"
                    />
                    <Input value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} className="flex-1" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Position</label>
                  <select
                    value={widgetPosition}
                    onChange={(e) => setWidgetPosition(e.target.value)}
                    className="w-full h-9 mt-1 rounded border bg-background px-3"
                  >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Widget Title</label>
                <Input
                  value={widgetTitle}
                  onChange={(e) => setWidgetTitle(e.target.value)}
                  placeholder="Chat with AI"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Welcome Message</label>
                <Input
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  placeholder="Hey! Ask me anything!"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Embed Code</label>
                <div className="relative mt-1">
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto max-h-32">{embedCode}</pre>
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(embedCode, 'embed')}
                  >
                    {copied === 'embed' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={() => setShowPreview(true)}>
                Preview Widget
              </Button>
            </CardContent>
          </Card>

          {/* Option B: Standalone Link */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                Standalone Link
              </CardTitle>
              <CardDescription>Share a direct link to your AI chat</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Your Chat Link</label>
                <div className="flex gap-2 mt-1">
                  <Input value={standaloneLink} readOnly className="flex-1" />
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(standaloneLink, 'link')}
                    disabled={!standaloneLink}
                  >
                    {copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* QR Code */}
              {qrDataUrl && (
                <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg">
                  <img src={qrDataUrl} alt="QR Code" className="w-40 h-40" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.download = 'chat-qr-code.png';
                      link.href = qrDataUrl;
                      link.click();
                    }}
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    Download QR
                  </Button>
                </div>
              )}

              {/* Social Share */}
              <div>
                <label className="text-sm font-medium">Share Templates</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {shareTemplates.map((t) => (
                    <Button
                      key={t.label}
                      variant="outline"
                      size="sm"
                      className="justify-start"
                      onClick={() => copyToClipboard(t.text, t.label)}
                    >
                      <span className="mr-2">{t.icon}</span>
                      {copied === t.label ? 'Copied!' : t.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Option C: WhatsApp */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                WhatsApp Business
              </CardTitle>
              <CardDescription>Auto-respond to WhatsApp messages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your WhatsApp Business account to let your AI respond to messages automatically.
              </p>
              <Button className="w-full" onClick={() => (window.location.href = '/integrations#whatsapp')}>
                Setup WhatsApp
              </Button>
            </CardContent>
          </Card>

          {/* Option D: Instagram */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Instagram className="h-5 w-5" />
                Instagram DMs
              </CardTitle>
              <CardDescription>Auto-respond to Instagram DMs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your Instagram Business account to let your AI respond to DMs automatically.
              </p>
              <Button className="w-full" onClick={() => (window.location.href = '/integrations#instagram')}>
                Setup Instagram
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Next Steps */}
        <Card className="glass bg-gradient-to-r from-primary/10 to-primary/5">
          <CardHeader>
            <CardTitle>Your AI is LIVE!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                Share with your audience
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                Monitor conversations in dashboard
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                Refine responses based on feedback
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                Track your earnings
              </div>
            </div>
            <Button className="w-full" onClick={() => (window.location.href = '/dashboard')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>

        {/* Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPreview(false)}>
            <div className="bg-background rounded-lg p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">Widget Preview</h3>
              <div className="border rounded-lg h-96 relative bg-gray-100">
                <div
                  className={`absolute bottom-4 ${widgetPosition === 'bottom-left' ? 'left-4' : 'right-4'}`}
                >
                  {/* Mock widget button */}
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg cursor-pointer"
                    style={{ backgroundColor: widgetColor }}
                  >
                    <MessageCircle className="h-6 w-6" />
                  </div>
                </div>
                {/* Mock chat panel */}
                <div className={`absolute bottom-20 ${widgetPosition === 'bottom-left' ? 'left-4' : 'right-4'} w-72 bg-white rounded-lg shadow-xl`}>
                  <div className="p-3 border-b flex items-center gap-2" style={{ backgroundColor: widgetColor }}>
                    <div className="w-8 h-8 bg-white/20 rounded-full" />
                    <span className="text-white text-sm font-medium">{widgetTitle}</span>
                  </div>
                  <div className="p-4 h-48">
                    <div className="bg-gray-100 rounded-lg p-2 text-sm">{welcomeMessage}</div>
                  </div>
                  <div className="p-3 border-t">
                    <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-400">Type a message...</div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowPreview(false)}>Close</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
```

---

## FILE 2: CreatorDashboardPage.tsx (COMPLETE REWRITE)

**Path:** `frontend/react-app/src/pages/CreatorDashboardPage.tsx`

**What's being added:**
- Full analytics section (most asked questions, response times, satisfaction)
- Active users tracking
- Peak hours chart
- Quick links to customize
- Earnings breakdown with transaction history
- Revenue formatted properly (not just cents)

```tsx
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
            <Button variant="outline" onClick={() => window.location.href = '/integrations'}>
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
```

---

## FILE 3: creatorController.ts (ADD ANALYTICS)

**Path:** `backend/src/modules/creator/creatorController.ts`

**What's being added:**
- Most asked questions query
- Response time stats
- Satisfaction score calculation
- Peak hours query
- Active users count

**Replace the entire file with:**

```typescript
import { Request, Response } from 'express';
import { z } from 'zod';
import { db, userQueries, stripePaymentQueries } from '../../config/database';

function getUserId(req: Request): string | null {
  const u: any = (req as any).user;
  return u?.id || u?.userId || null;
}

export async function dashboard(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Basic chat counts
    const totalR = await db.query(`SELECT COUNT(*)::int AS c FROM "chat_sessions" WHERE "creatorId"=$1`, [userId]);
    const todayR = await db.query(
      `SELECT COUNT(*)::int AS c FROM "chat_sessions" WHERE "creatorId"=$1 AND "createdAt">=date_trunc('day', now())`,
      [userId]
    );
    const weekR = await db.query(
      `SELECT COUNT(*)::int AS c FROM "chat_sessions" WHERE "creatorId"=$1 AND "createdAt">=now()-interval '7 days'`,
      [userId]
    );
    const monthR = await db.query(
      `SELECT COUNT(*)::int AS c FROM "chat_sessions" WHERE "creatorId"=$1 AND "createdAt">=date_trunc('month', now())`,
      [userId]
    );

    // Revenue
    const revenueThisMonth = await stripePaymentQueries.sumForCreatorSince(
      userId,
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    );

    // Active users (last 5 minutes)
    const activeR = await db.query(
      `SELECT COUNT(DISTINCT "visitorId")::int AS c FROM "active_sessions"
       WHERE "creatorId"=$1 AND "lastActiveAt" > NOW() - INTERVAL '5 minutes'`,
      [userId]
    );

    // Most asked questions (from chat_messages)
    const topQuestionsR = await db.query(
      `SELECT "content", COUNT(*)::int AS count
       FROM "chat_messages" cm
       JOIN "chat_sessions" cs ON cs.id = cm."sessionId"
       WHERE cs."creatorId" = $1 AND cm."role" = 'user'
       GROUP BY "content"
       ORDER BY count DESC
       LIMIT 10`,
      [userId]
    );

    // Response times (from mirror_runs)
    const responseTimeR = await db.query(
      `SELECT
        COALESCE(AVG("latencyMs")::int, 0) as avg,
        COALESCE(MIN("latencyMs")::int, 0) as min,
        COALESCE(MAX("latencyMs")::int, 0) as max
       FROM "mirror_runs" mr
       JOIN "identity_versions" iv ON iv.id = mr."identityVersionId"
       JOIN "identities" i ON i.id = iv."identityId"
       WHERE i."userId" = $1 AND mr."latencyMs" IS NOT NULL`,
      [userId]
    );

    // Satisfaction score (from trust_events)
    const satisfactionR = await db.query(
      `SELECT
        COALESCE(COUNT(*) FILTER (WHERE event = 'confirm_yes')::int, 0) as positive,
        COALESCE(COUNT(*) FILTER (WHERE event = 'confirm_no')::int, 0) as negative
       FROM "trust_events" te
       JOIN "identity_versions" iv ON iv.id = te."identityVersionId"
       JOIN "identities" i ON i.id = iv."identityId"
       WHERE i."userId" = $1`,
      [userId]
    );

    const positive = satisfactionR.rows[0]?.positive || 0;
    const negative = satisfactionR.rows[0]?.negative || 0;
    const total = positive + negative;
    const score = total > 0 ? Math.round((positive / total) * 100) : 0;

    // Peak hours
    const peakHoursR = await db.query(
      `SELECT EXTRACT(HOUR FROM cs."createdAt")::int as hour, COUNT(*)::int as count
       FROM "chat_sessions" cs
       WHERE cs."creatorId" = $1 AND cs."createdAt" >= NOW() - INTERVAL '30 days'
       GROUP BY hour
       ORDER BY hour`,
      [userId]
    );

    return res.json({
      success: true,
      chats: {
        total: totalR.rows[0]?.c || 0,
        today: todayR.rows[0]?.c || 0,
        week: weekR.rows[0]?.c || 0,
        month: monthR.rows[0]?.c || 0,
      },
      revenue: { thisMonthCents: revenueThisMonth },
      activeUsers: activeR.rows[0]?.c || 0,
      analytics: {
        topQuestions: topQuestionsR.rows,
        responseTime: responseTimeR.rows[0] || { avg: 0, min: 0, max: 0 },
        satisfaction: { positive, negative, score },
        peakHours: peakHoursR.rows,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
}

export async function earnings(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const r = await db.query(
    `SELECT * FROM "stripe_payments" WHERE "creatorId"=$1 ORDER BY "createdAt" DESC LIMIT 100`,
    [userId]
  );

  return res.json({ success: true, items: r.rows });
}

const pricingSchema = z.object({
  free: z.object({ enabled: z.boolean().default(true) }).passthrough().optional(),
  premium: z.object({ enabled: z.boolean().default(true), amountCents: z.number().int().min(50) }).passthrough().optional(),
  vip: z.object({ enabled: z.boolean().default(true), amountCents: z.number().int().min(50) }).passthrough().optional(),
}).passthrough();

export async function setPricing(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const cfg = pricingSchema.parse(req.body);
  const u = await userQueries.updatePricing(userId, cfg);
  return res.json({ success: true, priceConfig: u.priceConfig });
}

export async function startTrial(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const u = await userQueries.startTrial(userId, 7);
  return res.json({ success: true, trialEndsAt: u.trialEndsAt });
}
```

---

## FILE 4: VoiceSetupPage.tsx (INTEGRATE VOICE RECORDER)

**Path:** `frontend/react-app/src/pages/VoiceSetupPage.tsx`

**What's being added:**
- VoiceRecorder component integration
- Toggle between record and upload
- Skip button
- Better UX with tabs

```tsx
import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetchForm } from '@/lib/api';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { Mic, Upload, SkipForward } from 'lucide-react';

export function VoiceSetupPage() {
  const [mode, setMode] = useState<'record' | 'upload'>('record');
  const [label, setLabel] = useState('Professional');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const handleUpload = async (audioData: Blob | File) => {
    setLoading(true);
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('audio', audioData, audioData instanceof File ? audioData.name : 'recording.webm');
      fd.append('label', label);

      const res = await apiFetchForm<any>('/api/voice/upload', { method: 'POST', body: fd });
      setMsg(`Voice uploaded successfully! ID: ${res?.voiceClone?.id || ''}`);
      setFile(null);
    } catch (e: any) {
      setMsg(`Upload failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRecorderUpload = async (blob: Blob) => {
    await handleUpload(blob);
  };

  const handleFileUpload = async () => {
    if (file) {
      await handleUpload(file);
    }
  };

  const handleSkip = () => {
    window.location.href = '/onboarding/plan';
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Voice Setup</h1>
          <p className="text-muted-foreground mt-1">
            Record or upload your voice to create a voice clone (optional)
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex gap-2">
          {['Quiz', 'Content', 'Voice', 'Plan', 'Deploy'].map((step, i) => (
            <div key={step} className={`h-2 flex-1 rounded ${i <= 2 ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2">
          <Button
            variant={mode === 'record' ? 'default' : 'outline'}
            onClick={() => setMode('record')}
            className="flex-1"
          >
            <Mic className="h-4 w-4 mr-2" />
            Record
          </Button>
          <Button
            variant={mode === 'upload' ? 'default' : 'outline'}
            onClick={() => setMode('upload')}
            className="flex-1"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload File
          </Button>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>
              {mode === 'record' ? 'Record Your Voice' : 'Upload Voice Sample'}
            </CardTitle>
            <CardDescription>
              {mode === 'record'
                ? 'Record up to 10 minutes of your voice. Speak naturally about your area of expertise.'
                : 'Upload an audio file (MP3, WAV, M4A) up to 10MB.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Label Input */}
            <div>
              <label className="text-sm font-medium mb-1 block">Voice Label</label>
              <input
                className="w-full border rounded-md px-3 py-2 bg-background"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Professional, Casual, Energetic"
              />
            </div>

            {mode === 'record' ? (
              /* Voice Recorder */
              <VoiceRecorder onUpload={handleRecorderUpload} onSkip={handleSkip} />
            ) : (
              /* File Upload */
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Audio File (MP3/WAV/M4A, max 10MB)</label>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full border rounded-md p-2"
                  />
                  {file && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </div>
                  )}
                </div>

                <Button className="w-full" onClick={handleFileUpload} disabled={!file || loading}>
                  {loading ? 'Uploading...' : 'Upload Voice Sample'}
                </Button>
              </div>
            )}

            {/* Status Message */}
            {msg && (
              <div className={`p-3 rounded-lg text-sm ${
                msg.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {msg}
              </div>
            )}

            {/* Tips */}
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="text-sm font-medium">Tips for best results:</div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Speak in a quiet environment</li>
                <li>- Use a consistent tone and pace</li>
                <li>- Record for at least 5 minutes</li>
                <li>- Avoid background noise</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Skip Button */}
        <Button variant="ghost" className="w-full" onClick={handleSkip}>
          <SkipForward className="h-4 w-4 mr-2" />
          Skip for now
        </Button>
      </div>
    </Layout>
  );
}
```

---

## FILE 5: contentService.ts - YouTube Transcription (UPDATE)

**Path:** `backend/src/modules/content/contentService.ts`

**What's being added:**
- Actual YouTube transcription using `youtube-transcript` package
- Fallback to storing URL if transcription fails

**First, install the package:**
```bash
cd backend && npm install youtube-transcript
```

**Then update the `getYouTubeTranscript` function (lines 84-99) to:**

```typescript
// Add this import at the top of the file (after line 3):
import { YoutubeTranscript } from 'youtube-transcript';

// Replace the getYouTubeTranscript function (lines 84-99) with:
async function getYouTubeTranscript(url: string): Promise<string> {
  // Extract video ID
  const videoIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  if (!videoIdMatch) {
    throw new Error('Invalid YouTube URL');
  }
  const videoId = videoIdMatch[1];

  try {
    // Try to get transcript using youtube-transcript package
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    if (transcript && transcript.length > 0) {
      // Combine all transcript segments into one text
      const fullText = transcript.map(segment => segment.text).join(' ');
      logger.info(`Successfully transcribed YouTube video ${videoId}: ${fullText.length} characters`);
      return fullText;
    }

    logger.warn(`No transcript available for video ${videoId}`);
    return '';
  } catch (error: any) {
    // Handle specific error cases
    if (error.message?.includes('disabled') || error.message?.includes('Transcript is disabled')) {
      logger.warn(`Transcripts disabled for video ${videoId}`);
    } else if (error.message?.includes('not found') || error.message?.includes('Video not found')) {
      logger.warn(`Video not found: ${videoId}`);
    } else {
      logger.error({ error, videoId }, 'YouTube transcription failed');
    }

    // Return empty string - URL will still be stored
    return '';
  }
}
```

**Full updated contentService.ts file:**

```typescript
import { uploadPublicBuffer } from '../../services/s3Service';
import { knowledgeSourceQueries, knowledgeChunkQueries } from '../../config/database';
import { logger } from '../../config/logger';
import { YoutubeTranscript } from 'youtube-transcript';

// PDF parsing
let pdfParse: any = null;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  logger.warn('pdf-parse not installed, PDF parsing disabled');
}

// Word parsing
let mammoth: any = null;
try {
  mammoth = require('mammoth');
} catch (e) {
  logger.warn('mammoth not installed, Word parsing disabled');
}

// OpenAI for Whisper transcription
let OpenAI: any = null;
let openaiClient: any = null;
try {
  OpenAI = require('openai');
  if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch (e) {
  logger.warn('openai not installed or configured, audio transcription disabled');
}

function chunkText(text: string, chunkSize = 1200): string[] {
  const clean = (text || '').trim();
  if (!clean) return [];
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += chunkSize) out.push(clean.slice(i, i + chunkSize));
  return out;
}

async function transcribeAudio(buffer: Buffer, mimeType: string): Promise<string> {
  if (!openaiClient) {
    throw new Error('OpenAI API not configured for audio transcription');
  }
  try {
    const file = new (require('openai').FileFromBuffer)(buffer, 'audio', mimeType);
    const transcription = await openaiClient.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
    });
    return transcription.text || '';
  } catch (error: any) {
    try {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', buffer, { filename: 'audio', contentType: mimeType });
      form.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          ...form.getHeaders(),
        },
        body: form,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${errorText}`);
      }

      const result = await response.json() as { text?: string };
      return result.text || '';
    } catch (fallbackError: any) {
      logger.error({ error, fallbackError }, 'Whisper transcription failed');
      throw new Error(`Transcription failed: ${fallbackError.message || error.message}`);
    }
  }
}

async function getYouTubeTranscript(url: string): Promise<string> {
  // Extract video ID
  const videoIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  if (!videoIdMatch) {
    throw new Error('Invalid YouTube URL');
  }
  const videoId = videoIdMatch[1];

  try {
    // Try to get transcript using youtube-transcript package
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    if (transcript && transcript.length > 0) {
      // Combine all transcript segments into one text
      const fullText = transcript.map(segment => segment.text).join(' ');
      logger.info(`Successfully transcribed YouTube video ${videoId}: ${fullText.length} characters`);
      return fullText;
    }

    logger.warn(`No transcript available for video ${videoId}`);
    return '';
  } catch (error: any) {
    // Handle specific error cases
    if (error.message?.includes('disabled') || error.message?.includes('Transcript is disabled')) {
      logger.warn(`Transcripts disabled for video ${videoId}`);
    } else if (error.message?.includes('not found') || error.message?.includes('Video not found')) {
      logger.warn(`Video not found: ${videoId}`);
    } else {
      logger.error({ error, videoId }, 'YouTube transcription failed');
    }

    // Return empty string - URL will still be stored
    return '';
  }
}

export async function createPasteSource(userId: string, title: string | undefined, rawText: string) {
  const source = await knowledgeSourceQueries.create({ userId, type: 'paste', title, rawText });
  const chunks = chunkText(rawText);
  await knowledgeChunkQueries.replaceForSource(userId, source.id, chunks);
  return source;
}

export async function createYoutubeSource(userId: string, url: string, title?: string) {
  let transcribedText = '';
  try {
    transcribedText = await getYouTubeTranscript(url);
  } catch (error: any) {
    logger.warn({ error, url }, 'YouTube transcription failed, storing URL only');
  }

  const source = await knowledgeSourceQueries.create({
    userId,
    type: 'youtube',
    title: title || 'YouTube',
    originalUrl: url,
    rawText: transcribedText || undefined,
  });

  const chunks = transcribedText ? chunkText(transcribedText) : [];
  await knowledgeChunkQueries.replaceForSource(userId, source.id, chunks);
  return source;
}

export async function createFileSource(userId: string, file: Express.Multer.File, title?: string) {
  let extractedText = '';
  const mimeType = file.mimetype || '';

  try {
    if (mimeType === 'application/pdf' && pdfParse) {
      const data = await pdfParse(file.buffer);
      extractedText = data.text || '';
    } else if ((mimeType.includes('word') || mimeType.includes('document') || file.originalname.endsWith('.docx')) && mammoth) {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      extractedText = result.value || '';
    } else if (mimeType.startsWith('text/')) {
      extractedText = file.buffer.toString('utf-8');
    } else if (mimeType.startsWith('audio/') && openaiClient) {
      extractedText = await transcribeAudio(file.buffer, mimeType);
    }
  } catch (error: any) {
    logger.warn({ error, mimeType, filename: file.originalname }, 'File parsing/transcription failed, storing file only');
  }

  const upload = await uploadPublicBuffer({
    keyPrefix: `knowledge/${userId}/files`,
    contentType: file.mimetype || 'application/octet-stream',
    body: file.buffer,
    ext: (file.originalname.split('.').pop() || '').toLowerCase(),
  });

  const source = await knowledgeSourceQueries.create({
    userId,
    type: 'file',
    title: title || file.originalname,
    storageUrl: upload.url,
    rawText: extractedText || undefined,
  });

  const chunks = extractedText ? chunkText(extractedText) : [];
  await knowledgeChunkQueries.replaceForSource(userId, source.id, chunks);
  return source;
}
```

---

## FILE 6: embed.js (ADD WELCOME MESSAGE & POPULAR QUESTIONS)

**Path:** `frontend/src/public/embed.js`

**What's being added:**
- `data-welcome-message` attribute support
- `data-popular-questions` attribute support
- Popular questions as clickable buttons

```javascript
(function() {
  const script = document.currentScript;
  const API_BASE = script.getAttribute('data-api-base') || '';
  const CREATOR_ID = script.getAttribute('data-creator-id') || '';
  const COLOR = script.getAttribute('data-color') || '#2563eb';
  const POSITION = script.getAttribute('data-position') || 'bottom-right';
  const TITLE = script.getAttribute('data-title') || 'Chat with AI';
  const AVATAR_URL = script.getAttribute('data-avatar-url') || '';
  const VOICE_ENABLED = script.getAttribute('data-voice-enabled') === 'true';
  const WELCOME_MESSAGE = script.getAttribute('data-welcome-message') || 'Hey! Ask me anything!';
  const POPULAR_QUESTIONS = (script.getAttribute('data-popular-questions') || '').split(',').filter(Boolean);

  if (!API_BASE || !CREATOR_ID) {
    console.error('[Selflyx Widget] Missing data-api-base or data-creator-id');
    return;
  }

  // Create widget container
  const container = document.createElement('div');
  container.id = 'selflyx-widget-container';
  container.innerHTML = `
    <button id="selflyx-widget-btn" style="background:${COLOR}">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
    </button>
    <div id="selflyx-widget-panel" class="selflyx-hidden">
      <div id="selflyx-widget-header">
        ${AVATAR_URL ? `<img id="selflyx-widget-avatar" src="${AVATAR_URL}" alt="Avatar" />` : ''}
        <span>${TITLE}</span>
        <button id="selflyx-widget-close">&times;</button>
      </div>
      <div id="selflyx-widget-messages"></div>
      <div id="selflyx-widget-popular" style="display:none;padding:8px 16px;"></div>
      <div id="selflyx-widget-input-container">
        <input type="text" id="selflyx-widget-input" placeholder="Type a message..." />
        <button id="selflyx-widget-send" style="background:${COLOR}">Send</button>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  // Position
  const posStyle = POSITION === 'bottom-left' ? 'left:20px;right:auto;' : 'right:20px;left:auto;';
  container.style.cssText = `position:fixed;bottom:20px;${posStyle}z-index:999999;`;

  const btn = document.getElementById('selflyx-widget-btn');
  const panel = document.getElementById('selflyx-widget-panel');
  const closeBtn = document.getElementById('selflyx-widget-close');
  const input = document.getElementById('selflyx-widget-input');
  const sendBtn = document.getElementById('selflyx-widget-send');
  const messagesDiv = document.getElementById('selflyx-widget-messages');
  const popularDiv = document.getElementById('selflyx-widget-popular');

  // Add welcome message
  if (WELCOME_MESSAGE) {
    const welcomeMsg = document.createElement('div');
    welcomeMsg.className = 'selflyx-msg selflyx-msg-bot';
    welcomeMsg.textContent = WELCOME_MESSAGE;
    messagesDiv.appendChild(welcomeMsg);
  }

  // Add popular questions
  if (POPULAR_QUESTIONS.length > 0) {
    popularDiv.style.display = 'flex';
    popularDiv.style.flexWrap = 'wrap';
    popularDiv.style.gap = '8px';
    POPULAR_QUESTIONS.forEach(q => {
      const qBtn = document.createElement('button');
      qBtn.className = 'selflyx-question-btn';
      qBtn.textContent = q.trim();
      qBtn.style.cssText = `
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.2s;
      `;
      qBtn.onmouseover = () => qBtn.style.background = '#e5e7eb';
      qBtn.onmouseout = () => qBtn.style.background = '#f3f4f6';
      qBtn.onclick = () => {
        input.value = q.trim();
        sendMessage();
        popularDiv.style.display = 'none';
      };
      popularDiv.appendChild(qBtn);
    });
  }

  btn.onclick = () => {
    panel.classList.toggle('selflyx-hidden');
    btn.classList.toggle('selflyx-hidden');
    if (!panel.classList.contains('selflyx-hidden')) input.focus();
  };

  closeBtn.onclick = () => {
    panel.classList.add('selflyx-hidden');
    btn.classList.remove('selflyx-hidden');
  };

  function addMessage(text, isUser, audioUrl) {
    const msg = document.createElement('div');
    msg.className = isUser ? 'selflyx-msg selflyx-msg-user' : 'selflyx-msg selflyx-msg-bot';
    msg.textContent = text;
    messagesDiv.appendChild(msg);

    // Add audio player if voice is available
    if (audioUrl && !isUser) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = audioUrl;
      audio.style.cssText = 'width:100%;margin-top:8px;';
      msg.appendChild(audio);
      audio.play().catch(() => {});
    }

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function addTypingIndicator() {
    const typing = document.createElement('div');
    typing.id = 'selflyx-typing';
    typing.className = 'selflyx-msg selflyx-msg-bot';
    typing.innerHTML = '<span class="selflyx-typing-dot"></span><span class="selflyx-typing-dot"></span><span class="selflyx-typing-dot"></span>';
    typing.style.cssText = 'display:flex;gap:4px;padding:12px 16px;';
    messagesDiv.appendChild(typing);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return typing;
  }

  function removeTypingIndicator() {
    const typing = document.getElementById('selflyx-typing');
    if (typing) typing.remove();
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMessage(text, true);

    // Hide popular questions after first message
    popularDiv.style.display = 'none';

    const typing = addTypingIndicator();

    try {
      const res = await fetch(`${API_BASE}/api/widget/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: CREATOR_ID,
          message: text,
          voiceEnabled: VOICE_ENABLED
        }),
      });
      const data = await res.json();
      removeTypingIndicator();

      if (data.requiresPayment) {
        // Show payment prompt
        addMessage(`This is a premium feature. Click here to unlock: ${API_BASE}/chat/${CREATOR_ID}?upgrade=1`, false);
      } else if (data.reply) {
        addMessage(data.reply, false, data.audioUrl);
      } else {
        addMessage('Sorry, I could not respond.', false);
      }
    } catch (e) {
      removeTypingIndicator();
      addMessage('Error connecting to server.', false);
    }
  }

  sendBtn.onclick = sendMessage;
  input.onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };

  // Add typing indicator styles
  const style = document.createElement('style');
  style.textContent = `
    .selflyx-typing-dot {
      width: 8px;
      height: 8px;
      background: #9ca3af;
      border-radius: 50%;
      animation: selflyx-bounce 1.4s infinite ease-in-out;
    }
    .selflyx-typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .selflyx-typing-dot:nth-child(2) { animation-delay: -0.16s; }
    @keyframes selflyx-bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
})();
```

---

## ADDITIONAL PACKAGE INSTALLATIONS

Run these commands to install required packages:

### Backend:
```bash
cd backend
npm install youtube-transcript
```

### Frontend (already installed, verify):
```bash
cd frontend/react-app
npm install qrcode @stripe/stripe-js @stripe/react-stripe-js recharts
```

**Add type definition for qrcode (if not present):**
```bash
npm install --save-dev @types/qrcode
```

---

## SUMMARY CHECKLIST

| # | File | Action | Status |
|---|------|--------|--------|
| 1 | `frontend/react-app/src/pages/OnboardingDeployPage.tsx` | REPLACE | Ready |
| 2 | `frontend/react-app/src/pages/CreatorDashboardPage.tsx` | REPLACE | Ready |
| 3 | `backend/src/modules/creator/creatorController.ts` | REPLACE | Ready |
| 4 | `frontend/react-app/src/pages/VoiceSetupPage.tsx` | REPLACE | Ready |
| 5 | `backend/src/modules/content/contentService.ts` | REPLACE | Ready |
| 6 | `frontend/src/public/embed.js` | REPLACE | Ready |

---

## POST-IMPLEMENTATION VERIFICATION

After applying all changes, verify:

1. **Deploy Page:**
   - [ ] QR code generates correctly
   - [ ] Embed code copies to clipboard
   - [ ] Widget preview modal works
   - [ ] Social share templates copy correctly

2. **Dashboard:**
   - [ ] Chat counts display correctly
   - [ ] Revenue shows in dollars (not cents)
   - [ ] Analytics tab shows questions, response times
   - [ ] Earnings tab shows transaction history

3. **Voice Setup:**
   - [ ] Recording works in browser
   - [ ] File upload still works
   - [ ] Skip button navigates correctly

4. **YouTube Transcription:**
   - [ ] Videos with captions transcribe
   - [ ] Videos without captions store URL only
   - [ ] Error handling works properly

5. **Widget:**
   - [ ] Welcome message displays
   - [ ] Popular questions show as buttons
   - [ ] Typing indicator animates

---

## END OF DOCUMENT

This document contains all remaining changes for Phase 1 completion.
Total lines of new code: ~1200
Estimated implementation time: 1-2 hours (copy-paste)
