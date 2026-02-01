import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { Copy, Eye, FileCode, MessageCircle, QrCode, Check, ExternalLink, Download } from 'lucide-react';
import { FLAGS } from '@/lib/flags';
import QRCode from 'qrcode';

export function IntegrationsPage() {
  const { state } = useAuth();
  const user = state.status === 'authenticated' ? state.user : null;

  // QR Code & Sharing state
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<string | null>(null);

  // Widget state
  const [color, setColor] = useState('#2563eb');
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left'>('bottom-right');
  const [title, setTitle] = useState('Selflyx');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('Hey! Ask me anything!');
  const [popularQuestions, setPopularQuestions] = useState('');
  const [showPreview, setShowPreview] = useState(false);

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
  const apiBase = window.location.origin;

  // Social share templates
  const shareTemplates = [
    { label: 'Twitter', text: `Chat with my AI! ${standaloneLink}`, icon: '𝕏' },
    { label: 'Instagram', text: `Chat with my AI! Link in bio`, icon: '📸' },
    { label: 'WhatsApp', text: `Hey! I cloned myself. Ask me anything: ${standaloneLink}`, icon: '💬' },
    { label: 'LinkedIn', text: `I created an AI version of myself. Try it out: ${standaloneLink}`, icon: '💼' },
    { label: 'Facebook', text: `Check out my AI clone! Chat with it here: ${standaloneLink}`, icon: '📘' },
  ];

  // Generate embed code client-side
  const embedCode = useMemo(() => {
    if (!creatorId) return '';
    
    const questionsAttr = popularQuestions.trim()
      ? `data-popular-questions="${popularQuestions.split(',').map(q => q.trim()).filter(Boolean).join(',')}"`
      : '';
    
    return `<!-- Selflyx Chat Widget -->
<script
  src="${apiBase}/embed.js"
  data-api-base="${apiBase}"
  data-creator-id="${creatorId}"
  data-creator-slug="${publicSlug}"
  data-color="${color}"
  data-position="${position}"
  data-title="${title.replace(/"/g, '&quot;')}"
  ${avatarUrl ? `data-avatar-url="${avatarUrl.replace(/"/g, '&quot;')}"` : ''}
  ${voiceEnabled ? 'data-voice-enabled="true"' : ''}
  data-welcome-message="${welcomeMessage.replace(/"/g, '&quot;')}"
  ${questionsAttr}
></script>
<link rel="stylesheet" href="${apiBase}/embed.css" />`;
  }, [creatorId, publicSlug, apiBase, color, position, title, avatarUrl, voiceEnabled, welcomeMessage, popularQuestions]);

  const generateTestHtml = () => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Selflyx Widget</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
            line-height: 1.6;
        }
        h1 { color: #333; }
        .info {
            background: #f0f0f0;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <h1>🧪 Testing Selflyx Embed Widget</h1>
    <div class="info">
        <p><strong>Instructions:</strong></p>
        <ol>
            <li>Save this file as <code>test-widget.html</code></li>
            <li>Open it in your browser</li>
            <li>The widget should appear in the ${position} corner</li>
            <li>Click it to test the chat!</li>
        </ol>
    </div>
    <h2>Your Website Content Here</h2>
    <p>This is a sample website. The chat widget should appear below.</p>
    
    ${embedCode}
</body>
</html>`;
  };

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

  // Generate QR code
  useEffect(() => {
    if (standaloneLink) {
      QRCode.toDataURL(standaloneLink, { width: 256, margin: 2 })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [standaloneLink]);

  // Load platform statuses (only if features are enabled)
  useEffect(() => {
    // Instagram status (only if enabled)
    if (FLAGS.instagram) {
      apiFetch('/api/instagram/status')
        .then((data) => setIgStatus(data))
        .catch(() => setIgStatus({ connected: false }));
    }

    // WhatsApp status (only if enabled)
    if (FLAGS.whatsapp) {
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
    }

    // Widget analytics (only if widget enabled)
    if (FLAGS.widget) {
      apiFetch('/api/widget/analytics')
        .then((data) => setAnalytics(data))
        .catch(() => setAnalytics(null));
    }
  }, []);


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

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    showToast('Copied to clipboard!', 'success');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">🚀 Integrations & Deployment</h1>
          <p className="text-muted-foreground mt-1">Complete deployment toolkit + ongoing management</p>
        </div>

        {/* 1️⃣ YOUR CHAT LINK & SHARING */}
        <Card className="glass border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="text-xl">1️⃣ Your Chat Link & Sharing</CardTitle>
            <CardDescription>Share your AI with the world - all the tools you need</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Standalone Link */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Standalone Link</label>
              <div className="flex gap-2">
                <Input
                  value={standaloneLink || 'Set your public handle in Settings first'}
                  readOnly
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  onClick={() => standaloneLink && copyToClipboard(standaloneLink, 'standalone-link')}
                  disabled={!standaloneLink}
                >
                  {copied === 'standalone-link' ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => standaloneLink && window.open(standaloneLink, '_blank')}
                  disabled={!standaloneLink}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Test
                </Button>
              </div>
            </div>

            {/* QR Code */}
            {qrDataUrl && (
              <div className="space-y-2">
                <label className="text-sm font-semibold">📱 QR Code</label>
                <div className="flex items-start gap-4">
                  <div className="bg-white p-3 rounded-lg border-2">
                    <img src={qrDataUrl} alt="QR Code" className="w-32 h-32" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Print this QR code on business cards, flyers, or anywhere you want people to scan and chat with your AI instantly.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.download = `${publicSlug || 'chat'}-qr-code.png`;
                          link.href = qrDataUrl;
                          link.click();
                          showToast('QR Code downloaded!', 'success');
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download PNG
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(qrDataUrl, 'qr-code')}
                      >
                        {copied === 'qr-code' ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Image
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Social Share Templates */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">📢 Social Share Templates</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {shareTemplates.map((t) => (
                  <Button
                    key={t.label}
                    variant="outline"
                    className="justify-start h-auto py-3"
                    onClick={() => copyToClipboard(t.text, t.label)}
                  >
                    <span className="mr-2 text-lg">{t.icon}</span>
                    <div className="text-left flex-1">
                      <div className="font-medium text-sm">{t.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{t.text}</div>
                    </div>
                    {copied === t.label ? (
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <Copy className="h-4 w-4 flex-shrink-0" />
                    )}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                💡 Click to copy the template, then paste it on your social media post
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 4️⃣ Pricing Configuration (only if pay-per-chat enabled) */}
        {FLAGS.payPerChat && (
        <>
          <div className="pt-4">
            <h2 className="text-2xl font-bold mb-4">4️⃣ Pricing Configuration</h2>
          </div>
          <Card className="glass">
            <CardHeader>
              <CardTitle>Pay-Per-Chat Pricing</CardTitle>
              <CardDescription>Configure your pay-per-chat pricing tiers and default tier.</CardDescription>
            </CardHeader>
          <CardContent className="space-y-3">
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
        </>
        )}

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

        {/* How to Add Widget Guide */}
        <Card className="glass bg-blue-50 dark:bg-blue-950 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">📖 How to Add Widget to Your Website</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <strong>Step 1:</strong> Customize your widget (color, position, title, etc.)
            </div>
            <div>
              <strong>Step 2:</strong> Click "Copy" to copy the embed code
            </div>
            <div>
              <strong>Step 3:</strong> Paste the code into your website:
              <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                <li><strong>WordPress:</strong> Appearance → Theme Editor → Footer (before &lt;/body&gt;)</li>
                <li><strong>Wix/Squarespace:</strong> Settings → Custom Code → Add to Footer</li>
                <li><strong>HTML Website:</strong> Open your HTML file, paste before &lt;/body&gt; tag</li>
                <li><strong>Shopify:</strong> Online Store → Themes → Actions → Edit Code → theme.liquid (before &lt;/body&gt;)</li>
              </ul>
            </div>
            <div>
              <strong>Step 4:</strong> Save and refresh your website. Widget will appear!
            </div>
            <div className="pt-2 border-t">
              <strong>💡 Tip:</strong> Use "Get Test HTML" to create a test file and see how it looks before adding to your real website.
            </div>
          </CardContent>
        </Card>

        {/* 2️⃣ Website Widget */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>2️⃣ Website Embed Widget</CardTitle>
            <CardDescription>Customize and copy-paste the widget code into any website.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!creatorId ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Please complete your profile to generate embed code.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Theme Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="h-10 w-16 rounded border cursor-pointer"
                      />
                      <Input
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="flex-1"
                        placeholder="#2563eb"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Position</label>
                    <select
                      className="w-full border rounded-md px-3 py-2 bg-background h-10"
                      value={position}
                      onChange={(e) => setPosition(e.target.value as any)}
                    >
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-left">Bottom Left</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Widget Title</label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Chat with AI"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Avatar URL (optional)</label>
                    <Input
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-1 block">Welcome Message</label>
                    <Input
                      value={welcomeMessage}
                      onChange={(e) => setWelcomeMessage(e.target.value)}
                      placeholder="Hey! Ask me anything!"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This message appears when users first open the chat widget.
                    </p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-1 block">Popular Questions (comma-separated)</label>
                    <Input
                      value={popularQuestions}
                      onChange={(e) => setPopularQuestions(e.target.value)}
                      placeholder="What do you do?, How can I help?, Tell me about yourself"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Add quick question buttons. Separate multiple questions with commas.
                    </p>
                  </div>
                  {FLAGS.voice && (
                  <div className="col-span-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={voiceEnabled}
                        onChange={(e) => setVoiceEnabled(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium">Enable Voice Replies (requires voice clone setup)</span>
                    </label>
                  </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <label className="text-sm font-medium mb-2 block">Embed Code</label>
                  <div className="relative">
                    <textarea
                      className="w-full border rounded-md px-3 py-2 bg-muted font-mono text-xs min-h-[160px] resize-none"
                      readOnly
                      value={embedCode || 'Generating code...'}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2"
                      onClick={() => {
                        navigator.clipboard.writeText(embedCode);
                        showToast('Code copied to clipboard!', 'success');
                      }}
                      disabled={!embedCode}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowPreview(true)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview Widget
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      const testHtml = generateTestHtml();
                      navigator.clipboard.writeText(testHtml);
                      showToast('Test HTML copied! Paste it in a file and open in browser.', 'success');
                    }}
                  >
                    <FileCode className="h-4 w-4 mr-2" />
                    Get Test HTML
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 3️⃣ PLATFORM INTEGRATIONS */}
        {(FLAGS.instagram || FLAGS.whatsapp) && (
          <div className="pt-4">
            <h2 className="text-2xl font-bold mb-4">3️⃣ Platform Integrations</h2>
          </div>
        )}

        {/* Instagram (only if enabled) */}
        {FLAGS.instagram && (
        <Card className="glass">
          <CardHeader>
            <CardTitle>📸 Instagram DM Auto-Reply</CardTitle>
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
        )}

        {/* WhatsApp (only if enabled) */}
        {FLAGS.whatsapp && (
        <Card className="glass">
          <CardHeader>
            <CardTitle>💬 WhatsApp Business</CardTitle>
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
        )}

        {/* Phone (Phase 2/3 - hidden for Phase 1) */}
        {false && (
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
        )}

        {/* Preview Modal */}
        {showPreview && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowPreview(false)}
          >
            <div
              className="bg-background rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">Widget Preview</h3>
              <div className="border rounded-lg h-96 relative bg-gray-100 dark:bg-gray-800">
                <div
                  className={`absolute bottom-4 ${position === 'bottom-left' ? 'left-4' : 'right-4'}`}
                >
                  {/* Mock widget button */}
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg cursor-pointer"
                    style={{ backgroundColor: color }}
                  >
                    <MessageCircle className="h-6 w-6" />
                  </div>
                </div>
                {/* Mock chat panel */}
                <div
                  className={`absolute bottom-20 ${position === 'bottom-left' ? 'left-4' : 'right-4'} w-72 bg-white dark:bg-gray-900 rounded-lg shadow-xl`}
                >
                  <div
                    className="p-3 border-b flex items-center gap-2"
                    style={{ backgroundColor: color }}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 bg-white/20 rounded-full" />
                    )}
                    <span className="text-white text-sm font-medium">{title}</span>
                  </div>
                  <div className="p-4 h-48 overflow-y-auto">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 text-sm mb-2">
                      {welcomeMessage}
                    </div>
                    {popularQuestions && (
                      <div className="flex flex-wrap gap-2">
                        {popularQuestions.split(',').slice(0, 3).map((q, i) => (
                          <button
                            key={i}
                            className="bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1 text-xs"
                          >
                            {q.trim()}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-400">
                      Type a message...
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
