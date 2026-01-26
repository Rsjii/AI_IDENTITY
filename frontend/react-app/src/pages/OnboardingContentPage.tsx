import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { apiFetch, apiFetchForm } from '@/lib/api';
import { Upload, Youtube, FileText, X } from 'lucide-react';

export function OnboardingContentPage() {
  const nav = useNavigate();
  const [pasteText, setPasteText] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [youtubeTranscribing, setYoutubeTranscribing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

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
    setYoutubeTranscribing(true);
    try {
      await apiFetch('/api/content/youtube', { method: 'POST', body: JSON.stringify({ url: youtubeUrl, title: 'YouTube' }) });
      setYoutubeUrl('');
      await refresh();
    } finally {
      setLoading(false);
      setYoutubeTranscribing(false);
    }
  };

  const uploadFile = async (f: File) => {
    const fileId = `${f.name}-${Date.now()}`;
    setUploadProgress({ ...uploadProgress, [fileId]: 0 });
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      // Simulate progress (in real app, use XMLHttpRequest for actual progress)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => ({ ...prev, [fileId]: Math.min((prev[fileId] || 0) + 10, 90) }));
      }, 200);
      await apiFetchForm('/api/content/upload', { method: 'POST', body: fd });
      clearInterval(progressInterval);
      setUploadProgress((prev) => ({ ...prev, [fileId]: 100 }));
      await refresh();
      setTimeout(() => {
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[fileId];
          return next;
        });
      }, 1000);
    } catch (error) {
      setUploadProgress((prev) => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Upload your content</CardTitle>
            <CardDescription>Paste text, upload files, or add YouTube URLs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="text-sm font-medium mb-1">Paste text</div>
              <Textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Blog posts, emails, tweet threads..."
                className="min-h-[120px]"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">{pasteText.length} characters</span>
                <Button onClick={addPaste} disabled={loading || pasteText.trim().length < 10}>
                  Add
                </Button>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-1 flex items-center gap-2">
                <Youtube className="h-4 w-4" />
                YouTube URL
                <span className="text-xs text-muted-foreground font-normal">(Auto-transcribes)</span>
              </div>
              <div className="flex gap-2">
                <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/..." />
                <Button onClick={addYoutube} disabled={loading || !youtubeUrl.trim() || youtubeTranscribing}>
                  {youtubeTranscribing ? 'Transcribing...' : 'Add'}
                </Button>
              </div>
              {youtubeTranscribing && (
                <div className="mt-2 space-y-1">
                  <Progress value={50} className="h-2" />
                  <p className="text-xs text-muted-foreground">Extracting and transcribing video...</p>
                </div>
              )}
            </div>

            <div>
              <div className="text-sm font-medium mb-1 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Upload file (PDF, Word, Text, Audio)
              </div>
              <div
                ref={dropZoneRef}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                }`}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag & drop files here, or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-primary underline"
                  >
                    browse
                  </button>
                </p>
                <p className="text-xs text-muted-foreground">Supports: PDF, DOCX, TXT, MP3, WAV, M4A (up to 50MB)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
                  accept=".pdf,.doc,.docx,.txt,.mp3,.wav,.m4a"
                />
                {Object.keys(uploadProgress).length > 0 && (
                  <div className="mt-4 space-y-2">
                    {Object.entries(uploadProgress).map(([fileId, progress]) => (
                      <div key={fileId} className="space-y-1">
                        <Progress value={progress} className="h-2" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="text-sm font-medium mb-2">Your sources ({items.length})</div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No sources added yet</p>
                ) : (
                  items.map((x) => (
                    <div key={x.id} className="text-sm border rounded-md p-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{x.title || x.type}</div>
                        <div className="text-xs text-muted-foreground">{x.type}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await apiFetch(`/api/content/${x.id}`, { method: 'DELETE' });
                          await refresh();
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Button className="w-full" onClick={() => nav('/onboarding/plan')}>Continue</Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}