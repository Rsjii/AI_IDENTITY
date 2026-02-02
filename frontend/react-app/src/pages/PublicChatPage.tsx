import { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ThumbsUp, ThumbsDown, Send, Loader2, X, Copy, Check, RotateCcw, Lock, Star, MessageCircle, Zap, Menu } from 'lucide-react';
import { PaymentPrompt } from '@/components/PaymentPrompt';
import { ConversationSidebar } from '@/components/ConversationSidebar';
import { MessageLimitWarning } from '@/components/MessageLimitWarning';
import { FLAGS } from '@/lib/flags';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/lib/toast';
import { apiFetch } from '@/lib/api';

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
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;
}

function getOrCreateVisitorId(): string {
  const k = 'selflyx_visitor_id';
  const existingCookie = getCookie(k);
  const existingLocal = localStorage.getItem(k);
  const existing = existingCookie || existingLocal;
  if (existing) {
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
  return diffMins >= 1;
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
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [paymentData, setPaymentData] = useState<{
    creatorId: string;
    sessionId: string;
    paymentOptions: { tiers: { amount: number; label: string }[]; defaultAmount?: number };
  } | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Conversation sidebar state
  const [showSidebar, setShowSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Message limit state
  const [messageLimit, setMessageLimit] = useState<{
    canSendMessage: boolean;
    isUnlimited: boolean;
    requiresPayment: boolean;
    remainingFreeMessages: number;
    freeMessageLimit: number;
    messagesUsed: number;
    suggestedTiers: Array<{ amount: number; label: string }>;
    creatorId?: string;
    paymentOptions?: {
      tiers: Array<{ amount: number; label: string }>;
      defaultAmount?: number;
    };
  } | null>(null);

  // Fetch creator info
  useEffect(() => {
    fetch(`/api/public/creator/${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => setCreator(d.creator))
      .catch(() => setCreator(null));
  }, [slug]);

  // Load previous session history if available and user is logged in
  useEffect(() => {
    if (!sessionKey || !isAuthed) return;

    const cookieSessionId = getCookie(sessionKey);
    const savedSessionId = cookieSessionId || localStorage.getItem(sessionKey);
    const savedTs = Number(localStorage.getItem(sessionTsKey) || '0');

    if (!cookieSessionId && savedSessionId) {
      const isFresh = savedTs > 0 && Date.now() - savedTs < THIRTY_DAYS_MS;
      if (!isFresh) {
        localStorage.removeItem(sessionKey);
        localStorage.removeItem(sessionTsKey);
        return;
      }
      setCookie(sessionKey, savedSessionId, THIRTY_DAYS_SECONDS);
    }

    if (!savedSessionId) return;

    fetch(`/api/public/history?sessionId=${encodeURIComponent(savedSessionId)}&visitorId=${encodeURIComponent(visitorId)}`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.success) return;
        setSessionId(d.sessionId || savedSessionId);
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
  }, [sessionKey, sessionTsKey, visitorId, isAuthed]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, typing]);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Check message limit when session changes
  useEffect(() => {
    const checkMessageLimit = async () => {
      if (!sessionId || !isAuthed) return;

      try {
        const res = await apiFetch(`/api/user/conversations/${sessionId}/message-limit`);
        if (res.success) {
          setMessageLimit(res);
        }
      } catch (error) {
        console.error('Failed to check message limit:', error);
      }
    };

    checkMessageLimit();
  }, [sessionId, isAuthed, msgs.length]);

  const handleLogin = () => {
    nav(`/auth?reason=unauthorized&next=${encodeURIComponent(`/chat/${slug}`)}`);
  };

  const openPaymentModalFromLimit = () => {
    if (!creator?.id || !sessionId) return;

    const tiers =
      messageLimit?.paymentOptions?.tiers ||
      messageLimit?.suggestedTiers ||
      [];

    const defaultAmount =
      messageLimit?.paymentOptions?.defaultAmount ||
      creator?.priceConfig?.defaultTierCents ||
      tiers?.[0]?.amount;

    setPaymentData({
      creatorId: creator.id,
      sessionId,
      paymentOptions: {
        tiers,
        defaultAmount,
      },
    });
    setShowPaymentModal(true);
  };

  const send = async () => {
    if (!isAuthed) {
      setShowLoginModal(true);
      return;
    }

    // Check message limit before sending
    if (messageLimit && messageLimit.requiresPayment && !messageLimit.canSendMessage) {
      openPaymentModalFromLimit();
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
        credentials: 'include',
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

      if (FLAGS.payPerChat && d.requiresPayment) {
        setTyping(false);
        const previewMsg: Msg = {
          role: 'assistant',
          content: d.previewReply || 'This answer requires payment to unlock the full response.',
          timestamp: new Date(),
          id: `msg_preview_${Date.now()}`,
          mirrorRunId: d.mirrorRunId,
        };
        setMsgs((x) => [...x, previewMsg]);

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

    if (pendingMessage) {
      const messageToSend = pendingMessage;
      setPendingMessage('');
      setText('');

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
            credentials: 'include',
            body: JSON.stringify({ slug, message: messageToSend, visitorId, sessionId: sessionId || undefined, voiceEnabled }),
          });
          const d = await r.json();
          setSessionId(d.sessionId || sessionId);

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

    const msg = msgs.find(m => m.id === messageId);
    const mirrorRunId = msg?.mirrorRunId;

    try {
      await fetch('/api/public/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messageId,
          feedback,
          sessionId,
          visitorId,
          mirrorRunId: mirrorRunId || undefined,
        }),
      });
      showToast(feedback === 'positive' ? 'Thanks for your feedback!' : 'Feedback received', 'success');
    } catch (error) {
      console.error('Feedback error:', error);
    }
  };

  const copyMessage = (content: string, messageId: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    showToast('Message copied!', 'success');
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const regenerateResponse = async (messageIndex: number) => {
    if (messageIndex === 0) return;

    const userMsg = msgs[messageIndex - 1];
    if (!userMsg || userMsg.role !== 'user') return;

    const messagesToKeep = msgs.slice(0, messageIndex);
    setMsgs(messagesToKeep);
    setTyping(true);

    try {
      const r = await fetch('/api/public/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug, message: userMsg.content, visitorId, sessionId, voiceEnabled }),
      });
      const d = await r.json();

      const aiMsg: Msg = {
        role: 'assistant',
        content: d.reply || '...',
        timestamp: new Date(),
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        mirrorRunId: d.mirrorRunId,
        audioUrl: d.audioUrl || null,
      };
      setMsgs((x) => [...x, aiMsg]);
      showToast('Response regenerated', 'success');
    } catch (error) {
      console.error('Regenerate error:', error);
      showToast('Failed to regenerate response', 'error');
    } finally {
      setTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handlePopularQuestionClick = (question: string) => {
    if (!isAuthed) {
      setShowLoginModal(true);
      return;
    }
    setText(question);
    setTimeout(() => send(), 100);
  };

  // LOGGED OUT USER - Preview Mode
  if (!isAuthed) {
    return (
      <div className="theme-light min-h-screen bg-bg-primary flex flex-col">
        {/* Header */}
        <div className="bg-bg-secondary border-b border-border-default px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/" className="text-lg font-bold">SELFLYX</Link>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/auth?next=${encodeURIComponent(`/chat/${slug}`)}`}
                className="px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                Login
              </Link>
              <Link
                to={`/auth?next=${encodeURIComponent(`/chat/${slug}`)}`}
                className="px-4 py-2 text-sm font-medium bg-accent-gradient text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                Sign Up - It's Free!
              </Link>
            </div>
          </div>
        </div>

        {/* Creator Profile Preview */}
        <div className="flex-1 overflow-y-auto px-4 py-8">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Creator Card */}
            <div className="bg-bg-secondary border border-border-default rounded-xl p-6 shadow-sm">
              <div className="flex items-start gap-4">
                {creator?.avatarUrl && (
                  <img
                    src={creator.avatarUrl}
                    alt={creator.displayName}
                    className="w-16 h-16 rounded-full border-2 border-accent-primary/20"
                  />
                )}
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-text-primary mb-1">
                    {creator?.displayName || slug}
                  </h1>
                  <p className="text-text-secondary mb-3">
                    {creator?.meta?.expertise || 'AI Assistant'}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-text-secondary">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <span>{creator?.rating || '4.8'}/5</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="h-4 w-4" />
                      <span>{creator?.totalChats?.toLocaleString() || '0'} chats</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="h-4 w-4 text-green-500" />
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                        ~2s response
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Try Chatting Card */}
            <div className="bg-gradient-to-br from-accent-primary/10 to-accent-secondary/10 border border-accent-primary/20 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="h-5 w-5 text-accent-primary" />
                <h2 className="text-lg font-semibold text-text-primary">
                  Try chatting with {creator?.displayName || slug}'s AI clone
                </h2>
              </div>
              <p className="text-text-secondary mb-4">
                "{creator?.meta?.description || 'I help with various topics and can answer your questions!'}"
              </p>

              {creator?.popularQuestions && creator.popularQuestions.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-text-secondary mb-3">POPULAR QUESTIONS:</p>
                  <div className="grid gap-2">
                    {creator.popularQuestions.slice(0, 3).map((q: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setShowLoginModal(true)}
                        className="px-4 py-3 bg-bg-secondary hover:bg-bg-elevated border border-border-default rounded-lg text-left text-sm text-text-primary transition-all hover:shadow-md group"
                      >
                        <div className="flex items-center justify-between">
                          <span>{q}</span>
                          <Lock className="h-4 w-4 text-text-tertiary group-hover:text-accent-primary transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pricing (if enabled) */}
            {FLAGS.payPerChat && creator?.priceTiers && creator.priceTiers.length > 0 && (
              <div className="bg-bg-secondary border border-border-default rounded-xl p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-3">Pricing</h3>
                <div className="flex items-center gap-2 text-text-secondary">
                  <span>💳 Free: 3 messages</span>
                  <span>•</span>
                  <span>${(creator.priceTiers[0]?.amount / 100).toFixed(2)}: Unlimited session</span>
                </div>
              </div>
            )}

            {/* Login CTA */}
            <div className="bg-bg-secondary border border-border-default rounded-xl p-6">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Lock className="h-5 w-5 text-accent-primary" />
                <h3 className="text-lg font-semibold text-text-primary">Sign in to start chatting</h3>
              </div>
              <div className="relative mb-4">
                <textarea
                  placeholder="Type your message..."
                  disabled
                  className="w-full resize-none rounded-lg border border-border-default bg-bg-tertiary px-4 py-3 text-text-muted placeholder:text-text-muted opacity-60 cursor-not-allowed"
                  rows={2}
                />
              </div>
              <div className="flex items-center justify-center gap-3">
                <Link
                  to={`/auth?next=${encodeURIComponent(`/chat/${slug}`)}`}
                  className="flex-1 px-6 py-3 bg-accent-gradient text-white rounded-lg font-medium text-center hover:opacity-90 transition-opacity"
                >
                  Sign Up - It's Free!
                </Link>
                <Link
                  to={`/auth?next=${encodeURIComponent(`/chat/${slug}`)}`}
                  className="flex-1 px-6 py-3 bg-bg-tertiary border border-border-default text-text-primary rounded-lg font-medium text-center hover:bg-bg-elevated transition-colors"
                >
                  Login
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Login Modal */}
        {showLoginModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-bg-secondary rounded-xl p-6 max-w-md w-full relative">
              <button
                onClick={() => setShowLoginModal(false)}
                className="absolute top-4 right-4 text-text-secondary hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-xl font-bold text-text-primary mb-2">
                Sign in to chat with {creator?.displayName || slug}
              </h3>
              <p className="text-text-secondary mb-6">
                Create a free account to start chatting
              </p>
              <div className="space-y-3">
                <Link
                  to={`/auth?next=${encodeURIComponent(`/chat/${slug}`)}`}
                  className="block w-full px-6 py-3 bg-accent-gradient text-white rounded-lg font-medium text-center hover:opacity-90 transition-opacity"
                >
                  Continue with Email
                </Link>
                <Link
                  to={`/auth?next=${encodeURIComponent(`/chat/${slug}`)}`}
                  className="block w-full px-6 py-3 bg-bg-tertiary border border-border-default text-text-primary rounded-lg font-medium text-center hover:bg-bg-elevated transition-colors"
                >
                  Continue with Google
                </Link>
              </div>
              <p className="text-center text-xs text-text-tertiary mt-4">
                New here? <Link to="/auth" className="text-accent-primary hover:underline">Sign Up</Link>
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // LOGGED IN USER - Full Chat Experience
  return (
    <div className="theme-light min-h-screen bg-bg-primary flex">
      {/* Sidebar - Desktop */}
      {!isMobile && (
        <div className="w-80 flex-shrink-0">
          <ConversationSidebar currentSessionId={sessionId} />
        </div>
      )}

      {/* Sidebar - Mobile Drawer */}
      {isMobile && showSidebar && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowSidebar(false)}>
          <div
            className="w-80 h-full bg-bg-secondary"
            onClick={(e) => e.stopPropagation()}
          >
            <ConversationSidebar
              currentSessionId={sessionId}
              onClose={() => setShowSidebar(false)}
            />
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-bg-secondary border-b border-border-default px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            {/* Hamburger menu for mobile */}
            {isMobile && (
              <button
                onClick={() => setShowSidebar(true)}
                className="p-2 hover:bg-bg-elevated rounded-lg transition-colors"
              >
                <Menu className="h-5 w-5 text-text-primary" />
              </button>
            )}
          {creator?.avatarUrl && (
            <img
              src={creator.avatarUrl}
              alt={creator.displayName}
              className="w-10 h-10 rounded-full"
            />
          )}
          <div className="flex-1">
            <div className="font-semibold text-text-primary">{creator?.displayName || slug}</div>
            <div className="text-sm text-text-secondary flex items-center gap-2">
              {creator?.meta?.expertise || 'AI Assistant'}
              <span className="flex items-center gap-1">
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
                      onClick={() => handlePopularQuestionClick(q)}
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

                  {/* Timestamp and Actions */}
                  <div className={`flex items-center gap-2 mt-1 ${isUser ? 'flex-row-reverse' : ''}`}>
                    {m.timestamp && showTimestamp && (
                      <span className="text-xs text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatTimeAgo(m.timestamp)}
                      </span>
                    )}
                    {!isUser && m.id && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => copyMessage(m.content, m.id!)}
                          className="p-1.5 rounded-lg bg-bg-tertiary hover:bg-bg-elevated text-text-secondary hover:text-accent-primary transition-colors"
                          title="Copy message"
                        >
                          {copiedMessageId === m.id ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => regenerateResponse(i)}
                          className="p-1.5 rounded-lg bg-bg-tertiary hover:bg-bg-elevated text-text-secondary hover:text-accent-primary transition-colors"
                          title="Regenerate response"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
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

        {/* Message Limit Warning */}
        {messageLimit && !messageLimit.isUnlimited && messageLimit.requiresPayment && (
          <div className="px-4 pb-4">
            <div className="max-w-4xl mx-auto">
              <MessageLimitWarning
                remainingMessages={messageLimit.remainingFreeMessages}
                totalFreeMessages={messageLimit.freeMessageLimit}
                onUpgrade={openPaymentModalFromLimit}
                suggestedTiers={messageLimit.suggestedTiers}
                variant="modal"
              />
            </div>
          </div>
        )}

        {/* Inline warning for approaching limit */}
        {messageLimit && !messageLimit.isUnlimited && messageLimit.remainingFreeMessages > 0 && messageLimit.remainingFreeMessages <= 2 && (
          <div className="px-4">
            <div className="max-w-4xl mx-auto">
              <MessageLimitWarning
                remainingMessages={messageLimit.remainingFreeMessages}
                totalFreeMessages={messageLimit.freeMessageLimit}
                onUpgrade={openPaymentModalFromLimit}
                suggestedTiers={messageLimit.suggestedTiers}
                variant="inline"
              />
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
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
              placeholder="Type your message..."
              rows={1}
              disabled={typing}
              className="flex-1 resize-none rounded-lg border border-border-default bg-bg-primary px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent disabled:opacity-60"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              onClick={send}
              disabled={!text.trim() || typing}
              className="px-6 py-3 bg-accent-gradient hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center gap-2 font-medium min-h-[44px] min-w-[44px]"
            >
              {typing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span className="hidden md:inline">Send</span>
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
    </div>
  );
}
