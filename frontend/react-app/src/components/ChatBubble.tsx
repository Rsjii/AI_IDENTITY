// Simple date formatter (avoiding date-fns dependency for now)
const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

interface ChatBubbleProps {
  message: string;
  role: 'user' | 'assistant';
  timestamp?: Date;
  avatarUrl?: string;
}

export function ChatBubble({ message, role, timestamp, avatarUrl }: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="AI" className="h-8 w-8 rounded-full" />
          ) : (
            <span className="text-xs">AI</span>
          )}
        </div>
      )}

      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
        <div
          className={`rounded-2xl px-4 py-2 ${
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted text-foreground rounded-tl-sm'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message}</p>
        </div>
        {timestamp && (
          <span className="text-xs text-muted-foreground mt-1 px-1">
            {formatTime(timestamp)}
          </span>
        )}
      </div>

      {isUser && (
        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <span className="text-xs">You</span>
        </div>
      )}
    </div>
  );
}

