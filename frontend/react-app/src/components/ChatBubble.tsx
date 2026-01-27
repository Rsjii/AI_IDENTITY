import ReactMarkdown from 'react-markdown';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

// Simple date formatter
const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return formatTime(date);
};

interface ChatBubbleProps {
  message: string;
  role: 'user' | 'assistant';
  timestamp?: Date;
  avatarUrl?: string;
  messageId?: string;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative') => void;
  feedbackSent?: boolean;
}

export function ChatBubble({ 
  message, 
  role, 
  timestamp, 
  avatarUrl,
  messageId,
  onFeedback,
  feedbackSent = false
}: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} mb-4 group`}>
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-accent-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
          {avatarUrl ? (
            <img src={avatarUrl} alt="AI" className="h-8 w-8 rounded-full" />
          ) : (
            <span className="text-xs font-semibold text-accent-primary">AI</span>
          )}
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
                p: ({ children }) => <p className="mb-2 last:mb-0 text-sm">{children}</p>,
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
                ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 text-sm">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 text-sm">{children}</ol>,
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
              {message}
            </ReactMarkdown>
          </div>
        </div>

        {/* Timestamp and Feedback */}
        <div className={`flex items-center gap-2 mt-1 ${isUser ? 'flex-row-reverse' : ''}`}>
          {timestamp && (
            <span className="text-xs text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity">
              {formatTimeAgo(timestamp)}
            </span>
          )}
          {!isUser && messageId && onFeedback && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onFeedback(messageId, 'positive')}
                disabled={feedbackSent}
                className={`p-1.5 rounded-lg transition-colors ${
                  feedbackSent
                    ? 'bg-success/20 text-success cursor-not-allowed'
                    : 'bg-bg-tertiary hover:bg-bg-elevated text-text-secondary hover:text-success'
                }`}
                title="Helpful"
              >
                <ThumbsUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => onFeedback(messageId, 'negative')}
                disabled={feedbackSent}
                className={`p-1.5 rounded-lg transition-colors ${
                  feedbackSent
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
}
