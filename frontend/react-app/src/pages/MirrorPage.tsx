import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, ThumbsDown, ThumbsUp, RefreshCw, Zap } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type MirrorContext = 'linkedin_dm' | 'email' | 'sales' | 'intro' | 'support' | 'personal';

export function MirrorPage() {
  const [context, setContext] = useState<MirrorContext>('email');
  const [incomingMessage, setIncomingMessage] = useState('');
  const [reply, setReply] = useState('');
  const [mirrorRunId, setMirrorRunId] = useState<string>('');
  const [decision, setDecision] = useState<string>('');
  const [decisionReason, setDecisionReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [trustLoading, setTrustLoading] = useState(false);
  const [error, setError] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voices, setVoices] = useState<any[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');

  // Load voices once
  useEffect(() => {
    apiFetch<{ success: true; voices: any[] }>('/api/voice/list')
      .then(r => {
        setVoices(r.voices || []);
        if (!selectedVoiceId && r.voices?.[0]?.id) setSelectedVoiceId(r.voices[0].id);
      })
      .catch(() => {});
  }, []);

  const onMirror = async () => {
    setLoading(true);
    setError('');
    setReply('');
    setMirrorRunId('');
    setAudioUrl('');
    try {
      const result = voiceEnabled && selectedVoiceId
        ? await apiFetch<any>('/api/identity/mirror-voice', {
            method: 'POST',
            body: JSON.stringify({ context, incomingMessage, voiceId: selectedVoiceId }),
          })
        : await apiFetch<any>('/api/identity/mirror', {
            method: 'POST',
            body: JSON.stringify({ context, incomingMessage }),
          });

      // Handle decision - could be object {action, reason} or separate fields
      if (result?.decision) {
        if (typeof result.decision === 'object' && result.decision.action) {
          setDecision(result.decision.action);
          setDecisionReason(result.decision.reason || '');
        } else {
          setDecision(result.decision);
          setDecisionReason(result?.decisionReason || '');
        }
      } else {
        setDecision('');
        setDecisionReason('');
      }
      setReply(result?.reply || '');
      setMirrorRunId(result?.mirrorRunId || '');
      setAudioUrl(result?.audioUrl || '');
    } catch (err: any) {
      const code = err?.errorCode;
      if (code === 'LLM_AUTH_FAILED') {
        setError('LLM API key invalid. Backend .env me GROQ_API_KEY / OPENAI_API_KEY fix karke backend restart karo.');
      } else if (code === 'LLM_NOT_CONFIGURED') {
        setError('LLM not configured. Backend .env me GROQ_API_KEY / OPENAI_API_KEY set karo, then restart.');
      } else if (code === 'LLM_UPSTREAM_ERROR') {
        setError('LLM provider issue. 1 minute baad retry karo. (Backend logs check karna.)');
      } else {
        setError(err.message || 'Mirror failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const trust = async (event: 'confirm_yes' | 'confirm_no' | 'regenerate') => {
    if (!mirrorRunId) return;
    setTrustLoading(true);
    try {
      await apiFetch('/api/identity/trust/confirm', {
        method: 'POST',
        body: JSON.stringify({ mirrorRunId, event }),
      });
      if (event === 'regenerate') {
        await onMirror();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback.');
    } finally {
      setTrustLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mirror</h1>
          <p className="text-muted-foreground mt-1">Paste a message and generate a reply in your voice.</p>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Incoming message</CardTitle>
            <CardDescription>Choose context + paste message.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {(['email','linkedin_dm','sales','intro','support','personal'] as MirrorContext[]).map((c) => (
                <Button
                  key={c}
                  variant={context === c ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setContext(c)}
                  type="button"
                >
                  {c}
                </Button>
              ))}
            </div>

            <Textarea
              className="min-h-[180px]"
              value={incomingMessage}
              onChange={(e) => setIncomingMessage(e.target.value)}
              placeholder="Paste message here…"
            />

            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={voiceEnabled} onChange={(e) => setVoiceEnabled(e.target.checked)} />
                Voice reply
              </label>

              {voiceEnabled ? (
                <select
                  className="border rounded-md px-2 py-1 bg-background text-sm"
                  value={selectedVoiceId}
                  onChange={(e) => setSelectedVoiceId(e.target.value)}
                >
                  {voices.length === 0 ? (
                    <option value="">No voices available</option>
                  ) : (
                    voices.map(v => <option key={v.id} value={v.id}>{v.label || v.id}</option>)
                  )}
                </select>
              ) : null}
            </div>

            <Button className="w-full" onClick={onMirror} disabled={loading || !incomingMessage.trim() || (voiceEnabled && !selectedVoiceId)}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                'Generate reply'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Decision Preview */}
        {decision && (
          <Card className="glass border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Decision Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">I would:</span>
                <span className="text-lg font-bold text-primary">{decision.toUpperCase()}</span>
              </div>
              {decisionReason && (
                <p className="text-sm text-muted-foreground">Reason: {decisionReason}</p>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="glass">
          <CardHeader>
            <CardTitle>Suggested Reply</CardTitle>
            <CardDescription>
              {reply ? 'Review the reply below' : 'Your mirror reply will appear here.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea className="min-h-[160px]" value={reply} readOnly />

            {audioUrl ? (
              <div className="mt-3">
                <div className="text-sm font-medium mb-2">Voice Audio</div>
                <audio controls autoPlay src={audioUrl} className="w-full" />
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => trust('confirm_yes')} disabled={!mirrorRunId || trustLoading}>
                <ThumbsUp className="h-4 w-4 mr-2" /> Yes, this is me
              </Button>
              <Button variant="outline" onClick={() => trust('confirm_no')} disabled={!mirrorRunId || trustLoading}>
                <ThumbsDown className="h-4 w-4 mr-2" /> Not me
              </Button>
              <Button variant="outline" onClick={() => trust('regenerate')} disabled={!mirrorRunId || trustLoading}>
                <RefreshCw className="h-4 w-4 mr-2" /> Regenerate
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}