import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChatBubble } from '@/components/ChatBubble';
import { TypingIndicator } from '@/components/TypingIndicator';
import { PaymentPrompt } from '@/components/PaymentPrompt';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Mic } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string; timestamp: Date };

function getOrCreateVisitorId(): string {
  const k = 'selflyx_visitor_id';
  const existing = localStorage.getItem(k);
  if (existing) return existing;
  const v = `v_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  localStorage.setItem(k, v);
  return v;
}

export function PublicChatPage() {
  const { slug = '' } = useParams();
  const visitorId = useMemo(() => getOrCreateVisitorId(), []);
  const [creator, setCreator] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [text, setText] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [requiresPayment, setRequiresPayment] = useState(false);
  const [paymentOptions, setPaymentOptions] = useState<any>(null);

  const FREE_MESSAGE_LIMIT = 3;

  useEffect(() => {
    fetch(`/api/public/creator/${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        setCreator(d.creator);
        // Show welcome message
        if (d.creator) {
          setMsgs([
            {
              role: 'assistant',
              content: d.creator.welcomeMessage || `Hey! I'm ${d.creator.displayName || 'an AI'}. Ask me anything!`,
              timestamp: new Date(),
            },
          ]);
        }
      })
      .catch(() => setCreator(null));
  }, [slug]);

  const sendMessage = async (messageText: string) => {
    const m = messageText.trim();
    if (!m) return;
    setText('');
    setMsgs((x) => [...x, { role: 'user', content: m, timestamp: new Date() }]);
    setTyping(true);
    setMessageCount((c) => c + 1);
    setRequiresPayment(false); // Reset payment state

    try {
      const r = await fetch('/api/public/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, message: m, visitorId, sessionId: sessionId || undefined }),
      });
      const d = await r.json();
      setSessionId(d.sessionId || sessionId);

      if (d.requiresPayment) {
        setRequiresPayment(true);
        setPaymentOptions(d.paymentOptions);
        setMsgs((x) => [
          ...x,
          {
            role: 'assistant',
            content: d.previewReply || 'This response requires payment to view.',
            timestamp: new Date(),
          },
        ]);
      } else {
        setMsgs((x) => [...x, { role: 'assistant', content: d.reply || '...', timestamp: new Date() }]);
      }
    } catch (error) {
      setMsgs((x) => [
        ...x,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.', timestamp: new Date() },
      ]);
    } finally {
      setTyping(false);
    }
  };

  const send = () => sendMessage(text.trim());

  const popularQuestions = creator?.popularQuestions || [
    'What can you help me with?',
    'Tell me about yourself',
    'How do I get started?',
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {creator?.avatarUrl && (
            <img src={creator.avatarUrl} alt={creator.displayName} className="h-10 w-10 rounded-full" />
          )}
          <div className="flex-1">
            <div className="font-semibold">{creator?.displayName || slug}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500"></span>
              Online
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-2">
          {msgs.map((m, i) => (
            <ChatBubble
              key={i}
              message={m.content}
              role={m.role}
              timestamp={m.timestamp}
              avatarUrl={m.role === 'assistant' ? creator?.avatarUrl : undefined}
            />
          ))}

          {typing && <TypingIndicator />}

          {messageCount === 0 && popularQuestions.length > 0 && (
            <div className="space-y-2 mt-4">
              <div className="text-sm text-muted-foreground">Popular questions:</div>
              <div className="flex flex-wrap gap-2">
                {popularQuestions.map((q: string, i: number) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    onClick={() => sendMessage(q)}
                    className="rounded-full"
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {requiresPayment && creator?.id && sessionId && paymentOptions && (
            <PaymentPrompt
              creatorId={creator.id}
              sessionId={sessionId}
              paymentOptions={paymentOptions}
              onSuccess={() => {
                setRequiresPayment(false);
                setPaymentOptions(null);
                // Optionally resend the last message to get full reply
                // For now, just unlock - user can ask again
              }}
              onCancel={() => {
                setRequiresPayment(false);
                setPaymentOptions(null);
              }}
            />
          )}

          {messageCount >= FREE_MESSAGE_LIMIT && !requiresPayment && (
            <div className="text-xs text-muted-foreground text-center py-2">
              You've used {messageCount} free messages. Upgrade for unlimited access.
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-card p-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Type your message..."
            className="flex-1"
            disabled={typing}
          />
          <Button onClick={send} disabled={!text.trim() || typing} size="icon">
            <Send className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" disabled>
            <Mic className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
