import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ThumbsUp, ThumbsDown, Send, Loader2 } from 'lucide-react';

type Msg = { 
  role: 'user' | 'assistant'; 
  content: string;
  timestamp?: Date;
  id?: string;
};

function getOrCreateVisitorId(): string {
  const k = 'selflyx_visitor_id';
  const existing = localStorage.getItem(k);
  if (existing) return existing;
  const v = `v_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  localStorage.setItem(k, v);
  return v;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function shouldShowTimestamp(current: Date, previous?: Date): boolean {
  if (!previous) return true;
  const diffMins = (current.getTime() - previous.getTime()) / 60000;
  return diffMins >= 1; // Show if 1+ minutes apart
}

export function PublicChatPage() {
  const { slug = '' } = useParams();
  const visitorId = useMemo(() => getOrCreateVisitorId(), []);
  const [creator, setCreator] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [text, setText] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/public/creator/${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => setCreator(d.creator))
      .catch(() => setCreator(null));
  }, [slug]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, typing]);

  const send = async () => {
    const m = text.trim();
    if (!m) return;
    setText('');
    const userMsg: Msg = { 
      role: 'user', 
      content: m,
      timestamp: new Date(),
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    };
    setMsgs((x) => [...x, userMsg]);
    setTyping(true);

    try {
      const r = await fetch('/api/public/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, message: m, visitorId, sessionId: sessionId || undefined }),
      });
      const d = await r.json();
      setSessionId(d.sessionId || sessionId);
      const aiMsg: Msg = { 
        role: 'assistant', 
        content: d.reply || '...',
        timestamp: new Date(),
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      };
      setMsgs((x) => [...x, aiMsg]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg: Msg = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        id: `msg_error_${Date.now()}`
      };
      setMsgs((x) => [...x, errorMsg]);
    } finally {
      setTyping(false);
    }
  };

  const handleFeedback = async (messageId: string, feedback: 'positive' | 'negative') => {
    if (feedbackSent.has(messageId)) return;
    
    setFeedbackSent(prev => new Set(prev).add(messageId));
    
    // Send feedback to backend
    try {
      await fetch('/api/public/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messageId, 
          feedback, 
          sessionId,
          visitorId 
        }),
      });
    } catch (error) {
      console.error('Feedback error:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="theme-light min-h-screen bg-bg-primary flex flex-col">
      {/* Header */}
      <div className="bg-bg-secondary border-b border-border-default px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          {creator?.avatarUrl && (
            <img 
              src={creator.avatarUrl} 
              alt={creator.displayName} 
              className="w-10 h-10 rounded-full"
            />
          )}
          <div className="flex-1">
            <div className="font-semibold text-text-primary">{creator?.displayName || slug}</div>
            <div className="text-sm text-text-secondary">
              {creator?.meta?.expertise || 'AI Assistant'} • 
              <span className="ml-1 flex items-center gap-1">
                <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                Responds in ~2s
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="max-w-4xl mx-auto space-y-4">
          {msgs.length === 0 && (
            <div className="text-center py-12">
              <div className="text-2xl font-bold text-text-primary mb-2">
                Hi! I'm {creator?.displayName || slug}'s AI clone
              </div>
              <div className="text-text-secondary">
                Ask me anything about {creator?.meta?.topics || 'my expertise'}!
              </div>
            </div>
          )}

          {msgs.map((m, i) => {
            const prevMsg = i > 0 ? msgs[i - 1] : undefined;
            const showTimestamp = shouldShowTimestamp(
              m.timestamp || new Date(),
              prevMsg?.timestamp
            );
            const isUser = m.role === 'user';

            return (
              <div key={m.id || i} className={`group flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="h-8 w-8 rounded-full bg-accent-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-xs font-semibold text-accent-primary">AI</span>
                  </div>
                )}

                <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%] md:max-w-[65%]`}>
                  <div
                    className={`rounded-xl px-4 py-3 shadow-sm ${
                      isUser
                        ? 'bg-bg-tertiary text-text-primary rounded-tr-sm'
                        : 'bg-accent-primary/10 border border-accent-primary/20 text-text-primary rounded-tl-sm'
                    }`}
                    style={{ borderRadius: '12px' }}
                  >
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          em: ({ children }) => <em className="italic">{children}</em>,
                          code: ({ children, className }) => {
                            const isInline = !className?.includes('language-');
                            return isInline ? (
                              <code className="bg-bg-tertiary px-1.5 py-0.5 rounded text-sm font-mono">
                                {children}
                              </code>
                            ) : (
                              <pre className="bg-bg-tertiary p-3 rounded-lg overflow-x-auto my-2">
                                <code className="text-sm font-mono">{children}</code>
                              </pre>
                            );
                          },
                          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="text-sm">{children}</li>,
                          a: ({ href, children }) => (
                            <a 
                              href={href} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-accent-primary hover:underline"
                            >
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  </div>

                  {/* Timestamp and Feedback */}
                  <div className={`flex items-center gap-2 mt-1 ${isUser ? 'flex-row-reverse' : ''}`}>
                    {m.timestamp && showTimestamp && (
                      <span className="text-xs text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatTimeAgo(m.timestamp)}
                      </span>
                    )}
                    {!isUser && m.id && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleFeedback(m.id!, 'positive')}
                          disabled={feedbackSent.has(m.id!)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            feedbackSent.has(m.id!)
                              ? 'bg-success/20 text-success cursor-not-allowed'
                              : 'bg-bg-tertiary hover:bg-bg-elevated text-text-secondary hover:text-success'
                          }`}
                          title="Helpful"
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleFeedback(m.id!, 'negative')}
                          disabled={feedbackSent.has(m.id!)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            feedbackSent.has(m.id!)
                              ? 'bg-error/20 text-error cursor-not-allowed'
                              : 'bg-bg-tertiary hover:bg-bg-elevated text-text-secondary hover:text-error'
                          }`}
                          title="Not helpful"
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isUser && (
                  <div className="h-8 w-8 rounded-full bg-accent-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-xs font-semibold text-accent-primary">You</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing Indicator */}
          {typing && (
            <div className="flex gap-3 justify-start">
              <div className="h-8 w-8 rounded-full bg-accent-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-accent-primary">AI</span>
              </div>
              <div className="bg-accent-primary/10 border border-accent-primary/20 rounded-xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="text-text-secondary text-sm">AI is typing</span>
                  <div className="flex gap-1 ml-2">
                    <span className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-bg-secondary border-t border-border-default px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              rows={1}
              className="flex-1 resize-none rounded-lg border border-border-default bg-bg-primary px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              onClick={send}
              disabled={!text.trim() || typing}
              className="px-6 py-3 bg-accent-gradient hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center gap-2 font-medium"
            >
              {typing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-text-tertiary mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
