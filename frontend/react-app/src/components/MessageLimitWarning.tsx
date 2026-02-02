import { Lock, Sparkles, Zap, Star, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MessageLimitWarningProps {
  remainingMessages: number;
  totalFreeMessages: number;
  onUpgrade: () => void;
  suggestedTiers?: Array<{ amount: number; label: string }>;
  variant?: 'inline' | 'banner' | 'modal';
}

export function MessageLimitWarning({
  remainingMessages,
  totalFreeMessages,
  onUpgrade,
  suggestedTiers = [
    { amount: 500, label: '$5' },
    { amount: 1000, label: '$10' },
    { amount: 2500, label: '$25' },
  ],
  variant = 'inline',
}: MessageLimitWarningProps) {
  const messagesUsed = totalFreeMessages - remainingMessages;
  const isLastMessage = remainingMessages === 1;
  const isOutOfMessages = remainingMessages === 0;

  // Inline variant - shown after each message
  if (variant === 'inline' && !isOutOfMessages) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 my-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              {remainingMessages} free message{remainingMessages !== 1 ? 's' : ''} remaining
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              {isLastMessage
                ? 'This is your last free message. Upgrade to continue the conversation!'
                : `Unlock unlimited messages for this session for just $5`}
            </p>
          </div>
          <Button
            size="sm"
            onClick={onUpgrade}
            className="flex-shrink-0 bg-gradient-to-r from-accent-primary to-accent-secondary hover:opacity-90"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Upgrade
          </Button>
        </div>
      </div>
    );
  }

  // Banner variant - shown at the top of chat
  if (variant === 'banner') {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-b border-blue-200 dark:border-blue-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {isOutOfMessages
                  ? "You've used all 3 free messages"
                  : `${remainingMessages}/${totalFreeMessages} free messages left`}
              </p>
              <p className="text-xs text-text-secondary">
                Unlock unlimited messages for this session starting at $5
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onUpgrade}>
              View Pricing
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Modal/Paywall variant - shown when messages run out
  if (variant === 'modal' || isOutOfMessages) {
    return (
      <div className="bg-bg-secondary border border-border-default rounded-xl p-6 shadow-lg max-w-lg mx-auto my-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary mb-4">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-text-primary mb-2">Unlock Unlimited Chat</h3>
          <p className="text-text-secondary mb-6">
            You've used your {totalFreeMessages} free messages. Choose a tier to continue the conversation and get
            unlimited access to this session!
          </p>

          {/* Pricing Tiers */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {suggestedTiers.map((tier, index) => {
              const isRecommended = index === 0;
              const isPro = index === 1;
              const isVIP = index === 2;

              return (
                <button
                  key={tier.amount}
                  onClick={onUpgrade}
                  className={`relative p-4 rounded-lg border-2 transition-all hover:scale-105 hover:shadow-md ${
                    isRecommended
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : isPro
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                  }`}
                >
                  {isRecommended && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
                      Popular
                    </div>
                  )}
                  <div className="flex flex-col items-center">
                    {isRecommended && <CreditCard className="h-6 w-6 text-blue-600 mb-2" />}
                    {isPro && <Zap className="h-6 w-6 text-purple-600 mb-2" />}
                    {isVIP && <Star className="h-6 w-6 text-yellow-600 mb-2" />}
                    <div className="text-2xl font-bold text-text-primary">{tier.label}</div>
                    <div className="text-xs text-text-secondary mt-1">
                      {isRecommended && 'Basic'}
                      {isPro && 'Pro'}
                      {isVIP && 'VIP'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Benefits */}
          <div className="bg-bg-tertiary rounded-lg p-4 mb-6 text-left">
            <h4 className="font-semibold text-text-primary text-sm mb-3">What you'll get:</h4>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-start gap-2">
                <span className="text-green-500 flex-shrink-0 mt-0.5">✓</span>
                <span>Unlimited messages in this session</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 flex-shrink-0 mt-0.5">✓</span>
                <span>Full conversation history saved forever</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 flex-shrink-0 mt-0.5">✓</span>
                <span>Export conversation as JSON or TXT</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 flex-shrink-0 mt-0.5">✓</span>
                <span>Support your favorite creator</span>
              </li>
            </ul>
          </div>

          <Button
            onClick={onUpgrade}
            className="w-full h-12 bg-gradient-to-r from-accent-primary to-accent-secondary hover:opacity-90 font-semibold"
            size="lg"
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Choose a Tier & Continue
          </Button>

          <p className="text-xs text-text-tertiary mt-4">
            Secure payment via Stripe • Cancel anytime • 75% goes to creator
          </p>
        </div>
      </div>
    );
  }

  return null;
}
