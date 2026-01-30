import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetchForm } from '@/lib/api';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { Mic, Upload, SkipForward } from 'lucide-react';

export function VoiceSetupPage() {
  const [mode, setMode] = useState<'record' | 'upload'>('record');
  const [label, setLabel] = useState('Professional');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const handleUpload = async (audioData: Blob | File) => {
    setLoading(true);
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('audio', audioData, audioData instanceof File ? audioData.name : 'recording.webm');
      fd.append('label', label);

      const res = await apiFetchForm<any>('/api/voice/upload', { method: 'POST', body: fd });
      setMsg(`Voice uploaded successfully! ID: ${res?.voiceClone?.id || ''}`);
      setFile(null);
    } catch (e: any) {
      setMsg(`Upload failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRecorderUpload = async (blob: Blob) => {
    await handleUpload(blob);
  };

  const handleFileUpload = async () => {
    if (file) {
      await handleUpload(file);
    }
  };

  const handleSkip = () => {
    window.location.href = '/onboarding/plan';
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Voice Setup</h1>
          <p className="text-muted-foreground mt-1">
            Record or upload your voice to create a voice clone (optional)
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex gap-2">
          {['Quiz', 'Content', 'Voice', 'Plan', 'Deploy'].map((step, i) => (
            <div key={step} className={`h-2 flex-1 rounded ${i <= 2 ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2">
          <Button
            variant={mode === 'record' ? 'default' : 'outline'}
            onClick={() => setMode('record')}
            className="flex-1"
          >
            <Mic className="h-4 w-4 mr-2" />
            Record
          </Button>
          <Button
            variant={mode === 'upload' ? 'default' : 'outline'}
            onClick={() => setMode('upload')}
            className="flex-1"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload File
          </Button>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>
              {mode === 'record' ? 'Record Your Voice' : 'Upload Voice Sample'}
            </CardTitle>
            <CardDescription>
              {mode === 'record'
                ? 'Record up to 10 minutes of your voice. Speak naturally about your area of expertise.'
                : 'Upload an audio file (MP3, WAV, M4A) up to 10MB.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Label Input */}
            <div>
              <label className="text-sm font-medium mb-1 block">Voice Label</label>
              <input
                className="w-full border rounded-md px-3 py-2 bg-background"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Professional, Casual, Energetic"
              />
            </div>

            {mode === 'record' ? (
              /* Voice Recorder */
              <VoiceRecorder onUpload={handleRecorderUpload} onSkip={handleSkip} />
            ) : (
              /* File Upload */
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Audio File (MP3/WAV/M4A, max 10MB)</label>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full border rounded-md p-2"
                  />
                  {file && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </div>
                  )}
                </div>

                <Button className="w-full" onClick={handleFileUpload} disabled={!file || loading}>
                  {loading ? 'Uploading...' : 'Upload Voice Sample'}
                </Button>
              </div>
            )}

            {/* Status Message */}
            {msg && (
              <div className={`p-3 rounded-lg text-sm ${
                msg.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {msg}
              </div>
            )}

            {/* Tips */}
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="text-sm font-medium">Tips for best results:</div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Speak in a quiet environment</li>
                <li>- Use a consistent tone and pace</li>
                <li>- Record for at least 5 minutes</li>
                <li>- Avoid background noise</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Skip Button */}
        <Button variant="ghost" className="w-full" onClick={handleSkip}>
          <SkipForward className="h-4 w-4 mr-2" />
          Skip for now
        </Button>
      </div>
    </Layout>
  );
}



