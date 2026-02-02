import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  ThumbsUp,
  ThumbsDown,
  Send,
  Loader2,
  X,
  Copy,
  Check,
  RotateCcw,
  Star,
  MessageCircle,
  Zap,
  Menu,
  Info,
  LogOut,
  Settings,
} from 'lucide-react';

import { PaymentPrompt } from '@/components/PaymentPrompt';
import { ConversationSidebar } from '@/components/ConversationSidebar';
import { MessageLimitWarning } from '@/components/MessageLimitWarning';
import { FLAGS } from '@/lib/flags';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/lib/toast';
import { apiFetch } from '@/lib/api';

type Creator = {
  id: string;
  slug: string;
  handle?: string;
  displayName?: string;
  avatarUrl?: string | null;
  bio?: string;
  expertise?: string;
  topics?: string;
  welcomeMessage?: string | null;
  popularQuestions?: string[];
  stats?: { totalChats: number; rating: number; totalRatings: number };
  priceConfig?: any;
  socialLinks?: any;
};

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  id?: string;
  mirrorRunId?: string;
  audioUrl?: string | null;
  isTeaser?: boolean;
  paywallStage?: 'teaser' | 'hard';
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

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function PublicChatPage() {
  const { slug = '' } = useParams();
  const { state, logout } = useAuth();
  const isAuthed = state.status === 'authenticated';

  const onLogout = async () => {
    try {
      await logout();
      showToast('Logged out', 'success');
    } catch {
      showToast('Logout failed', 'error');
    }
  };

  const visitorId = useMemo(() => getOrCreateVisitorId(), []);
  const sessionKey = useMemo(() => `selflyx_session_${slug}`, [slug]);
  const sessionTsKey = useMemo(() => `selflyx_session_ts_${slug}`, [slug]);

  const [creator, setCreator] = useState<Creator | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [text, setText] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);

  const [feedbackSent, setFeedbackSent] = useState<Set<string>>(new Set());
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState<{
    creatorId: string;
    sessionId: string;
    paymentOptions: { tiers: { amount: number; label: string }[]; defaultAmount?: number };
  } | null>(null);

  const [premiumExpiresAt, setPremiumExpiresAt] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Layout: left drawer + right info sheet on mobile
  const [showSidebar, setShowSidebar] = useState(false);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Logged-in message-limit endpoint (for sidebar + warning)
  const [messageLimit, setMessageLimit] = useState<any>(null);

  // Public message-limit (guest + authed) for premium countdown
  const [publicLimit, setPublicLimit] = useState<any>(null);
  const [messageIdToUnlock, setMessageIdToUnlock] = useState<string | null>(null);
  const [previewTextForModal, setPreviewTextForModal] = useState<string>('');

  // Fetch creator
  useEffect(() => {
    fetch(`/api/public/creator/${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => setCreator(d.creator || null))
      .catch(() => setCreator(null));
  }, [slug]);

  // Restore sessionId from cookie/localStorage (guest + authed)
  useEffect(() => {
    const cookieSessionId = getCookie(sessionKey);
    const savedSessionId = cookieSessionId || localStorage.getItem(sessionKey);
    const savedTs = Number(localStorage.getItem(sessionTsKey) || '0');

    if (savedSessionId) {
      const isFresh = savedTs > 0 && Date.now() - savedTs < THIRTY_DAYS_MS;
      if (!isFresh) {
        localStorage.removeItem(sessionKey);
        localStorage.removeItem(sessionTsKey);
        return;
      }
      if (!cookieSessionId) setCookie(sessionKey, savedSessionId, THIRTY_DAYS_SECONDS);
      setSessionId(savedSessionId);
    }
  }, [sessionKey, sessionTsKey]);

  // Load history (guest + authed)
  useEffect(() => {
    if (!sessionId) return;

    fetch(`/api/public/history?sessionId=${encodeURIComponent(sessionId)}&visitorId=${encodeURIComponent(visitorId)}`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.success) return;
        localStorage.setItem(sessionTsKey, String(Date.now()));
        const historyMsgs: Msg[] = (d.messages || []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.createdAt ? new Date(m.createdAt) : undefined,
          isTeaser: !!m.truncated, // NEW
        }));
        setMsgs(historyMsgs);
      })
      .catch(() => {});
  }, [sessionId, visitorId, sessionTsKey]);

  // After login: claim guest session so it appears in ConversationSidebar
  useEffect(() => {
    if (!isAuthed) return;
    if (!sessionId) return;

    apiFetch('/api/public/claim-session', {
      method: 'POST',
      body: JSON.stringify({ sessionId, visitorId }),
    }).catch(() => {});
  }, [isAuthed, sessionId, visitorId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, typing]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Logged-in message-limit refresh
  useEffect(() => {
    const checkLimit = async () => {
      if (!isAuthed) return;
      if (!sessionId) return;
      try {
        const res = await apiFetch(`/api/user/conversations/${sessionId}/message-limit`);
        if (res?.success) {
          setMessageLimit(res);
          if (res.premiumExpiresAt) setPremiumExpiresAt(res.premiumExpiresAt);
        }
      } catch {}
    };
    checkLimit();
  }, [isAuthed, sessionId, msgs.length]);

  // Public message-limit (guest + authed) for premium countdown
  useEffect(() => {
    const run = async () => {
      if (!sessionId) return;
      try {
        const res = await apiFetch(
          `/api/public/message-limit?sessionId=${encodeURIComponent(sessionId)}&visitorId=${encodeURIComponent(visitorId)}`
        );
        if (res?.success) {
          setPublicLimit(res);
          if (res.premiumExpiresAt) setPremiumExpiresAt(res.premiumExpiresAt);
        }
      } catch {}
    };
    run();
  }, [sessionId, visitorId, msgs.length]);

  const freeLimit = publicLimit?.freeMessageLimit ?? 3;
  const remainingFree = publicLimit?.remainingFreeMessages ?? Math.max(0, freeLimit - msgs.filter((m) => m.role === 'user').length);

  const openPaymentModal = (creatorId: string, sid: string, paymentOptions: any) => {
    setPaymentData({
      creatorId,
      sessionId: sid,
      paymentOptions,
    });
    setShowPaymentModal(true);
  };

  const send = async () => {
    const m = text.trim();
    if (!m || typing) return;

    setText('');
    const userMsg: Msg = {
      role: 'user',
      content: m,
      timestamp: new Date(),
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    };
    setMsgs((x) => [...x, userMsg]);
    setTyping(true);

    try {
      const r = await fetch('/api/public/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          slug,
          message: m,
          visitorId,
          sessionId: sessionId || undefined,
          voiceEnabled: false,
        }),
      });

      const d = await r.json();

      const newSessionId = d.sessionId || sessionId;
      if (newSessionId) {
        setSessionId(newSessionId);
        localStorage.setItem(sessionKey, newSessionId);
        localStorage.setItem(sessionTsKey, String(Date.now()));
        setCookie(sessionKey, newSessionId, THIRTY_DAYS_SECONDS);
      }

      if (FLAGS.payPerChat && d.requiresPayment) {
        setTyping(false);

        const stage = (d.paywallStage as 'teaser' | 'hard') || 'hard';

        if (stage === 'teaser' && d.previewReply) {
          setPreviewTextForModal(d.previewReply);
          setMessageIdToUnlock(d.teaserMessageId || null);

          const previewMsg: Msg = {
            role: 'assistant',
            content: d.previewReply,
            timestamp: new Date(),
            id: d.teaserMessageId || `msg_preview_${Date.now()}`, // IMPORTANT
            isTeaser: true,
            paywallStage: 'teaser',
          };
          setMsgs((x) => [...x, previewMsg]);
        } else {
          setPreviewTextForModal('');
          setMessageIdToUnlock(null);
          const lockedMsg: Msg = {
            role: 'assistant',
            content: 'This answer is locked. Unlock to continue and get 24h premium access.',
            timestamp: new Date(),
            id: `msg_locked_${Date.now()}`,
            isTeaser: true,
            paywallStage: 'hard',
          };
          setMsgs((x) => [...x, lockedMsg]);
        }

        if (d.creatorId && d.paymentOptions) {
          openPaymentModal(d.creatorId, newSessionId, d.paymentOptions);
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
      const errorMsg: Msg = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        id: `msg_error_${Date.now()}`,
      };
      setMsgs((x) => [...x, errorMsg]);
    } finally {
      setTyping(false);
    }
  };

  const handlePaymentSuccess = async (reply?: string, premiumExpiresAtFromApi?: string) => {
    setShowPaymentModal(false);
    if (premiumExpiresAtFromApi) setPremiumExpiresAt(premiumExpiresAtFromApi);

    if (reply) {
      if (messageIdToUnlock) {
        setMsgs((prev) =>
          prev.map((m) =>
            m.id === messageIdToUnlock
              ? { ...m, content: reply, isTeaser: false, paywallStage: undefined }
              : m
          )
        );
        setMessageIdToUnlock(null);
        setPreviewTextForModal('');
        showToast('Premium unlocked for 24h!', 'success');
        return;
      }

      // fallback: append
      setMsgs((x) => [...x, { role: 'assistant', content: reply, timestamp: new Date(), id: `msg_${Date.now()}` }]);
      showToast('Premium unlocked for 24h!', 'success');
      return;
    }

    showToast('Payment succeeded!', 'success');
  };

  const handleFeedback = async (messageId: string, feedback: 'positive' | 'negative') => {
    if (feedbackSent.has(messageId)) return;
    setFeedbackSent((prev) => new Set(prev).add(messageId));

    const msg = msgs.find((m) => m.id === messageId);
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
          mirrorRunId: msg?.mirrorRunId || undefined,
        }),
      });
      showToast(feedback === 'positive' ? 'Thanks for your feedback!' : 'Feedback received', 'success');
    } catch {}
  };

  const copyMessage = (content: string, messageId: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    showToast('Message copied!', 'success');
    setTimeout(() => setCopiedMessageId(null), 1500);
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
        body: JSON.stringify({ slug, message: userMsg.content, visitorId, sessionId }),
      });
      const d = await r.json();

      const aiMsg: Msg = {
        role: 'assistant',
        content: d.reply || '...',
        timestamp: new Date(),
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      };
      setMsgs((x) => [...x, aiMsg]);
      showToast('Response regenerated', 'success');
    } catch {
      showToast('Failed to regenerate response', 'error');
    } finally {
      setTyping(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const premiumRemainingMs =
    premiumExpiresAt && !Number.isNaN(new Date(premiumExpiresAt).getTime())
      ? new Date(premiumExpiresAt).getTime() - Date.now()
      : null;

  return (
    <div className="theme-light min-h-screen bg-bg-primary flex">
      {/* LEFT: Conversations (authed only) */}
      {!isMobile && (
        <div className="w-[280px] flex-shrink-0 border-r border-border-default bg-bg-secondary">
          {isAuthed ? (
            <ConversationSidebar currentSessionId={sessionId} />
          ) : (
            <div className="p-4">
              <div className="text-lg font-semibold text-text-primary mb-2">Menu</div>
              <p className="text-sm text-text-secondary mb-4">Login to see your conversations and save history.</p>
              <Link
                to={`/auth?next=${encodeURIComponent(`/chat/${slug}`)}`}
                className="inline-flex items-center justify-center w-full px-4 py-2 bg-accent-gradient text-white rounded-lg font-medium"
              >
                Login / Sign up
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Mobile: drawer left */}
      {isMobile && showSidebar && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowSidebar(false)}>
          <div className="w-80 h-full bg-bg-secondary" onClick={(e) => e.stopPropagation()}>
            {isAuthed ? (
              <ConversationSidebar currentSessionId={sessionId} onClose={() => setShowSidebar(false)} />
            ) : (
              <div className="p-4">
                <button onClick={() => setShowSidebar(false)} className="mb-4 text-text-secondary">
                  <X className="h-5 w-5" />
                </button>
                <div className="text-lg font-semibold text-text-primary mb-2">Login</div>
                <p className="text-sm text-text-secondary mb-4">Login to view conversation history.</p>
                <Link
                  to={`/auth?next=${encodeURIComponent(`/chat/${slug}`)}`}
                  className="inline-flex items-center justify-center w-full px-4 py-2 bg-accent-gradient text-white rounded-lg font-medium"
                >
                  Continue
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CENTER: chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with Logo + Creator + Actions */}
        <div className="bg-bg-secondary border-b border-border-default px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            {/* Logo (left) */}
            <Link to="/" className="font-bold text-text-primary tracking-tight mr-2">
              Selflyx<span className="text-accent-primary">.</span>
            </Link>

            {/* Mobile hamburger */}
            {isMobile && (
              <button onClick={() => setShowSidebar(true)} className="p-2 hover:bg-bg-elevated rounded-lg">
                <Menu className="h-5 w-5 text-text-primary" />
              </button>
            )}

            {/* Creator identity */}
            <div className="flex items-center gap-3 min-w-0">
              {creator?.avatarUrl && (
                <img src={creator.avatarUrl} alt={creator.displayName || slug} className="w-9 h-9 rounded-full" />
              )}
              <div className="min-w-0">
                <div className="text-xs text-text-tertiary">
                  <Link to="/marketplace" className="hover:underline">Marketplace</Link>
                  {' / '}
                  <span className="text-text-secondary">{creator?.displayName || slug}</span>
                </div>
                <div className="font-semibold text-text-primary truncate">
                  Chat with {creator?.displayName || slug}'s AI
                </div>
              </div>
            </div>

            {/* Right actions */}
            <div className="ml-auto flex items-center gap-2">
              {!isAuthed ? (
                <Link
                  to={`/auth?next=${encodeURIComponent(`/chat/${slug}`)}`}
                  className="px-3 py-2 text-sm font-medium bg-bg-tertiary border border-border-default rounded-lg hover:bg-bg-elevated"
                >
                  Login to Save
                </Link>
              ) : (
                <>
                  <Link
                    to="/settings"
                    className="p-2 hover:bg-bg-elevated rounded-lg"
                    title="Settings"
                  >
                    <Settings className="h-5 w-5 text-text-primary" />
                  </Link>
                  <button
                    onClick={onLogout}
                    className="px-3 py-2 text-sm font-medium bg-bg-tertiary border border-border-default rounded-lg hover:bg-bg-elevated inline-flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </>
              )}

              {isMobile && (
                <button onClick={() => setShowInfoSheet(true)} className="p-2 hover:bg-bg-elevated rounded-lg">
                  <Info className="h-5 w-5 text-text-primary" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Premium banner */}
        {premiumRemainingMs !== null && premiumRemainingMs > 0 && (
          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-b border-amber-200 px-4 py-2">
            <div className="max-w-5xl mx-auto text-sm text-amber-900 flex items-center justify-between">
              <span>
                <strong>⚡ Premium active</strong> — {formatDuration(premiumRemainingMs)} left
              </span>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="text-sm underline hover:opacity-80"
              >
                Extend
              </button>
            </div>
          </div>
        )}

        {/* Free counter banner (only when not premium) */}
        {(!premiumRemainingMs || premiumRemainingMs <= 0) && (
          <div className="bg-bg-primary border-b border-border-default px-4 py-2">
            <div className="max-w-5xl mx-auto flex items-center justify-between text-sm">
              <span className="text-text-secondary">
                {remainingFree > 0 ? (
                  <>
                    <strong>{remainingFree}/{freeLimit}</strong> free messages remaining
                  </>
                ) : (
                  <>
                    <strong>Free limit used.</strong> Next message may require payment.
                  </>
                )}
              </span>
              <Link to="/marketplace" className="text-accent-primary hover:underline">
                Browse creators
              </Link>
            </div>
          </div>
        )}

        {/* Messages */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-6 pb-28">
          <div className="max-w-5xl mx-auto space-y-4">
            {/* Welcome */}
            {msgs.length === 0 && (
              <div className="text-center py-10">
                <div className="text-2xl font-bold text-text-primary mb-2">
                  {creator?.welcomeMessage
                    ? 'Welcome'
                    : `Hi! I'm ${creator?.displayName || slug}'s AI`}
                </div>
                <div className="text-text-secondary mb-6">
                  {creator?.welcomeMessage ||
                    `You get ${freeLimit} free questions to try. Ask me anything!`}
                </div>

                {creator?.popularQuestions?.length ? (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {creator.popularQuestions.slice(0, 3).map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => setText(q)}
                        className="px-4 py-2 bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/30 rounded-full text-sm"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {msgs.map((m, i) => {
              const prevMsg = i > 0 ? msgs[i - 1] : undefined;
              const showTs = shouldShowTimestamp(m.timestamp || new Date(), prevMsg?.timestamp);
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
                      className={`relative rounded-xl px-4 py-3 shadow-sm ${
                        isUser
                          ? 'bg-bg-tertiary text-text-primary rounded-tr-sm'
                          : 'bg-accent-primary/10 border border-accent-primary/20 text-text-primary rounded-tl-sm'
                      }`}
                    >
                      <div className="relative">
                        <div
                          className={`prose prose-sm max-w-none dark:prose-invert ${m.isTeaser ? 'max-h-[220px] overflow-hidden' : ''}`}
                          style={
                            m.isTeaser
                              ? { maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)' }
                              : undefined
                          }
                        >
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>

                        {m.isTeaser && (
                          <>
                            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg-secondary to-transparent pointer-events-none" />
                            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2 px-3">
                              {!isAuthed && (
                                <Link
                                  to={`/auth?next=${encodeURIComponent(`/chat/${slug}`)}`}
                                  className="px-4 py-2 bg-bg-tertiary border border-border-default rounded-lg font-medium"
                                >
                                  Login (recommended)
                                </Link>
                              )}
                              <button
                                onClick={() => setShowPaymentModal(true)}
                                className="px-4 py-2 bg-accent-gradient text-white rounded-lg font-medium shadow"
                              >
                                Unlock full answer
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className={`flex items-center gap-2 mt-1 ${isUser ? 'flex-row-reverse' : ''}`}>
                      {m.timestamp && showTs && (
                        <span className="text-xs text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity">
                          {formatTimeAgo(m.timestamp)}
                        </span>
                      )}

                      {!isUser && m.id && !m.isTeaser && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => copyMessage(m.content, m.id!)}
                            className="p-1.5 rounded-lg bg-bg-tertiary hover:bg-bg-elevated"
                            title="Copy"
                          >
                            {copiedMessageId === m.id ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => regenerateResponse(i)}
                            className="p-1.5 rounded-lg bg-bg-tertiary hover:bg-bg-elevated"
                            title="Regenerate"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleFeedback(m.id!, 'positive')}
                            disabled={feedbackSent.has(m.id!)}
                            className="p-1.5 rounded-lg bg-bg-tertiary hover:bg-bg-elevated"
                            title="Helpful"
                          >
                            <ThumbsUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleFeedback(m.id!, 'negative')}
                            disabled={feedbackSent.has(m.id!)}
                            className="p-1.5 rounded-lg bg-bg-tertiary hover:bg-bg-elevated"
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

            {typing && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-full bg-accent-primary/20 flex items-center justify-center flex-shrink-0 mt-1 animate-pulse">
                  <span className="text-xs font-semibold text-accent-primary">AI</span>
                </div>
                <div className="bg-accent-primary/10 border border-accent-primary/20 rounded-xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-text-secondary text-sm font-medium">AI is typing</span>
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

          {/* Logged-in warning component (optional) */}
          {isAuthed && messageLimit && !messageLimit.isUnlimited && messageLimit.remainingFreeMessages <= 2 && messageLimit.remainingFreeMessages > 0 && (
            <div className="max-w-5xl mx-auto">
              <MessageLimitWarning
                remainingMessages={messageLimit.remainingFreeMessages}
                totalFreeMessages={messageLimit.freeMessageLimit}
                onUpgrade={() => setShowPaymentModal(true)}
                suggestedTiers={messageLimit.suggestedTiers}
                variant="inline"
              />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="bg-bg-secondary border-t border-border-default px-4 py-4 sticky bottom-0">
          <div className="max-w-5xl mx-auto flex gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type your message..."
              rows={1}
              disabled={typing}
              className="flex-1 resize-none rounded-lg border border-border-default bg-bg-primary px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary disabled:opacity-60"
              style={{ minHeight: '44px', maxHeight: '140px' }}
            />
            <button
              onClick={send}
              disabled={!text.trim() || typing}
              className="px-6 py-3 bg-accent-gradient hover:opacity-90 disabled:opacity-50 text-white rounded-lg font-medium min-h-[44px]"
            >
              {typing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-text-tertiary mt-2 text-center">Enter to send • Shift+Enter for new line</p>
        </div>
      </div>

      {/* RIGHT: Creator context panel (desktop) */}
      {!isMobile && (
        <div className="w-[320px] flex-shrink-0 border-l border-border-default bg-bg-secondary p-4">
          <div className="rounded-xl border border-border-default bg-bg-primary p-4">
            <div className="flex items-start gap-3">
              {creator?.avatarUrl ? (
                <img src={creator.avatarUrl} className="w-12 h-12 rounded-full" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-accent-primary/20 flex items-center justify-center">
                  <span className="font-semibold text-accent-primary">{(creator?.displayName || slug).slice(0, 1).toUpperCase()}</span>
                </div>
              )}
              <div className="min-w-0">
                <div className="font-semibold text-text-primary truncate">{creator?.displayName || slug}</div>
                <div className="text-sm text-text-secondary">{creator?.expertise || 'AI Assistant'}</div>
                <div className="flex items-center gap-3 text-xs text-text-tertiary mt-1">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                    {(creator?.stats?.rating || 0).toFixed(1)} ({creator?.stats?.totalRatings || 0})
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {(creator?.stats?.totalChats || 0).toLocaleString()} chats
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Zap className="h-3 w-3 text-green-500" />
                    ~2s
                  </span>
                </div>
              </div>
            </div>

            {creator?.bio ? <p className="text-sm text-text-secondary mt-3">{creator.bio}</p> : null}

            <div className="mt-4 border-t border-border-default pt-4">
              <div className="text-sm font-semibold text-text-primary mb-2">Pricing</div>

              <div className="text-sm text-text-secondary space-y-1">
                <div>🆓 First {freeLimit} questions free</div>
                <div className="text-xs text-text-tertiary">
                  ✨ Any payment unlocks <strong>24h unlimited</strong> access for this session
                </div>

                {Array.isArray(creator?.priceConfig?.payPerChatTiers) && creator.priceConfig.payPerChatTiers.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {creator.priceConfig.payPerChatTiers
                      .slice(0, 4)
                      .map((cents: number) => (
                        <div key={cents} className="flex items-center justify-between">
                          <span className="text-text-secondary">• Tier</span>
                          <span className="font-semibold text-text-primary">${(cents / 100).toFixed(0)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowPaymentModal(true)}
                className="mt-3 w-full px-4 py-2 bg-accent-gradient text-white rounded-lg font-medium"
              >
                View pricing / Upgrade
              </button>
            </div>

            {/* Session status box */}
            <div className="mt-4 border-t border-border-default pt-4">
              <div className="text-sm font-semibold text-text-primary mb-2">Your session</div>

              {premiumRemainingMs !== null && premiumRemainingMs > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-900 dark:text-amber-100">
                  <div className="font-semibold">⚡ Premium active</div>
                  <div className="text-xs mt-1">
                    Time left: <strong>{formatDuration(premiumRemainingMs)}</strong>
                  </div>
                  {premiumExpiresAt && (
                    <div className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                      Expires: {new Date(premiumExpiresAt).toLocaleString()}
                    </div>
                  )}
                  <button onClick={() => setShowPaymentModal(true)} className="mt-2 text-xs underline">
                    Extend access
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-border-default bg-bg-tertiary p-3 text-sm text-text-secondary">
                  Free remaining: <strong>{remainingFree}/{freeLimit}</strong>
                </div>
              )}
            </div>

            {/* Social links + trust badges */}
            <div className="mt-4 border-t border-border-default pt-4">
              <div className="text-sm font-semibold text-text-primary mb-2">Links</div>
              <div className="text-sm text-text-secondary space-y-1">
                {creator?.socialLinks?.twitter ? (
                  <a className="hover:underline block" href={creator.socialLinks.twitter} target="_blank" rel="noreferrer">
                    Twitter
                  </a>
                ) : null}
                {creator?.socialLinks?.instagram ? (
                  <a className="hover:underline block" href={creator.socialLinks.instagram} target="_blank" rel="noreferrer">
                    Instagram
                  </a>
                ) : null}
                {creator?.socialLinks?.youtube ? (
                  <a className="hover:underline block" href={creator.socialLinks.youtube} target="_blank" rel="noreferrer">
                    YouTube
                  </a>
                ) : null}
                {creator?.socialLinks?.website ? (
                  <a className="hover:underline block" href={creator.socialLinks.website} target="_blank" rel="noreferrer">
                    Website
                  </a>
                ) : null}
                {!creator?.socialLinks?.twitter &&
                  !creator?.socialLinks?.instagram &&
                  !creator?.socialLinks?.youtube &&
                  !creator?.socialLinks?.website && (
                    <div className="text-xs text-text-tertiary">No links provided.</div>
                  )}
              </div>

              <div className="mt-3 text-xs text-text-tertiary space-y-1">
                <div>🔒 Encrypted messages</div>
                <div>✅ Secure payments (Stripe)</div>
                <div>📩 Receipt + full answer via email</div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Link to="/marketplace" className="inline-flex items-center justify-center w-full px-4 py-2 bg-bg-tertiary border border-border-default rounded-lg hover:bg-bg-elevated">
              Browse more creators
            </Link>
          </div>
        </div>
      )}

      {/* Mobile: info bottom sheet */}
      {isMobile && showInfoSheet && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowInfoSheet(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-bg-secondary rounded-t-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-text-primary">Creator info</div>
              <button onClick={() => setShowInfoSheet(false)} className="p-2">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 text-sm text-text-secondary">
              <div><strong>{creator?.displayName || slug}</strong></div>
              <div className="mt-1">{creator?.expertise || 'AI Assistant'}</div>
              <div className="mt-3">🆓 3 free questions • ✨ Pay once = 24h unlimited</div>
            </div>
            <div className="mt-4">
              <button onClick={() => setShowPaymentModal(true)} className="w-full px-4 py-2 bg-accent-gradient text-white rounded-lg font-medium">
                View pricing / Upgrade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {FLAGS.payPerChat && showPaymentModal && (paymentData || (creator?.id && sessionId)) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-center">
          <div className="bg-bg-secondary w-full md:max-w-md md:rounded-lg rounded-t-2xl relative max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary h-11 w-11 inline-flex items-center justify-center rounded-md hover:bg-bg-tertiary"
            >
              <X className="h-5 w-5" />
            </button>

            <PaymentPrompt
              creatorId={paymentData?.creatorId || creator!.id}
              sessionId={paymentData?.sessionId || sessionId}
              paymentOptions={
                paymentData?.paymentOptions ||
                {
                  tiers: (creator?.priceConfig?.payPerChatTiers || [500, 1000, 2500]).map((a: number) => ({
                    amount: a,
                    label: `$${(a / 100).toFixed(2)}`,
                  })),
                  defaultAmount: creator?.priceConfig?.defaultTierCents || 500,
                }
              }
              previewText={previewTextForModal}
              messageIdToUnlock={messageIdToUnlock || undefined}
              creatorName={creator?.displayName}
              onSuccess={(reply?: string, premiumExpiresAtFromApi?: string) => handlePaymentSuccess(reply, premiumExpiresAtFromApi)}
              onCancel={() => setShowPaymentModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}