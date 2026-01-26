import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch, apiFetchForm } from '@/lib/api';

export function OnboardingContentPage() {
  const nav = useNavigate();
  const [pasteText, setPasteText] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    const r = await apiFetch<{ items: any[] }>('/api/content/list');
    setItems(r.items || []);
  };

  useEffect(() => { refresh().catch(() => {}); }, []);

  const addPaste = async () => {
    setLoading(true);
    await apiFetch('/api/content/paste', { method: 'POST', body: JSON.stringify({ title: 'Paste', text: pasteText }) });
    setPasteText('');
    await refresh();
    setLoading(false);
  };

  const addYoutube = async () => {
    setLoading(true);
    await apiFetch('/api/content/youtube', { method: 'POST', body: JSON.stringify({ url: youtubeUrl, title: 'YouTube' }) });
    setYoutubeUrl('');
    await refresh();
    setLoading(false);
  };

  const uploadFile = async (f: File) => {
    setLoading(true);
    const fd = new FormData();
    fd.append('file', f);
    await apiFetchForm('/api/content/upload', { method: 'POST', body: fd });
    await refresh();
    setLoading(false);
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Upload your content</CardTitle>
            <CardDescription>Paste text, upload files, or add YouTube URLs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-1">Paste text</div>
              <Textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Blog posts, emails, tweet threads..." />
              <Button className="mt-2" onClick={addPaste} disabled={loading || pasteText.trim().length < 10}>Add</Button>
            </div>

            <div>
              <div className="text-sm font-medium mb-1">YouTube URL</div>
              <div className="flex gap-2">
                <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/..." />
                <Button onClick={addYoutube} disabled={loading || !youtubeUrl.trim()}>Add</Button>
              </div>
              <div className="text-xs text-muted-foreground mt-1">MVP: stores URL only. Transcription later.</div>
            </div>

            <div>
              <div className="text-sm font-medium mb-1">Upload file</div>
              <input type="file" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
            </div>

            <div className="pt-2">
              <div className="text-sm font-medium mb-2">Your sources</div>
              <div className="space-y-2">
                {items.map((x) => (
                  <div key={x.id} className="text-sm border rounded-md p-2">
                    {x.title || x.type} — {x.type}
                  </div>
                ))}
              </div>
            </div>

            <Button className="w-full" onClick={() => nav('/onboarding/plan')}>Continue</Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}