import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

interface VideoAvatar {
  id: string;
  label: string | null;
  sampleVideoUrl: string | null;
  status: string;
}

export function VideoManagePage() {
  const [items, setItems] = useState<VideoAvatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('Hello! This is a sample video response.');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await apiFetch<{ items: VideoAvatar[] }>('/api/video/list');
    setItems(res.items || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const test = async (avatarId: string) => {
    const res = await apiFetch<{ videoUrl: string }>('/api/video/generate', {
      method: 'POST',
      body: JSON.stringify({ avatarId, text }),
    });
    setVideoUrl(res.videoUrl);
  };

  const remove = async (id: string) => {
    await apiFetch(`/api/video/${id}`, { method: 'DELETE' });
    await load();
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <h1 className="text-3xl font-bold">Manage Video Avatars</h1>
        {loading ? (
          <div className="text-text-secondary">Loading...</div>
        ) : (
          <div className="space-y-4">
            <textarea
              className="w-full border rounded-md px-3 py-2 bg-background"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {items.map((item) => (
              <div key={item.id} className="p-4 border rounded-lg space-y-2">
                <div className="font-semibold">{item.label || 'Video Avatar'}</div>
                <div className="text-xs text-text-secondary">Status: {item.status}</div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => test(item.id)}>
                    Generate Sample
                  </Button>
                  <Button variant="destructive" onClick={() => remove(item.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            {items.length === 0 && <div className="text-sm text-text-secondary">No video avatars yet.</div>}
          </div>
        )}

        {videoUrl && (
          <div className="space-y-2">
            <div className="font-semibold">Generated Video</div>
            <video src={videoUrl} controls className="w-full rounded-md" />
          </div>
        )}
      </div>
    </Layout>
  );
}

