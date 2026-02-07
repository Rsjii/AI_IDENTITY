import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingGuard, useRedirectBack } from '@/hooks/useOnboardingGuard';
import { Loader2, Send, Sparkles, ArrowRight, CheckCircle2, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function OnboardingPreviewPage() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m your AI clone. Ask me anything to test how I respond!',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Redirect to dashboard if onboarding is already complete
  useOnboardingGuard();

  // ✅ After core onboarding (Step2), back should take user to dashboard
  useRedirectBack('/dashboard');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Call the identity mirror API
      const response = await apiFetch<{ reply: string }>('/api/identity/mirror', {
        method: 'POST',
        body: JSON.stringify({
          context: 'onboarding-preview',
          incomingMessage: input.trim(),
        }),
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.reply || 'Sorry, I couldn\'t generate a response. Please try again.',
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      showToast(error.message || 'Failed to send message', 'error');
      // Remove user message if failed
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleSetupNow = async () => {
    setNavigating(true);
    try {
      // Update onboarding step to 'complete'
      await apiFetch('/api/creator/onboarding/step', {
        method: 'POST',
        body: JSON.stringify({ step: 'complete' }),
      });

      await refresh();
      nav('/onboarding/complete', { replace: true });
    } catch (error: any) {
      showToast(error.message || 'Failed to continue', 'error');
    } finally {
      setNavigating(false);
    }
  };

  const handleGoToDashboard = async () => {
    setNavigating(true);
    try {
      // Mark onboarding as done and skip setup
      await apiFetch('/api/creator/onboarding/step', {
        method: 'POST',
        body: JSON.stringify({ step: 'done' }),
      });

      await refresh();
      nav('/dashboard', { replace: true });
    } catch (error: any) {
      showToast(error.message || 'Failed to continue', 'error');
    } finally {
      setNavigating(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center p-6">
      <div className="w-full max-w-4xl space-y-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-accent-primary" />
              Test Your AI Clone
            </CardTitle>
            <CardDescription>
              Your AI is ready! Test it out by asking questions. See how it responds based on your content.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress indicator */}
            <div className="flex gap-2">
              {['Start', 'Upload', 'Preview', 'Complete'].map((step, i) => (
                <div
                  key={step}
                  className={`h-2 flex-1 rounded transition-colors ${
                    i <= 2 ? 'bg-accent-primary' : 'bg-bg-tertiary'
                  }`}
                />
              ))}
            </div>

            {/* Chat Interface */}
            <div className="border border-border-default rounded-xl overflow-hidden bg-bg-secondary">
              {/* Messages */}
              <div className="h-[400px] overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.role === 'user'
                          ? 'bg-accent-primary text-white'
                          : 'bg-bg-tertiary text-text-primary border border-border-default'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-bg-tertiary text-text-primary border border-border-default rounded-lg p-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border-default p-4 bg-bg-primary">
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Ask your AI a question..."
                    className="flex-1 bg-bg-secondary border-border-default"
                    disabled={loading}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                    className="bg-accent-gradient hover:opacity-90 text-white"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Sample Questions */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-text-secondary">Try these sample questions:</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'What can you help me with?',
                  'Tell me about your expertise',
                  'How do you approach problem-solving?',
                  'What makes your advice unique?',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-left p-2 rounded-lg bg-bg-secondary hover:bg-bg-tertiary border border-border-default text-sm transition-colors"
                    disabled={loading}
                  >
                    <MessageSquare className="h-3 w-3 inline mr-2 text-accent-primary" />
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Info Box */}
            <div className="rounded-lg bg-accent-primary/10 border border-accent-primary/20 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-accent-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold text-sm">Your AI is working!</p>
                  <p className="text-xs text-text-secondary">
                    This is how visitors will interact with your AI. You can improve responses by adding more content anytime.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <Button
                onClick={handleSetupNow}
                disabled={navigating}
                className="bg-accent-gradient hover:opacity-90 text-white"
                size="lg"
              >
                {navigating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <>
                    Setup Monetization
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
              <Button
                onClick={handleGoToDashboard}
                disabled={navigating}
                variant="outline"
                size="lg"
              >
                Go to Dashboard
              </Button>
            </div>

            <p className="text-xs text-text-tertiary text-center">
              Step 3 of 4 - You can always change settings later
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
