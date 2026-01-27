import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export function MirrorPage() {
  const [incomingMessage, setIncomingMessage] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onMirror = async () => {
    if (!incomingMessage.trim()) {
      setError('Please enter a message to test.');
      return;
    }

    setLoading(true);
    setError('');
    setReply('');
    
    try {
      const result = await apiFetch<any>('/api/identity/mirror', {
        method: 'POST',
        body: JSON.stringify({ 
          context: 'web',
          incomingMessage 
        }),
      });

      setReply(result?.reply || 'No response generated.');
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

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Response Tester</h1>
          <p className="text-muted-foreground mt-1">
            Test how your AI clone responds to messages. This is a testing tool to preview AI responses.
          </p>
        </div>

        <Card className="glass">
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

            <Button 
              className="w-full" 
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
          </CardContent>
        </Card>

        {reply && (
          <Card className="glass">
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
      </div>
    </Layout>
  );
}
