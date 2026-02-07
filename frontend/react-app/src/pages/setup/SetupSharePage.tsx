import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Check, Instagram, Twitter, Linkedin } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/contexts/AuthContext';

export function SetupSharePage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    markComplete();
  }, []);

  const markComplete = async () => {
    try {
      await apiFetch('/api/creator/setup/step', {
        method: 'POST',
        body: JSON.stringify({ step: 'share', completed: true }),
      });
    } catch (error) {
      console.error('Failed to mark complete', error);
    }
  };

  const chatLink = `${window.location.origin}/chat/${state.user?.handle || 'your-name'}`;
  const embedCode = `<script src="${window.location.origin}/widget.js"></script>`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast('Copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOnSocial = (platform: string) => {
    const text = `Chat with my AI! ${chatLink}`;
    const urls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(chatLink)}`,
      instagram: chatLink,
    };
    if (urls[platform]) {
      window.open(urls[platform], '_blank');
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-3xl gradient-text">Your AI is Live! 🎉</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Share your AI chat link:</h3>
              <div className="flex gap-2">
                <Input value={chatLink} readOnly className="font-mono" />
                <Button onClick={() => copyToClipboard(chatLink)} variant="outline">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Quick Share:</h3>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => shareOnSocial('instagram')}>
                  <Instagram className="h-5 w-5 mr-2" /> Instagram
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => shareOnSocial('twitter')}>
                  <Twitter className="h-5 w-5 mr-2" /> Twitter
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => shareOnSocial('linkedin')}>
                  <Linkedin className="h-5 w-5 mr-2" /> LinkedIn
                </Button>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Embed on Your Website:</h3>
              <div className="flex gap-2">
                <Input value={embedCode} readOnly className="font-mono text-sm" />
                <Button onClick={() => copyToClipboard(embedCode)} variant="outline">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20">
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-2">💡 Next Steps:</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Share link in your bio</li>
                  <li>Post about your AI on social</li>
                  <li>Add to your website/newsletter</li>
                </ol>
              </CardContent>
            </Card>

            <Button
              className="w-full bg-gradient-to-r from-accent-primary to-accent-secondary text-white py-6 text-lg"
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard →
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}