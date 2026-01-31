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
  const creatorId = (user as any)?.publicId || user?.id || '';
  const apiBase = window.location.origin;
  const avatarUrl = user?.profileImage || '';
  const voiceEnabled = (user as any)?.voiceClones?.some((v: any) => v.status === 'ready') || false;
  const popularQuestions = ((user as any)?.priceConfig?.popularQuestions || []).join(',');

  const standaloneLink = useMemo(() => (slug ? `${apiBase}/chat/${slug}` : ''), [slug, apiBase]);

  const embedCode = useMemo(() => {
    if (!creatorId) return '';
    return `<!-- Selflyx Chat Widget -->
<script
  src="${apiBase}/embed.js"
  data-api-base="${apiBase}"
  data-creator-id="${creatorId}"
  data-creator-slug="${slug}"
  data-color="${widgetColor}"
  data-position="${widgetPosition}"
  data-title="${widgetTitle}"
  data-avatar-url="${avatarUrl}"
  data-voice-enabled="${voiceEnabled}"
  data-welcome-message="${welcomeMessage}"
  data-popular-questions="${popularQuestions}"
></script>
<link rel="stylesheet" href="${apiBase}/embed.css" />`;
  }, [creatorId, slug, apiBase, widgetColor, widgetPosition, widgetTitle, avatarUrl, voiceEnabled, welcomeMessage, popularQuestions]);

  // ✅ Prevent back navigation to profile page
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

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
          <p className="text-muted-foreground mt-1">
            Turn your AI into a 24/7 assistant your audience can DM, text, or chat with on your site
          </p>
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
                  <Input
                    value={standaloneLink || 'Set your public handle in Settings → Profile first'}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={() => standaloneLink && copyToClipboard(standaloneLink, 'link')}
                    disabled={!standaloneLink}
                  >
                    {copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                {!slug && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Go to <strong>Settings → Profile</strong> to set your public handle before sharing this link.
                  </p>
                )}
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