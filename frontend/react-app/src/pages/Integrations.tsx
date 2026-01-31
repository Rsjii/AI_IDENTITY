import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';

export function IntegrationsPage() {
  const { state } = useAuth();
  const user = state.status === 'authenticated' ? state.user : null;

  // Widget state
  const [color, setColor] = useState('#2563eb');
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left'>('bottom-right');
  const [title, setTitle] = useState('Selflyx');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [snippet, setSnippet] = useState('');
  const [loading, setLoading] = useState(false);

  // Instagram state
  const [igStatus, setIgStatus] = useState<{ connected: boolean; username?: string }>({ connected: false });
  const [igLoading, setIgLoading] = useState(false);

  // WhatsApp state
  const [waStatus, setWaStatus] = useState<{ connected: boolean; phoneNumber?: string }>({ connected: false });
  const [waPhoneNumber, setWaPhoneNumber] = useState('');
  const [waLoading, setWaLoading] = useState(false);
  const [waSettings, setWaSettings] = useState({
    autoReply: true,
    businessHours: '24/7',
    greeting: 'Hi! Thanks for your message.',
    paymentEnabled: true,
  });
  const [waStats, setWaStats] = useState<{
    totalMessages: number;
    todayMessages: number;
    todayConversions: number;
    todayRevenueCents: number;
  } | null>(null);

  // Widget Analytics
  const [analytics, setAnalytics] = useState<{ total: number; today: number; thisWeek: number } | null>(null);

  // Pricing state
  const [payPerChatTiers, setPayPerChatTiers] = useState<number[]>([100, 500, 1000, 2500, 5000]);
  const [defaultTierCents, setDefaultTierCents] = useState(500);
  const [pricingSaving, setPricingSaving] = useState(false);
  const payTierOptions = [
    { label: '$1', value: 100 },
    { label: '$5', value: 500 },
    { label: '$10', value: 1000 },
    { label: '$25', value: 2500 },
    { label: '$50', value: 5000 },
  ];

  const creatorId = useMemo(() => {
    return (user as any)?.publicId || user?.id || '';
  }, [user]);

  const publicSlug = (user as any)?.publicSlug || user?.handle || '';
  const standaloneLink = publicSlug ? `${window.location.origin}/chat/${publicSlug}` : '';

  const savePricing = async () => {
    setPricingSaving(true);
    try {
      const tiers = payPerChatTiers.length ? payPerChatTiers : [100, 500, 1000, 2500, 5000];
      const safeDefault = tiers.includes(defaultTierCents) ? defaultTierCents : tiers[0];

      await apiFetch('/api/creator/pricing', {
        method: 'POST',
        body: JSON.stringify({
          free: { enabled: true },
          payPerChatTiers: tiers,
          defaultTierCents: safeDefault,
          premium: { enabled: true, amountCents: tiers[0] },
          vip: { enabled: true, amountCents: tiers[tiers.length - 1] },
        }),
      });
      showToast('Saved pricing', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to save pricing', 'error');
    } finally {
      setPricingSaving(false);
    }
  };

  // Load widget code
  useEffect(() => {
    if (!creatorId) return;
    setLoading(true);
    fetch(`/api/widget/code/${encodeURIComponent(creatorId)}`, { method: 'GET' })
      .then((r) => r.text())
      .then((code) => setSnippet(code))
      .catch(() => setSnippet(''))
      .finally(() => setLoading(false));
  }, [creatorId]);

  // Load platform statuses
  useEffect(() => {
    // Instagram status
    apiFetch('/api/instagram/status')
      .then((data) => setIgStatus(data))
      .catch(() => setIgStatus({ connected: false }));

    // WhatsApp status
    apiFetch('/api/whatsapp/status')
      .then((data) => {
        setWaStatus(data);
        if (data?.settings) {
          setWaSettings((prev) => ({ ...prev, ...data.settings }));
        }
      })
      .catch(() => setWaStatus({ connected: false }));

    // WhatsApp stats
    apiFetch('/api/whatsapp/stats')
      .then((data) => setWaStats(data))
      .catch(() => setWaStats(null));

    // Widget analytics
    apiFetch('/api/widget/analytics')
      .then((data) => setAnalytics(data))
      .catch(() => setAnalytics(null));
  }, []);

  const customizedSnippet = useMemo(() => {
    if (!snippet) return '';
    const attrs = [
      `data-color="${color}"`,
      `data-position="${position}"`,
      `data-title="${title.replace(/"/g, '&quot;')}"`,
      avatarUrl ? `data-avatar-url="${avatarUrl.replace(/"/g, '&quot;')}"` : '',
      voiceEnabled ? `data-voice-enabled="true"` : '',
    ].filter(Boolean).join(' ');
    return snippet.replace(/<script\s+([^>]+)\s*><\/script>/, `<script $1 ${attrs}></script>`);
  }, [snippet, color, position, title, avatarUrl, voiceEnabled]);

  const copy = async () => {
    await navigator.clipboard.writeText(customizedSnippet);
  };

  // Instagram OAuth (simplified - in production, use proper OAuth popup)
  const connectInstagram = () => {
    const META_APP_ID = import.meta.env.VITE_META_APP_ID || '';
    if (!META_APP_ID) {
      showToast('META_APP_ID not configured. Add VITE_META_APP_ID to your .env', 'error');
      return;
    }
    const redirectUri = `${window.location.origin}/integrations`;
    const scope = 'instagram_basic,instagram_manage_messages';
    const url = `https://api.instagram.com/oauth/authorize?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`;
    window.location.href = url;
  };

  const disconnectInstagram = async () => {
    setIgLoading(true);
    try {
      await apiFetch('/api/instagram/disconnect', { method: 'POST' });
      setIgStatus({ connected: false });
    } catch (e) {
      showToast('Failed to disconnect', 'error');
    } finally {
      setIgLoading(false);
    }
  };

  // WhatsApp connect
  const connectWhatsApp = async () => {
    if (!waPhoneNumber) {
      showToast('Please enter your phone number', 'error');
      return;
    }
    setWaLoading(true);
    try {
      await apiFetch('/api/whatsapp/connect', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: waPhoneNumber }),
      });
      setWaStatus({ connected: true, phoneNumber: waPhoneNumber });
      setWaPhoneNumber('');
    } catch (e: any) {
      showToast(e.message || 'Failed to connect', 'error');
    } finally {
      setWaLoading(false);
    }
  };

  const disconnectWhatsApp = async () => {
    setWaLoading(true);
    try {
      await apiFetch('/api/whatsapp/disconnect', { method: 'POST' });
      setWaStatus({ connected: false });
    } catch (e) {
      showToast('Failed to disconnect', 'error');
    } finally {
      setWaLoading(false);
    }
  };

  const saveWhatsAppSettings = async () => {
    try {
      await apiFetch('/api/whatsapp/settings', {
        method: 'POST',
        body: JSON.stringify(waSettings),
      });
      showToast('WhatsApp settings saved', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to save WhatsApp settings', 'error');
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground mt-1">Connect platforms + generate website widget embed code.</p>
        </div>

        {/* Standalone Link + Pricing */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Standalone Link + Pricing</CardTitle>
            <CardDescription>Your public chat page + pay-per-chat pricing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm font-medium mb-1">Standalone link</div>
              <div className="flex gap-2">
                <Input value={standaloneLink} readOnly />
                <Button variant="outline" onClick={() => navigator.clipboard.writeText(standaloneLink)} disabled={!standaloneLink}>
                  Copy
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium mb-1">Select tiers</div>
              <div className="grid grid-cols-2 gap-2">
                {payTierOptions.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={payPerChatTiers.includes(opt.value)}
                      onChange={() => {
                        setPayPerChatTiers((prev) => {
                          const next = prev.includes(opt.value)
                            ? prev.filter((x) => x !== opt.value)
                            : [...prev, opt.value];
                          return next.sort((a, b) => a - b);
                        });
                      }}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-1">Default tier</div>
              <select
                className="w-full border rounded-md px-3 py-2 bg-background"
                value={defaultTierCents}
                onChange={(e) => setDefaultTierCents(Number(e.target.value))}
              >
                {payPerChatTiers.map((amount) => (
                  <option key={amount} value={amount}>
                    ${((amount / 100)).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <Button onClick={savePricing} disabled={pricingSaving}>
              {pricingSaving ? 'Saving…' : 'Save Pricing'}
            </Button>
          </CardContent>
        </Card>

        {/* Widget Analytics */}
        {analytics && (
          <Card className="glass">
            <CardHeader>
              <CardTitle>Widget Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{analytics.total}</div>
                  <div className="text-sm text-muted-foreground">Total Chats</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{analytics.today}</div>
                  <div className="text-sm text-muted-foreground">Today</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{analytics.thisWeek}</div>
                  <div className="text-sm text-muted-foreground">This Week</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Website Widget */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Website Embed Widget</CardTitle>
            <CardDescription>Customize and copy-paste the widget code into any website.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-sm font-medium mb-1">Theme color</div>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Position</div>
                <select
                  className="w-full border rounded-md px-3 py-2 bg-background"
                  value={position}
                  onChange={(e) => setPosition(e.target.value as any)}
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                </select>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Title</div>
                <input
                  className="w-full border rounded-md px-3 py-2 bg-background"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Avatar URL (optional)</div>
                <input
                  className="w-full border rounded-md px-3 py-2 bg-background"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={voiceEnabled}
                    onChange={(e) => setVoiceEnabled(e.target.checked)}
                  />
                  <span className="text-sm font-medium">Enable Voice Replies (requires voice clone setup)</span>
                </label>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Embed code</div>
              <textarea
                className="w-full border rounded-md px-3 py-2 bg-background min-h-[140px] font-mono text-xs"
                readOnly
                value={loading ? 'Loading...' : (customizedSnippet || 'Failed to load snippet')}
              />
              <div className="flex gap-2 mt-2">
                <Button onClick={copy} disabled={!customizedSnippet}>Copy</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instagram */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Instagram DM</CardTitle>
            <CardDescription>Auto-reply to Instagram Direct Messages with your AI clone.</CardDescription>
          </CardHeader>
          <CardContent>
            {igStatus.connected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-green-500">●</span>
                  <span>Connected as @{igStatus.username}</span>
                </div>
                <Button variant="destructive" onClick={disconnectInstagram} disabled={igLoading}>
                  {igLoading ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Connect your Instagram Business account to enable AI auto-replies.
                </p>
                <Button onClick={connectInstagram} disabled={igLoading}>
                  {igLoading ? 'Connecting...' : 'Connect Instagram'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Requires: Instagram Business account + Facebook Page + Meta App approval
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* WhatsApp */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>WhatsApp</CardTitle>
            <CardDescription>Auto-reply to WhatsApp messages with text + voice.</CardDescription>
          </CardHeader>
          <CardContent>
            {waStatus.connected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-green-500">●</span>
                  <span>Connected: {waStatus.phoneNumber}</span>
                </div>
                {waStats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <div className="rounded-md border p-2">
                      <div className="text-lg font-semibold">{waStats.todayMessages}</div>
                      <div className="text-xs text-muted-foreground">Messages today</div>
                    </div>
                    <div className="rounded-md border p-2">
                      <div className="text-lg font-semibold">{waStats.todayConversions}</div>
                      <div className="text-xs text-muted-foreground">Conversions</div>
                    </div>
                    <div className="rounded-md border p-2">
                      <div className="text-lg font-semibold">
                        ${(waStats.todayRevenueCents / 100).toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">Revenue today</div>
                    </div>
                    <div className="rounded-md border p-2">
                      <div className="text-lg font-semibold">{waStats.totalMessages}</div>
                      <div className="text-xs text-muted-foreground">Total messages</div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={waSettings.autoReply}
                      onChange={(e) => setWaSettings((prev) => ({ ...prev, autoReply: e.target.checked }))}
                    />
                    <span className="text-sm">Auto-reply</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={waSettings.paymentEnabled}
                      onChange={(e) => setWaSettings((prev) => ({ ...prev, paymentEnabled: e.target.checked }))}
                    />
                    <span className="text-sm">Payment links</span>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Business hours</div>
                    <Input
                      value={waSettings.businessHours}
                      onChange={(e) => setWaSettings((prev) => ({ ...prev, businessHours: e.target.value }))}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Greeting</div>
                    <Input
                      value={waSettings.greeting}
                      onChange={(e) => setWaSettings((prev) => ({ ...prev, greeting: e.target.value }))}
                    />
                  </div>
                </div>
                <Button variant="outline" onClick={saveWhatsAppSettings}>
                  Save Settings
                </Button>
                <Button variant="destructive" onClick={disconnectWhatsApp} disabled={waLoading}>
                  {waLoading ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Register your phone number to receive WhatsApp messages via our Twilio integration.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="+1234567890"
                    value={waPhoneNumber}
                    onChange={(e) => setWaPhoneNumber(e.target.value)}
                  />
                  <Button onClick={connectWhatsApp} disabled={waLoading || !waPhoneNumber}>
                    {waLoading ? 'Connecting...' : 'Connect'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Note: Messages sent to our Twilio number will be routed to your AI clone.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Phone */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Phone</CardTitle>
            <CardDescription>Enable AI voice calls via Twilio Voice.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect a phone number to allow users to call your AI clone.
            </p>
            <Button onClick={() => (window.location.href = '/phone/setup')}>
              Open Phone Setup
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
