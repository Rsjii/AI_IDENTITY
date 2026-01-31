import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

type Msg = {
  id: string;
  createdAt: string;
  role: 'user' | 'assistant' | string;
  content: string;
};

export function CreatorConversationDetailPage() {
  const nav = useNavigate();
  const { sessionId } = useParams();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      if (!sessionId) return;
      setError('');
      setLoading(true);
      try {
        const res = await apiFetch<{ messages: Msg[] }>(`/api/creator/chats/${encodeURIComponent(sessionId)}`);
        setMessages(res.messages || []);
      } catch (e: any) {
        setError(e.message || 'Failed to load conversation');
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">Conversation</h1>
            <p className="text-text-secondary mt-1 text-sm">Session: {sessionId}</p>
          </div>
          <Button variant="outline" onClick={() => nav('/conversations')}>Back</Button>
        </div>

        {error ? (
          <div className="p-3 rounded border border-red-500/30 bg-red-500/10 text-red-200 text-sm">{error}</div>
        ) : null}

        <Card className="bg-bg-secondary border-border-default">
          <CardHeader>
            <CardTitle className="text-lg">Messages</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-text-secondary text-sm">Loading...</div>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className="p-3 rounded-lg bg-bg-tertiary">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-text-primary uppercase">{m.role}</div>
                      <div className="text-xs text-text-tertiary">{new Date(m.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="text-sm text-text-secondary whitespace-pre-wrap mt-2">{m.content}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}