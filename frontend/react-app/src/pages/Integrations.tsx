import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';

export function IntegrationsPage() {
  const { state } = useAuth();
  const user = state.status === 'authenticated' ? state.user : null;

  const [color, setColor] = useState('#2563eb');
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left'>('bottom-right');
  const [title, setTitle] = useState('Selflyx');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [snippet, setSnippet] = useState('');
  const [loading, setLoading] = useState(false);

  const creatorId = useMemo(() => {
    // Prefer tokenized id; fallback to raw id (works, but less ideal)
    return (user as any)?.publicId || user?.id || '';
  }, [user]);

  useEffect(() => {
    if (!creatorId) return;

    setLoading(true);
    // Use fetch directly since endpoint returns text/plain (not JSON)
    fetch(`/api/widget/code/${encodeURIComponent(creatorId)}`, { method: 'GET' })
      .then((r) => r.text())
      .then((code) => setSnippet(code))
      .catch(() => setSnippet(''))
      .finally(() => setLoading(false));
  }, [creatorId]);

  const customizedSnippet = useMemo(() => {
    if (!snippet) return '';

    const attrs = [
      `data-color="${color}"`,
      `data-position="${position}"`,
      `data-title="${title.replace(/"/g, '&quot;')}"`,
      avatarUrl ? `data-avatar-url="${avatarUrl.replace(/"/g, '&quot;')}"` : '',
    ].filter(Boolean).join(' ');

    // add attrs to the <script ...> tag
    return snippet.replace(
      /<script\s+([^>]+)\s*><\/script>/,
      `<script $1 ${attrs}></script>`
    );
  }, [snippet, color, position, title, avatarUrl]);

  const copy = async () => {
    await navigator.clipboard.writeText(customizedSnippet);
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground mt-1">Connect platforms + generate website widget embed code.</p>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Website Embed Widget (Phase 1)</CardTitle>
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
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Embed code</div>
              <textarea
                className="w-full border rounded-md px-3 py-2 bg-background min-h-[140px] font-mono text-xs"
                readOnly
                value={loading ? 'Loading…' : (customizedSnippet || 'Failed to load snippet')}
              />
              <div className="flex gap-2 mt-2">
                <Button onClick={copy} disabled={!customizedSnippet}>Copy</Button>
                <Button variant="outline" onClick={() => window.open('/embed.js', '_blank')}>Open embed.js</Button>
                <Button variant="outline" onClick={() => window.open('/embed.css', '_blank')}>Open embed.css</Button>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Tip: Use your production backend domain in production (widget uses that domain for API calls).
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Instagram DM (Week 2)</CardTitle>
            <CardDescription>Actual integration pending (Meta app + webhook + OAuth).</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled>Connect Instagram (Coming soon)</Button>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>WhatsApp (Week 3)</CardTitle>
            <CardDescription>Actual integration pending (Twilio webhook + sending messages).</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled>Connect WhatsApp (Coming soon)</Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

