import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, ThumbsDown, ThumbsUp, RefreshCw } from 'lucide-react';
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

  const onMirror = async () => {
    setLoading(true);
    setError('');
    setReply('');
    setMirrorRunId('');
    try {
      const result = await apiFetch<any>('/api/identity/mirror', {
        method: 'POST',
        body: JSON.stringify({ context, incomingMessage }),
      });

      setDecision(result?.decision || '');
      setDecisionReason(result?.decisionReason || '');
      setReply(result?.reply || '');
      setMirrorRunId(result?.mirrorRunId || '');
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

            <Button className="w-full" onClick={onMirror} disabled={loading || !incomingMessage.trim()}>
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

        <Card className="glass">
          <CardHeader>
            <CardTitle>Reply</CardTitle>
            <CardDescription>
              {decision
                ? `Decision: ${decision}${decisionReason ? ` — ${decisionReason}` : ''}`
                : 'Your mirror reply will appear here.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea className="min-h-[160px]" value={reply} readOnly />

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => trust('confirm_yes')} disabled={!mirrorRunId || trustLoading}>
                <ThumbsUp className="h-4 w-4 mr-2" /> This is me
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