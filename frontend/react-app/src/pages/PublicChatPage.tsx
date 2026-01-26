import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

type Msg = { role: 'user' | 'assistant'; content: string };

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

  useEffect(() => {
    fetch(`/api/public/creator/${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => setCreator(d.creator))
      .catch(() => setCreator(null));
  }, [slug]);

  const send = async () => {
    const m = text.trim();
    if (!m) return;
    setText('');
    setMsgs((x) => [...x, { role: 'user', content: m }]);
    setTyping(true);

    const r = await fetch('/api/public/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, message: m, visitorId, sessionId: sessionId || undefined }),
    });
    const d = await r.json();
    setSessionId(d.sessionId || sessionId);
    setMsgs((x) => [...x, { role: 'assistant', content: d.reply || '...' }]);
    setTyping(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 space-y-3">
        <div className="text-xl font-bold">{creator?.displayName || slug}</div>

        <div className="border rounded-md p-3 space-y-2 min-h-[60vh]">
          {msgs.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <span className="inline-block rounded-md px-3 py-2 border">
                {m.content}
              </span>
            </div>
          ))}
          {typing ? <div className="text-sm text-muted-foreground">AI is typing…</div> : null}
        </div>

        <div className="flex gap-2">
          <input className="flex-1 border rounded-md px-3 py-2" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your message…" />
          <button className="border rounded-md px-4" onClick={send}>Send</button>
        </div>
      </div>
    </div>
  );
}