import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChatBubble } from '@/components/ChatBubble';
import { apiFetch, buildApiUrl } from '@/lib/api';

type Msg = {
  id: string;
  createdAt: string;
  role: 'user' | 'assistant' | string;
  content: string;
};

type ConversationData = {
  messages: Msg[];
  user?: {
    userId?: string;
    handle?: string;
    name?: string;
    profileImage?: string | null;
    visitorId?: string;
  } | null;
};

export function CreatorConversationDetailPage() {
  const nav = useNavigate();
  const { sessionId } = useParams();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationData, setConversationData] = useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      if (!sessionId) return;
      setError('');
      setLoading(true);
      try {
        const res = await apiFetch<ConversationData>(`/api/creator/chats/${encodeURIComponent(sessionId)}`);
        setConversationData(res);
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
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-text-primary">Conversation</h1>
            <p className="text-text-secondary mt-1 text-sm">Session: {sessionId}</p>
            
            {/* User Profile Info */}
            {conversationData?.user && (
              <div className="mt-4 flex items-center gap-3 p-3 bg-bg-secondary rounded-lg">
                {conversationData.user.profileImage ? (
                  <img 
                    src={conversationData.user.profileImage.startsWith('/uploads/') ? buildApiUrl(conversationData.user.profileImage) : conversationData.user.profileImage} 
                    className="w-10 h-10 rounded-full object-cover"
                    alt={conversationData.user.name || 'User'}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-accent-primary/20 flex items-center justify-center">
                    <span className="text-sm font-semibold text-accent-primary">
                      {(conversationData.user.name || conversationData.user.handle || 'U').slice(0, 1).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-semibold text-text-primary">
                    {conversationData.user.name || conversationData.user.handle || 'Guest User'}
                  </div>
                  {conversationData.user.handle && (
                    <div className="text-sm text-text-secondary">@{conversationData.user.handle}</div>
                  )}
                  {conversationData.user.visitorId && !conversationData.user.userId && (
                    <div className="text-xs text-text-tertiary">Guest (Visitor ID: {conversationData.user.visitorId.slice(0, 8)}...)</div>
                  )}
                </div>
                {/* Only show "View Profile" if user is logged in (has userId) - visitors don't have public profiles */}
                {conversationData.user.handle && conversationData.user.userId && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(`/@${conversationData.user!.handle}`, '_blank')}
                  >
                    View Profile
                  </Button>
                )}
              </div>
            )}
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
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {messages.map((m, i) => {
                  const isUser = m.role === 'user';
                  const prevMsg = i > 0 ? messages[i - 1] : undefined;
                  const showTs = prevMsg 
                    ? (new Date(m.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) / 60000 >= 1
                    : true;
                  
                  return (
                    <div key={m.id}>
                      <ChatBubble
                        message={m.content}
                        role={isUser ? 'user' : 'assistant'}
                        timestamp={new Date(m.createdAt)}
                        // No feedback for creator view
                      />
                      {showTs && (
                        <div className={`text-xs text-text-tertiary mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
                          {new Date(m.createdAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}