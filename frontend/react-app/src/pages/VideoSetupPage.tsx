import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { apiFetchForm } from '@/lib/api';

export function VideoSetupPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setMessage('');
    const form = new FormData();
    form.append('video', file);
    try {
    await apiFetchForm('/api/video/upload', {
      method: 'POST',
      body: form,
    });
      setMessage('Video uploaded and avatar created.');
      setFile(null);
    } catch (err: any) {
      setMessage(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        <h1 className="text-3xl font-bold">Video Avatar Setup</h1>
        <p className="text-text-secondary">Upload a short video to create a talking avatar.</p>
        <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <Button onClick={upload} disabled={!file || uploading}>
          {uploading ? 'Uploading…' : 'Upload Video'}
        </Button>
        {message && <div className="text-sm text-text-secondary">{message}</div>}
      </div>
    </Layout>
  );
}

