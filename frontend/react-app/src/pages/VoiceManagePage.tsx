import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

type Voice = {
  id: string;
  label: string;
  status: string;
  sampleAudioUrl?: string | null;
};

export function VoiceManagePage() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const r = await apiFetch<{ success: true; voices: Voice[] }>('/api/voice/list');
      setVoices(r.voices || []);
    } catch (e) {
      console.error('Failed to load voices:', e);
    }
  };

  useEffect(() => { load().catch(() => {}); }, []);

  const del = async (id: string) => {
    if (!confirm('Delete this voice clone?')) return;
    try {
      await apiFetch(`/api/voice/${id}`, { method: 'DELETE', body: JSON.stringify({}) });
      await load();
    } catch (e: any) {
      alert(`Failed to delete: ${e?.message || 'Unknown error'}`);
    }
  };

  const test = async (id: string) => {
    setLoading(true);
    setAudioUrl('');
    try {
      const r = await apiFetch<{ success: true; audioUrl: string }>('/api/voice/generate', {
        method: 'POST',
        body: JSON.stringify({ voiceId: id, text: 'Hi! This is a quick voice test from Selflyx.' }),
      });
      setAudioUrl(r.audioUrl);
    } catch (e: any) {
      alert(`Failed to generate: ${e?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Voice Management</h1>
          <p className="text-muted-foreground mt-1">Manage your voice clones.</p>
        </div>

        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Your Voice Clones</CardTitle>
              <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {voices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No voice clones yet. <a href="/voice/setup" className="text-primary underline">Create one</a>
              </div>
            ) : (
              voices.map(v => (
                <div key={v.id} className="border rounded-md p-3 space-y-2">
                  <div className="font-medium">{v.label || 'Unnamed'} <span className="text-xs text-muted-foreground">({v.status})</span></div>
                  {v.sampleAudioUrl ? (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Sample:</div>
                      <audio controls src={v.sampleAudioUrl} className="w-full" />
                    </div>
                  ) : null}

                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" onClick={() => test(v.id)} disabled={loading || v.status !== 'ready'}>
                      {loading ? 'Generating…' : 'Test Voice'}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => del(v.id)}>Delete</Button>
                  </div>
                </div>
              ))
            )}

            {audioUrl ? (
              <div className="border rounded-md p-3 bg-muted/50">
                <div className="text-sm font-medium mb-2">Generated Audio</div>
                <audio controls autoPlay src={audioUrl} className="w-full" />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}





