import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { Copy, Check, ExternalLink, ArrowRight, Loader2 } from 'lucide-react';
import { useOnboardingGuard, usePreventBack } from '@/hooks/useOnboardingGuard';
import { apiFetch } from '@/lib/api';

export function OnboardingDeployPage() {
  const navigate = useNavigate();
  const { state, refresh } = useAuth();
  const user: any = state.status === 'authenticated' ? state.user : null;

  const [copied, setCopied] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const slug = user?.publicSlug || user?.handle || '';
  const apiBase = window.location.origin;

  const standaloneLink = useMemo(() => (slug ? `${apiBase}/chat/${slug}` : ''), [slug, apiBase]);

  // ✅ Redirect to dashboard if onboarding is already complete
  useOnboardingGuard();

  // ✅ Prevent back navigation to profile page
  usePreventBack();

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

  const handleCompleteOnboarding = async () => {
    setCompleting(true);
    try {
      // Mark onboarding as complete
      await apiFetch('/api/creator/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      // Refresh auth to update onboardingCompleted flag
      await refresh();

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      // Still redirect to dashboard even if API fails
      navigate('/dashboard');
    } finally {
      setCompleting(false);
    }
  };

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

        {/* 🎯 YOUR CHAT LINK - PROMINENT DISPLAY */}
        {standaloneLink && (
          <Card className="glass bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Check className="h-6 w-6 text-green-500" />
                🎉 Your AI Clone is Ready!
              </CardTitle>
              <CardDescription className="text-base">
                Share this link with your audience - they can now chat with your AI instantly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Chat Link - Large & Copyable */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-green-700 dark:text-green-400">
                  Your Chat Link
                </label>
                <div className="flex gap-2">
                  <Input
                    value={standaloneLink}
                    readOnly
                    className="font-mono text-lg bg-white dark:bg-gray-900 border-2 border-green-500/30"
                  />
                  <Button
                    onClick={() => copyToClipboard(standaloneLink, 'main-link')}
                    size="lg"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {copied === 'main-link' ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => window.open(standaloneLink, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Test Chat
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  👆 This is your unique link - share it on social media, in your bio, or anywhere you want people to chat with your AI!
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 💡 Share It Instantly */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>💡 Share it instantly</CardTitle>
            <CardDescription>Copy these templates to share your AI on social media</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {shareTemplates.map((t) => (
                <Button
                  key={t.label}
                  variant="outline"
                  size="lg"
                  className="justify-start"
                  onClick={() => copyToClipboard(t.text, t.label)}
                >
                  <span className="mr-2 text-lg">{t.icon}</span>
                  <div className="text-left flex-1">
                    <div className="font-medium">{t.label}</div>
                    {copied === t.label && <div className="text-xs text-green-600">Copied!</div>}
                  </div>
                  {copied === t.label ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 📦 Need More? */}
        <Card className="glass bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
          <CardHeader>
            <CardTitle className="text-xl">📦 Need QR code, embed widget, or integrations?</CardTitle>
            <CardDescription className="text-base">
              Everything you need for deployment is available in the Integrations page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-blue-500" />
                QR code (view & download)
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-blue-500" />
                Website embed widget (full customization)
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-blue-500" />
                Social media templates (all platforms)
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-blue-500" />
                Platform integrations (Instagram, WhatsApp, etc.)
              </div>
            </div>
            <Button
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              onClick={() => navigate('/integrations')}
            >
              Go to Integrations
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

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
            <Button
              className="w-full bg-gradient-to-r from-primary to-primary/80"
              onClick={handleCompleteOnboarding}
              disabled={completing}
            >
              {completing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Completing...
                </>
              ) : (
                'Complete Setup & Go to Dashboard'
              )}
            </Button>
          </CardContent>
        </Card>

      </div>
    </Layout>
  );
}