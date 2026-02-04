import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { Search, MessageCircle } from 'lucide-react';

type FilterType = 'all' | 'paid' | 'free' | 'favorites';
type GroupKey = 'Today' | 'Yesterday' | 'Last 7 days' | 'Older';

type Conversation = {
  sessionId: string;
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  creatorAvatar: string | null;
  lastMessage: string;
  lastMessageAt: string;
  messageCount: number;
  paymentTier: string;
  paymentAmount: number;
  isPaid: boolean;
  isFavorite: boolean;
  isArchived: boolean;
  sessionTitle: string | null;
  createdAt: string;
};

function getGroupKey(iso: string): GroupKey {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfThatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.floor((startOfToday - startOfThatDay) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 6) return 'Last 7 days';
  return 'Older';
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function MyChatsPage() {
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const searchRef = useRef<HTMLInputElement | null>(null);

  const grouped = useMemo(() => {
    const map: Record<GroupKey, Conversation[]> = {
      Today: [],
      Yesterday: [],
      'Last 7 days': [],
      Older: [],
    };

    conversations
      .filter((c) => !c.isArchived)
      .forEach((c) => {
        map[getGroupKey(c.lastMessageAt || c.createdAt)].push(c);
      });

    return map;
  }, [conversations]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('filter', filter);
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', '100');
      params.set('offset', '0');

      const res = await apiFetch<{ success: boolean; conversations: Conversation[] }>(
        `/api/user/conversations?${params.toString()}`
      );

      if (res?.success) setConversations(res.conversations || []);
      else setConversations([]);
    } catch (e: any) {
      showToast(e?.message || 'Failed to load chats', 'error');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter, search]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === 'k';
      if (!(e.metaKey || e.ctrlKey) || !isK) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const openConversation = (c: Conversation) => {
    const creatorSlug = c.creatorHandle || c.creatorId;
    navigate(`/chat/${creatorSlug}?sessionId=${encodeURIComponent(c.sessionId)}`);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              My Chats
            </h1>
            <p className="text-text-secondary mt-1">All your conversations across creators.</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/explore')}>
            Explore AIs
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
            <Input
              ref={searchRef}
              placeholder="Search chats (Cmd/Ctrl+K)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <select
            className="border rounded-md px-3 py-2 bg-background"
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
          >
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="free">Free</option>
            <option value="favorites">Favorites</option>
          </select>
        </div>

        {loading ? (
          <div className="text-text-secondary">Loading…</div>
        ) : conversations.length === 0 ? (
          <div className="rounded-xl border border-border-default bg-bg-secondary p-8 text-center">
            <div className="text-lg font-semibold text-text-primary">No conversations yet</div>
            <div className="text-text-secondary mt-1">Start chatting with an AI to see your history here.</div>
            <Button className="mt-4" onClick={() => navigate('/explore')}>
              Explore AIs
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {(Object.keys(grouped) as GroupKey[]).map((k) => {
              const items = grouped[k];
              if (!items.length) return null;

              return (
                <div key={k} className="space-y-3">
                  <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">{k}</div>

                  <div className="space-y-2">
                    {items.map((c) => (
                      <button
                        key={c.sessionId}
                        onClick={() => openConversation(c)}
                        className="w-full text-left rounded-xl border border-border-default bg-bg-secondary hover:bg-bg-elevated transition-colors p-4 flex items-center gap-3"
                      >
                        {c.creatorAvatar ? (
                          <img src={c.creatorAvatar} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-accent-primary/20 flex items-center justify-center">
                            <span className="text-sm font-semibold text-accent-primary">
                              {(c.creatorName || 'C').slice(0, 1).toUpperCase()}
                            </span>
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold text-text-primary truncate">
                              {c.creatorName}
                            </div>
                            <div className="text-xs text-text-tertiary flex-shrink-0">
                              {formatTimeAgo(c.lastMessageAt || c.createdAt)}
                            </div>
                          </div>

                          <div className="text-sm text-text-secondary truncate">
                            {c.lastMessage || 'No messages yet'}
                          </div>

                          <div className="text-xs text-text-tertiary mt-1">
                            {c.messageCount || 0} messages • {c.isPaid ? `Paid $${(c.paymentAmount / 100).toFixed(2)}` : 'Free'}
                          </div>
                        </div>

                        <div className="text-xs text-accent-primary flex-shrink-0">Continue →</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}