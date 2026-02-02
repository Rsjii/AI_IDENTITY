import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, Lock, MessageCircle, X, DollarSign } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';

interface Conversation {
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
}

interface ConversationSidebarProps {
  currentSessionId?: string;
  onConversationSelect?: (sessionId: string, creatorSlug: string) => void;
  onClose?: () => void;
  className?: string;
}

type FilterType = 'all' | 'paid' | 'free' | 'favorites';

export function ConversationSidebar({
  currentSessionId,
  onConversationSelect,
  onClose,
  className = '',
}: ConversationSidebarProps) {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const loadConversations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('filter', filter);
      if (search.trim()) {
        params.set('search', search.trim());
      }
      params.set('limit', '50');
      params.set('offset', '0');

      const res = await apiFetch<{ success: boolean; conversations: Conversation[] }>(
        `/api/user/conversations?${params.toString()}`
      );

      if (res.success) {
        setConversations(res.conversations || []);
      } else {
        setConversations([]);
      }
    } catch (error: any) {
      console.error('Failed to load conversations:', error);
      showToast('Failed to load conversations', 'error');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [filter, search]);

  const handleConversationClick = (conversation: Conversation) => {
    if (onConversationSelect) {
      onConversationSelect(conversation.sessionId, conversation.creatorHandle || conversation.creatorId);
    } else {
      navigate(`/chat/${conversation.creatorHandle || conversation.creatorId}`);
    }
  };

  const toggleFavorite = async (sessionId: string, next: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await apiFetch(`/api/user/conversations/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isFavorite: next }),
      });

      if (res?.success) {
        setConversations((prev) =>
          prev.map((c) => (c.sessionId === sessionId ? { ...c, isFavorite: next } : c))
        );
        showToast(next ? 'Added to favorites' : 'Removed from favorites', 'success');
      }
    } catch {
      showToast('Failed to update favorite', 'error');
    }
  };

  const formatTimeAgo = (dateString: string): string => {
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
  };

  const getTierBadgeClass = (tier: string, isPaid: boolean) => {
    if (!isPaid) return 'bg-gray-100 text-gray-600';
    if (tier === 'vip' || tier === 'premium') return 'bg-yellow-100 text-yellow-700';
    if (tier === 'pro') return 'bg-purple-100 text-purple-700';
    return 'bg-blue-100 text-blue-700';
  };

  const getTierIcon = (_tier: string, isPaid: boolean) => {
    if (!isPaid) return <Lock className="h-3 w-3" />;
    return <DollarSign className="h-3 w-3" />;
  };

  return (
    <div className={`flex flex-col h-full bg-bg-secondary border-r border-border-default ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-border-default">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Conversations
          </h2>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="md:hidden">
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 h-10"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mt-3">
          <Button
            variant={filter === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
            className="text-xs"
          >
            All
          </Button>
          <Button
            variant={filter === 'paid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('paid')}
            className="text-xs"
          >
            Paid
          </Button>
          <Button
            variant={filter === 'free' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('free')}
            className="text-xs"
          >
            Free
          </Button>
          <Button
            variant={filter === 'favorites' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('favorites')}
            className="text-xs flex items-center gap-1"
          >
            <Star className="h-3 w-3" />
            Favorites
          </Button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12 px-4">
            <MessageCircle className="h-12 w-12 text-text-tertiary mx-auto mb-3 opacity-50" />
            <p className="text-text-secondary text-sm">
              {search.trim() ? 'No conversations found' : 'No conversations yet'}
            </p>
            <p className="text-text-tertiary text-xs mt-1">
              {search.trim() ? 'Try a different search term' : 'Start chatting with a creator!'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-default">
            {conversations.map((conv) => (
              <button
                key={conv.sessionId}
                onClick={() => handleConversationClick(conv)}
                className={`w-full text-left p-4 hover:bg-bg-elevated transition-colors ${
                  currentSessionId === conv.sessionId ? 'bg-bg-elevated border-l-4 border-accent-primary' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Creator Avatar */}
                  <div className="flex-shrink-0">
                    {conv.creatorAvatar ? (
                      <img
                        src={conv.creatorAvatar}
                        alt={conv.creatorName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-accent-primary/20 flex items-center justify-center">
                        <span className="text-sm font-semibold text-accent-primary">
                          {conv.creatorName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Conversation Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-medium text-text-primary text-sm truncate">
                          {conv.creatorName}
                        </h3>
                        <button
                          type="button"
                          onClick={(e) => toggleFavorite(conv.sessionId, !conv.isFavorite, e)}
                          className="p-0.5 rounded hover:bg-bg-tertiary flex-shrink-0"
                          title={conv.isFavorite ? 'Unfavorite' : 'Favorite'}
                        >
                          <Star className={`h-3 w-3 ${conv.isFavorite ? 'text-yellow-500 fill-yellow-500' : 'text-text-tertiary'}`} />
                        </button>
                      </div>
                      <span className="text-xs text-text-tertiary flex-shrink-0">
                        {formatTimeAgo(conv.lastMessageAt)}
                      </span>
                    </div>

                    <p className="text-xs text-text-secondary line-clamp-2 mb-2">
                      {conv.lastMessage}
                    </p>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-tertiary flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {conv.messageCount}
                        </span>
                        {conv.isPaid && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${getTierBadgeClass(
                              conv.paymentTier,
                              conv.isPaid
                            )}`}
                          >
                            {getTierIcon(conv.paymentTier, conv.isPaid)}
                            {conv.isPaid ? `$${(conv.paymentAmount / 100).toFixed(0)}` : 'Free'}
                          </span>
                        )}
                      </div>
                      {!conv.isPaid && (
                        <span className="text-xs text-text-tertiary flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          Free
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border-default">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => navigate('/marketplace')}
        >
          + New Conversation
        </Button>
      </div>
    </div>
  );
}
