import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { EmptyState } from '@/components/EmptyState';

type ChatListItem = {
  sessionId: string;
  label: string;
  preview: string;
  lastMessageAt: string;
  messageCount: number;
  platform?: string | null;
  paymentAmount?: number | null;
  isPaid?: boolean;
  isSubscribed?: boolean;
};

export function CreatorConversationsPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setError('');
      setLoading(true);
      try {
        const res = await apiFetch<{ items: ChatListItem[] }>('/api/creator/chats?limit=50&offset=0');
        setItems(res.items || []);
      } catch (e: any) {
        setError(e.message || 'Failed to load conversations');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">Conversations</h1>
            <p className="text-text-secondary mt-1">All chats with visitors.</p>
          </div>
          <Button variant="outline" onClick={() => nav('/dashboard')}>Back</Button>
        </div>

        {error ? (
          <div className="p-3 rounded border border-red-500/30 bg-red-500/10 text-red-200 text-sm">{error}</div>
        ) : null}

        <Card className="bg-bg-secondary border-border-default">
          <CardHeader>
            <CardTitle className="text-lg">All Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-text-secondary text-sm">Loading...</div>
            ) : items.length === 0 ? (
              <EmptyState
                title="No conversations yet"
                description="Once visitors chat with your AI, they’ll appear here."
              />
            ) : (
              <div className="space-y-3">
                {items.map((c) => (
                  <button
                    key={c.sessionId}
                    className="w-full text-left p-3 bg-bg-tertiary rounded-lg hover:bg-bg-elevated transition-colors"
                    onClick={() => nav(`/conversations/${encodeURIComponent(c.sessionId)}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold text-text-primary flex items-center gap-2">
                        <span>{c.label}</span>
                        {c.isSubscribed ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300">
                            ⭐ Subscribed
                          </span>
                        ) : c.isPaid ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">
                            💳 Paid {c.paymentAmount ? `$${(Number(c.paymentAmount) / 100).toFixed(2)}` : ''}
                          </span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-bg-secondary border border-border-default text-text-tertiary">
                            🆓 Free
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-tertiary">
                        {new Date(c.lastMessageAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-sm text-text-secondary truncate mt-1">{c.preview}</div>
                    <div className="text-xs text-text-tertiary mt-2">
                      {c.messageCount} messages {c.platform ? `• ${c.platform}` : ''}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}