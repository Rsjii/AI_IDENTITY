import { useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { EmptyState } from '@/components/EmptyState';

type MirrorHistoryItem = {
  id: string;
  message: string;
  reply: string;
  durationMs: number;
  createdAt: number;
};

export function MirrorPage({
  embedded = false,
  suggestions = [],
}: {
  embedded?: boolean;
  suggestions?: string[];
} = {}) {
  const [incomingMessage, setIncomingMessage] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<MirrorHistoryItem[]>([]);

  const stats = useMemo(() => {
    const total = history.length;
    const avg = total ? Math.round(history.reduce((a, b) => a + b.durationMs, 0) / total) : 0;
    return { total, avg };
  }, [history]);

  const onMirror = async () => {
    if (!incomingMessage.trim()) {
      setError('Please enter a message to test.');
      return;
    }

    setLoading(true);
    setError('');
    setReply('');
    
    try {
      const t0 = performance.now();
      const result = await apiFetch<any>('/api/identity/mirror', {
        method: 'POST',
        body: JSON.stringify({ 
          context: 'web',
          incomingMessage 
        }),
      });
      const t1 = performance.now();

      setReply(result?.reply || 'No response generated.');
      setHistory((prev) => [
        {
          id: `test_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          message: incomingMessage,
          reply: result?.reply || 'No response generated.',
          durationMs: Math.round(t1 - t0),
          createdAt: Date.now(),
        },
        ...prev,
      ].slice(0, 50));
    } catch (err: any) {
      const code = err?.errorCode;
      if (code === 'LLM_AUTH_FAILED') {
        setError('LLM API key invalid. Please check backend configuration.');
      } else if (code === 'LLM_NOT_CONFIGURED') {
        setError('LLM not configured. Please set GROQ_API_KEY or OPENAI_API_KEY in backend.');
      } else if (code === 'LLM_UPSTREAM_ERROR') {
        setError('LLM provider issue. Please try again in a moment.');
      } else {
        setError(err.message || 'Failed to generate response.');
      }
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className={embedded ? 'space-y-6' : 'max-w-3xl mx-auto space-y-6'}>
      {!embedded && (
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Response Tester</h1>
          <p className="text-muted-foreground mt-1">
            Test how your AI clone responds to messages. This is a testing tool to preview AI responses.
          </p>
        </div>
      )}

      <Card className={embedded ? 'bg-bg-secondary border-border-default' : 'glass'}>
          <CardHeader>
            <CardTitle>Test Message</CardTitle>
            <CardDescription>Enter a message to see how your AI clone would respond</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.slice(0, 8).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="text-xs rounded-full border px-3 py-1 bg-card/60 hover:bg-card transition-colors"
                    onClick={() => setIncomingMessage(s)}
                    disabled={loading}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                className="min-h-[120px]"
                value={incomingMessage}
                onChange={(e) => setIncomingMessage(e.target.value)}
                placeholder="Type a message to test your AI's response..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !loading) {
                    e.preventDefault();
                    onMirror();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Press Ctrl+Enter (or Cmd+Enter on Mac) to send
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={onMirror}
                disabled={loading || !incomingMessage.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating response...
                  </>
                ) : (
                  'Generate Response'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIncomingMessage('');
                  setReply('');
                  setError('');
                }}
                disabled={loading}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {reply && (
          <Card className={embedded ? 'bg-bg-secondary border-border-default' : 'glass'}>
            <CardHeader>
              <CardTitle>AI Response</CardTitle>
              <CardDescription>Your AI clone's response to the test message</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p className="whitespace-pre-wrap text-foreground">{reply}</p>
              </div>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  navigator.clipboard.writeText(reply);
                }}
              >
                Copy Response
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className={embedded ? 'bg-bg-secondary border-border-default' : 'glass'}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Test History</CardTitle>
              <CardDescription>
                {stats.total} tests · avg {stats.avg}ms
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setHistory([])}
              disabled={history.length === 0}
            >
              <Trash2 className="h-4 w-4" />
              Clear History
            </Button>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <EmptyState
                title="No test chats yet"
                description="Start testing your AI by sending a message above. Test chats don't count toward your plan limits."
              />
            ) : (
              <div className="space-y-3">
                {history.map((h) => (
                  <div key={h.id} className="rounded-lg border bg-card/60 p-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="text-xs text-muted-foreground">
                        {new Date(h.createdAt).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">{h.durationMs}ms</div>
                    </div>
                    <div className="text-sm font-medium mb-1">You</div>
                    <div className="text-sm whitespace-pre-wrap mb-3">{h.message}</div>
                    <div className="text-sm font-medium mb-1">AI</div>
                    <div className="text-sm whitespace-pre-wrap">{h.reply}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );

  if (embedded) return content;

  return (
    <Layout>
      {content}
    </Layout>
  );
}
