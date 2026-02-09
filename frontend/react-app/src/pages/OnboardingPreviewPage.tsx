import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingGuard, useRedirectBack } from '@/hooks/useOnboardingGuard';
import { Loader2, Send, Sparkles, ArrowRight, CheckCircle2, MessageSquare, AlertCircle, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function OnboardingPreviewPage() {
  const nav = useNavigate();
  const { refresh } = useAuth();

  const [trainingStatus, setTrainingStatus] = useState<'not_started' | 'training' | 'ready' | 'error'>('training');
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingMessage, setTrainingMessage] = useState('Preparing your AI…');
  const [estimatedSecondsRemaining, setEstimatedSecondsRemaining] = useState<number | null>(null);

  const isReady = trainingStatus === 'ready';

  // Calculate estimated time remaining based on progress
  const getEstimatedTime = (progress: number): string => {
    if (progress >= 100) return 'Almost done...';
    if (progress >= 90) return '~30 seconds';
    if (progress >= 75) return '~1 minute';
    if (progress >= 50) return '~2 minutes';
    if (progress >= 25) return '~3 minutes';
    return '~3-5 minutes';
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: isReady ? 'Your AI is ready. Ask me anything to test!' : 'Hi! I\'m setting up. One moment…',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Redirect to dashboard if onboarding is already complete
  useOnboardingGuard();

  // ✅ After core onboarding (Step2), back should take user to dashboard
  // ✅ Back from Step3 = SKIP optional steps forever
  useRedirectBack('/dashboard', { markOnboardingDone: true });

  // ✅ Gate: poll training-status, only enable testing when ready
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const s = await apiFetch<{
          status: any;
          progress?: number;
          message?: string;
          estimatedSecondsRemaining?: number;
        }>('/api/identity/training-status');
        if (!alive) return;
        setTrainingStatus(s.status || 'training');
        setTrainingProgress(Number(s.progress || 0));
        setTrainingMessage(String(s.message || 'Preparing…'));
        setEstimatedSecondsRemaining(s.estimatedSecondsRemaining ?? null);

        if (s.status === 'ready') {
          setMessages([{ role: 'assistant', content: 'Your AI is ready. Ask me anything to test!' }]);
        }
      } catch {
        if (!alive) return;
        setTrainingStatus('training');
      }
    };

    tick();
    const id = window.setInterval(tick, 3000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!isReady) {
      showToast('Your AI is still building. Please wait a moment…', 'info');
      return;
    }
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
              {isReady ? 'Test Your AI Clone' : 'Building your AI…'}
            </CardTitle>
            <CardDescription>
              {isReady
                ? 'Your AI is ready. Test it out by asking questions.'
                : `${trainingMessage} (${Math.round(trainingProgress)}%)`}
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

            {!isReady ? (
              <Card className="border-2 border-accent-primary/30 bg-accent-primary/5">
                <CardContent className="pt-6">
                  {/* Prominent Training Status */}
                  <div className="flex items-start gap-4 mb-4">
                    <Loader2 className="h-12 w-12 animate-spin text-accent-primary flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">Building Your AI Clone...</h3>
                      <p className="text-sm text-text-secondary mb-3">Processing your content and training responses</p>

                      {/* Progress Bar */}
                      <div className="h-3 w-full bg-bg-tertiary rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-accent-primary transition-all duration-300"
                          style={{ width: `${Math.min(trainingProgress, 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{Math.round(trainingProgress)}% complete</span>
                        {trainingProgress > 0 && trainingProgress < 100 && (
                          <span className="text-text-tertiary flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {estimatedSecondsRemaining !== null ? (
                              estimatedSecondsRemaining < 60
                                ? `~${Math.max(estimatedSecondsRemaining, 10)} seconds remaining`
                                : `~${Math.ceil(estimatedSecondsRemaining / 60)} ${Math.ceil(estimatedSecondsRemaining / 60) === 1 ? 'minute' : 'minutes'} remaining`
                            ) : (
                              getEstimatedTime(trainingProgress)
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* What's Happening */}
                  <details className="group mb-4">
                    <summary className="cursor-pointer text-sm font-medium text-accent-primary hover:text-accent-primary/80 flex items-center gap-2">
                      What's happening right now?
                      <ArrowRight className="h-4 w-4 group-open:rotate-90 transition-transform" />
                    </summary>
                    <ul className="mt-3 space-y-2 ml-1">
                      <li className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Analyzing your uploaded content</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        {trainingProgress >= 30 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Loader2 className="h-4 w-4 text-accent-primary animate-spin flex-shrink-0 mt-0.5" />
                        )}
                        <span>Generating knowledge embeddings</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        {trainingProgress >= 60 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-bg-tertiary flex-shrink-0 mt-0.5" />
                        )}
                        <span>Training response patterns</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        {trainingProgress >= 90 ? (
                          <Loader2 className="h-4 w-4 text-accent-primary animate-spin flex-shrink-0 mt-0.5" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-bg-tertiary flex-shrink-0 mt-0.5" />
                        )}
                        <span>Setting up your AI personality</span>
                      </li>
                    </ul>
                  </details>

                  {/* Tip */}
                  <Alert className="mb-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                    <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertDescription className="text-sm">
                      <strong>Tip:</strong> You can continue setup while this finishes in the background!
                    </AlertDescription>
                  </Alert>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={async () => {
                        setNavigating(true);
                        try {
                          await apiFetch('/api/creator/onboarding/step', {
                            method: 'POST',
                            body: JSON.stringify({ step: 'complete' }),
                          });
                          await refresh();
                          nav('/onboarding/complete', { replace: true });
                        } finally {
                          setNavigating(false);
                        }
                      }}
                      className="bg-accent-gradient hover:opacity-90 text-white"
                      disabled={navigating}
                    >
                      {navigating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Continue Setup (Recommended)
                    </Button>

                    <Button
                      variant="outline"
                      onClick={async () => {
                        setNavigating(true);
                        try {
                          await apiFetch('/api/creator/onboarding/step', {
                            method: 'POST',
                            body: JSON.stringify({ step: 'done' }),
                          });
                          await refresh();
                          sessionStorage.removeItem('selflyx_post_step2_window');
                          sessionStorage.removeItem('selflyx_allow_preview_once');
                          nav('/dashboard', { replace: true });
                        } catch (error: any) {
                          showToast(error.message || 'Failed to continue', 'error');
                        } finally {
                          setNavigating(false);
                        }
                      }}
                      disabled={navigating}
                    >
                      Skip to Dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-lg bg-accent-primary/10 border border-accent-primary/20 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-accent-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">Your AI is working!</p>
                    <p className="text-xs text-text-secondary">Ask a few questions to validate responses.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Chat Interface */}
            <div className={`border border-border-default rounded-xl overflow-hidden bg-bg-secondary relative ${!isReady ? 'opacity-60' : ''}`}>
              {/* Disabled Overlay */}
              {!isReady && (
                <div className="absolute inset-0 bg-bg-primary/50 backdrop-blur-sm z-10 flex items-center justify-center">
                  <div className="text-center p-6">
                    <Loader2 className="h-8 w-8 animate-spin text-accent-primary mx-auto mb-3" />
                    <p className="font-medium text-sm">Chat will be available once training completes...</p>
                    <p className="text-xs text-text-tertiary mt-1">Feel free to continue setup while this finishes!</p>
                  </div>
                </div>
              )}

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
                    placeholder={isReady ? 'Ask your AI a question…' : 'Chat will be available once training completes...'}
                    className="flex-1 bg-bg-secondary border-border-default"
                    disabled={!isReady || loading}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!isReady || !input.trim() || loading}
                    className="bg-accent-gradient hover:opacity-90 text-white"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {isReady && (
              <>
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
              </>
            )}

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
