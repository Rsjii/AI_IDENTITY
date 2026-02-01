import { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ThumbsUp, ThumbsDown, Send, Loader2, X } from 'lucide-react';
import { PaymentPrompt } from '@/components/PaymentPrompt';
import { FLAGS } from '@/lib/flags';
import { useAuth } from '@/contexts/AuthContext';

type Msg = { 
  role: 'user' | 'assistant'; 
  content: string;
  timestamp?: Date;
  id?: string;
  mirrorRunId?: string;
  audioUrl?: string | null;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

function getCookie(name: string): string | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  // Keep it simple + predictable for Phase-1: JS-readable cookie, 30-day max-age, Lax.
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;
}

function getOrCreateVisitorId(): string {
  // Phase-1 spec: session stored in browser (cookie) and persists up to ~30 days.
  const k = 'selflyx_visitor_id';
  const existingCookie = getCookie(k);
  const existingLocal = localStorage.getItem(k);
  const existing = existingCookie || existingLocal;
  if (existing) {
    // Ensure cookie is set for Phase-1 spec compliance
    if (!existingCookie) setCookie(k, existing, THIRTY_DAYS_SECONDS);
    return existing;
  }
  const v = `v_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  localStorage.setItem(k, v);
  setCookie(k, v, THIRTY_DAYS_SECONDS);
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
  const nav = useNavigate();
  const { state } = useAuth();
  const isAuthed = state.status === 'authenticated';
  const visitorId = useMemo(() => getOrCreateVisitorId(), []);
  const sessionKey = useMemo(() => `selflyx_session_${slug}`, [slug]);
  const sessionTsKey = useMemo(() => `selflyx_session_ts_${slug}`, [slug]);
  const [creator, setCreator] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [text, setText] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<Set<string>>(new Set());
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [paymentData, setPaymentData] = useState<{
    creatorId: string;
    sessionId: string;
    paymentOptions: { tiers: { amount: number; label: string }[]; defaultAmount?: number };
  } | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/public/creator/${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        setCreator(d.creator);
        // Store creator ID for payment flow
        if (d.creator?.id) {
          // Creator object might not have id, but we'll get it from chat response
        }
      })
      .catch(() => setCreator(null));
  }, [slug]);

  // Load previous session history if available
  useEffect(() => {
    if (!sessionKey) return;

    // Prefer cookie (spec), fallback to localStorage (backward compatibility)
    const cookieSessionId = getCookie(sessionKey);
    const savedSessionId = cookieSessionId || localStorage.getItem(sessionKey);
    const savedTs = Number(localStorage.getItem(sessionTsKey) || '0');

    // Enforce "history persists for 30 days" behavior from spec:
    // - If we only have a stale localStorage entry, clear it and start fresh.
    if (!cookieSessionId && savedSessionId) {
      const isFresh = savedTs > 0 && Date.now() - savedTs < THIRTY_DAYS_MS;
      if (!isFresh) {
        localStorage.removeItem(sessionKey);
        localStorage.removeItem(sessionTsKey);
        return;
      }
      // Re-establish cookie for the remaining window (sliding, based on last activity).
      setCookie(sessionKey, savedSessionId, THIRTY_DAYS_SECONDS);
    }

    if (!savedSessionId) return;

    fetch(`/api/public/history?sessionId=${encodeURIComponent(savedSessionId)}&visitorId=${encodeURIComponent(visitorId)}`, {
      credentials: 'include', // ✅ required now
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.success) return;
        setSessionId(d.sessionId || savedSessionId);
        // Touch last-activity timestamp (sliding 30-day window)
        localStorage.setItem(sessionTsKey, String(Date.now()));
        const historyMsgs: Msg[] = (d.messages || []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.createdAt ? new Date(m.createdAt) : undefined,
        }));
        setMsgs(historyMsgs);
      })
      .catch(() => {});
  }, [sessionKey, sessionTsKey, visitorId]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, typing]);

  const send = async () => {
    if (!isAuthed) {
      nav(`/auth?reason=unauthorized&next=${encodeURIComponent(`/chat/${slug}`)}`, { replace: true });
      return;
    }

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
        credentials: 'include', // ✅ required now
        body: JSON.stringify({ slug, message: m, visitorId, sessionId: sessionId || undefined, voiceEnabled }),
      });
      const d = await r.json();
      const newSessionId = d.sessionId || sessionId;
      setSessionId(newSessionId);
      if (newSessionId && sessionKey) {
        localStorage.setItem(sessionKey, newSessionId);
        localStorage.setItem(sessionTsKey, String(Date.now()));
        setCookie(sessionKey, newSessionId, THIRTY_DAYS_SECONDS);
      }
      
      // Check if payment is required (only if pay-per-chat is enabled)
      if (FLAGS.payPerChat && d.requiresPayment) {
        setTyping(false);
        // Show preview message
        const previewMsg: Msg = {
          role: 'assistant',
          content: d.previewReply || 'This answer requires payment to unlock the full response.',
          timestamp: new Date(),
          id: `msg_preview_${Date.now()}`,
          mirrorRunId: d.mirrorRunId,
        };
        setMsgs((x) => [...x, previewMsg]);
        
        // Get creator ID from response
        const creatorId = d.creatorId || '';
        if (creatorId) {
          setPaymentData({
            creatorId,
            sessionId: d.sessionId,
            paymentOptions: d.paymentOptions,
          });
          setPendingMessage(m);
          setShowPaymentModal(true);
        }
        return;
      }
      
      // Normal reply
      const aiMsg: Msg = { 
        role: 'assistant', 
        content: d.reply || '...',
        timestamp: new Date(),
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        mirrorRunId: d.mirrorRunId,
        audioUrl: d.audioUrl || null,
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

  const handlePaymentSuccess = async (reply?: string) => {
    setShowPaymentModal(false);
    
    // ✅ Use the reply returned from payment confirmation if available
    if (reply) {
      const aiMsg: Msg = { 
        role: 'assistant', 
        content: reply,
        timestamp: new Date(),
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      };
      setMsgs((x) => [...x, aiMsg]);
      setPendingMessage('');
      setText('');
      return;
    }
    
    // Fallback: If no reply provided, re-send the pending message
    if (pendingMessage) {
      const messageToSend = pendingMessage;
      setPendingMessage('');
      setText('');
      
      // Small delay to ensure payment is processed
      setTimeout(async () => {
        const userMsg: Msg = { 
          role: 'user', 
          content: messageToSend,
          timestamp: new Date(),
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        };
        setMsgs((x) => [...x, userMsg]);
        setTyping(true);

        try {
          const r = await fetch('/api/public/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug, message: messageToSend, visitorId, sessionId: sessionId || undefined, voiceEnabled }),
          });
          const d = await r.json();
          setSessionId(d.sessionId || sessionId);
          
          // After payment, should get full reply
          const aiMsg: Msg = { 
            role: 'assistant', 
            content: d.reply || '...',
            timestamp: new Date(),
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            mirrorRunId: d.mirrorRunId,
            audioUrl: d.audioUrl || null,
          };
          setMsgs((x) => [...x, aiMsg]);
        } catch (error: any) {
          console.error('Chat error:', error);
          const { getUserFriendlyError } = await import('@/lib/errorMessages');
          const friendlyError = getUserFriendlyError(error);
          const errorMsg: Msg = {
            role: 'assistant',
            content: friendlyError,
            timestamp: new Date(),
            id: `msg_error_${Date.now()}`
          };
          setMsgs((x) => [...x, errorMsg]);
        } finally {
          setTyping(false);
        }
      }, 1000);
    }
  };

  const handleFeedback = async (messageId: string, feedback: 'positive' | 'negative') => {
    if (feedbackSent.has(messageId)) return;
    
    setFeedbackSent(prev => new Set(prev).add(messageId));
    
    // Find the message to get mirrorRunId
    const msg = msgs.find(m => m.id === messageId);
    const mirrorRunId = msg?.mirrorRunId;
    
    // Send feedback to backend
    try {
      await fetch('/api/public/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messageId, 
          feedback, 
          sessionId,
          visitorId,
          mirrorRunId: mirrorRunId || undefined,
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

      {!isAuthed && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3 text-sm">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div className="text-yellow-900">Login required to chat.</div>
            <Link
              className="px-3 py-2 rounded bg-black text-white"
              to={`/auth?reason=unauthorized&next=${encodeURIComponent(`/chat/${slug}`)}`}
            >
              Login
            </Link>
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 pb-24 md:pb-6"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="max-w-4xl mx-auto space-y-4">
          {msgs.length === 0 && (
            <div className="text-center py-12 animate-fade-in">
              <div className="mb-6">
                {creator?.avatarUrl && (
                  <img 
                    src={creator.avatarUrl} 
                    alt={creator.displayName} 
                    className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-accent-primary/20 shadow-lg"
                  />
                )}
              </div>
              <div className="text-3xl font-bold text-text-primary mb-3 bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
                Hi! I'm {creator?.displayName || slug}'s AI clone
              </div>
              <div className="text-text-secondary text-lg mb-6">
                Ask me anything about {creator?.meta?.topics || 'my expertise'}!
              </div>
              {creator?.popularQuestions && creator.popularQuestions.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
                  {creator.popularQuestions.slice(0, 4).map((q: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setText(q);
                        setTimeout(() => send(), 100);
                      }}
                      className="px-4 py-2 bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/30 rounded-full text-sm text-text-primary transition-all hover:scale-105 active:scale-95"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
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
                      {m.audioUrl && !isUser && (
                        <audio controls className="mt-2 w-full">
                          <source src={m.audioUrl} />
                        </audio>
                      )}
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
            <div className="flex gap-3 justify-start animate-fade-in">
              <div className="h-8 w-8 rounded-full bg-accent-primary/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                <span className="text-xs font-semibold text-accent-primary">AI</span>
              </div>
              <div className="bg-accent-primary/10 border border-accent-primary/20 rounded-xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-text-secondary text-sm font-medium">AI is thinking</span>
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Payment Modal - Only show if pay-per-chat is enabled */}
      {FLAGS.payPerChat && showPaymentModal && paymentData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-center">
          <div className="bg-bg-secondary w-full md:max-w-md md:rounded-lg rounded-t-2xl md:rounded-lg relative max-h-[92vh] md:max-h-[80vh] overflow-y-auto">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary h-11 w-11 inline-flex items-center justify-center rounded-md hover:bg-bg-tertiary"
            >
              <X className="h-5 w-5" />
            </button>
            <PaymentPrompt
              creatorId={paymentData.creatorId}
              sessionId={paymentData.sessionId}
              paymentOptions={paymentData.paymentOptions}
              onSuccess={handlePaymentSuccess}
              onCancel={() => setShowPaymentModal(false)}
            />
          </div>
        </div>
      )}

      {/* Input Area */}
      <div
        className="bg-bg-secondary border-t border-border-default px-4 py-4 sticky bottom-0"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        <div className="max-w-4xl mx-auto">
          {FLAGS.voice && (
            <div className="flex items-center justify-end mb-2">
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={voiceEnabled}
                  onChange={(e) => setVoiceEnabled(e.target.checked)}
                />
                Voice responses
              </label>
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isAuthed ? 'Type your message...' : 'Login to start chatting...'}
              rows={1}
              disabled={!isAuthed || typing}
              className="flex-1 resize-none rounded-lg border border-border-default bg-bg-primary px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent disabled:opacity-60"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              onClick={send}
              disabled={!isAuthed || !text.trim() || typing}
              className="px-6 py-3 bg-accent-gradient hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center gap-2 font-medium min-h-[44px] min-w-[44px]"
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
