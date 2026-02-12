/**
 * Usage Indicator Component
 * Displays token usage progress for users (subscription, token pack, or free tier)
 * Shows percentage-based progress bars with warnings at 80% and 90%
 */

import { AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

export interface UsageIndicatorProps {
  type: 'subscription' | 'token_pack' | 'free';
  percentageUsed: number;
  showWarning?: boolean;
  onUpgrade?: () => void;
  compact?: boolean;
}

export function UsageIndicator({
  type,
  percentageUsed,
  onUpgrade,
  compact = false,
}: UsageIndicatorProps) {
  // Don't show anything if usage is below 50%
  if (percentageUsed < 50) {
    return null;
  }

  // Determine warning level
  const isWarning = percentageUsed >= 80 && percentageUsed < 90;
  const isCritical = percentageUsed >= 90;
  const isExhausted = percentageUsed >= 100;

  // Get appropriate colors
  const getProgressColor = () => {
    if (isExhausted) return 'bg-red-500';
    if (isCritical) return 'bg-orange-500';
    if (isWarning) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const getBorderColor = () => {
    if (isExhausted) return 'border-red-200 dark:border-red-800';
    if (isCritical) return 'border-orange-200 dark:border-orange-800';
    if (isWarning) return 'border-yellow-200 dark:border-yellow-800';
    return 'border-blue-200 dark:border-blue-800';
  };

  const getBgColor = () => {
    if (isExhausted) return 'bg-red-50 dark:bg-red-900/20';
    if (isCritical) return 'bg-orange-50 dark:bg-orange-900/20';
    if (isWarning) return 'bg-yellow-50 dark:bg-yellow-900/20';
    return 'bg-blue-50 dark:bg-blue-900/20';
  };

  const getTextColor = () => {
    if (isExhausted) return 'text-red-900 dark:text-red-100';
    if (isCritical) return 'text-orange-900 dark:text-orange-100';
    if (isWarning) return 'text-yellow-900 dark:text-yellow-100';
    return 'text-blue-900 dark:text-blue-100';
  };

  const getSecondaryTextColor = () => {
    if (isExhausted) return 'text-red-700 dark:text-red-300';
    if (isCritical) return 'text-orange-700 dark:text-orange-300';
    if (isWarning) return 'text-yellow-700 dark:text-yellow-300';
    return 'text-blue-700 dark:text-blue-300';
  };

  const getIcon = () => {
    if (isExhausted || isCritical) return <AlertCircle className="h-5 w-5" />;
    if (isWarning) return <AlertTriangle className="h-5 w-5" />;
    return <Info className="h-5 w-5" />;
  };

  const getMessage = () => {
    const tierName = type === 'subscription' ? 'subscription' : type === 'token_pack' ? 'token pack' : 'free tier';

    if (isExhausted) {
      return {
        title: 'Usage Limit Reached',
        description: `You've reached your ${tierName} limit. Upgrade to continue chatting.`,
      };
    }

    if (isCritical) {
      return {
        title: `${Math.round(percentageUsed)}% Used - Almost Out!`,
        description: `Only ${100 - Math.round(percentageUsed)}% remaining. Consider upgrading soon.`,
      };
    }

    if (isWarning) {
      return {
        title: `${Math.round(percentageUsed)}% Used`,
        description: `You're approaching your limit. ${100 - Math.round(percentageUsed)}% remaining.`,
      };
    }

    return {
      title: `${Math.round(percentageUsed)}% Used`,
      description: 'You still have plenty of usage remaining.',
    };
  };

  const message = getMessage();

  // Compact variant (for inline display)
  if (compact) {
    return (
      <div className={`rounded-lg border ${getBorderColor()} ${getBgColor()} p-2 my-2`}>
        <div className="flex items-center gap-2 mb-1">
          <div className={getTextColor()}>{getIcon()}</div>
          <span className={`text-xs font-medium ${getTextColor()}`}>
            {message.title}
          </span>
        </div>
        <Progress value={percentageUsed} className="h-1.5" indicatorClassName={getProgressColor()} />
      </div>
    );
  }

  // Full variant (for prominent display)
  return (
    <div className={`rounded-lg border ${getBorderColor()} ${getBgColor()} p-4 my-4`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${getTextColor()}`}>
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className={`text-sm font-semibold ${getTextColor()}`}>
              {message.title}
            </p>
            {onUpgrade && (isWarning || isCritical || isExhausted) && (
              <Button
                size="sm"
                onClick={onUpgrade}
                className={`flex-shrink-0 ${
                  isExhausted || isCritical
                    ? 'bg-gradient-to-r from-red-500 to-orange-500'
                    : 'bg-gradient-to-r from-blue-500 to-purple-500'
                } hover:opacity-90`}
              >
                Upgrade
              </Button>
            )}
          </div>
          <p className={`text-xs ${getSecondaryTextColor()} mb-2`}>
            {message.description}
          </p>
          <Progress value={percentageUsed} className="h-2" indicatorClassName={getProgressColor()} />
        </div>
      </div>
    </div>
  );
}

export default UsageIndicator;
