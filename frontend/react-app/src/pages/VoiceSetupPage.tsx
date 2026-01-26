import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetchForm } from '@/lib/api';

export function VoiceSetupPage() {
  const [label, setLabel] = useState('Professional');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const onUpload = async () => {
    if (!file) return;
    setLoading(true);
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('audio', file);
      fd.append('label', label);

      const res = await apiFetchForm<any>('/api/voice/upload', { method: 'POST', body: fd });
      setMsg(`✅ Uploaded. Voice ID: ${res?.voiceClone?.id || ''}`);
      setFile(null);
    } catch (e: any) {
      setMsg(`❌ ${e?.message || 'Upload failed'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Voice Setup</h1>
          <p className="text-muted-foreground mt-1">Upload an audio sample to create your voice clone.</p>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Upload Voice Sample</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-1">Label</div>
              <input 
                className="w-full border rounded-md px-3 py-2 bg-background" 
                value={label} 
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Professional, Casual"
              />
            </div>

            <div>
              <div className="text-sm font-medium mb-1">Audio sample (mp3/wav/m4a, max 10MB)</div>
              <input 
                type="file" 
                accept="audio/*" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full"
              />
              {file ? <div className="text-xs text-muted-foreground mt-1">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</div> : null}
            </div>

            <Button className="w-full" onClick={onUpload} disabled={!file || loading}>
              {loading ? 'Uploading…' : 'Upload + Create Voice'}
            </Button>

            {msg ? <div className={`text-sm ${msg.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>{msg}</div> : null}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

