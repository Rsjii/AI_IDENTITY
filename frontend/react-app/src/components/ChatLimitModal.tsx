import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { X, AlertTriangle, ArrowUp } from 'lucide-react';

interface ChatLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: string;
  used: number;
  limit: number;
  nextTier: string | null;
  upgradeUrl?: string;
  message?: string;
}

export function ChatLimitModal({
  isOpen,
  onClose,
  tier,
  used,
  limit,
  nextTier,
  upgradeUrl = '/pricing',
  message,
}: ChatLimitModalProps) {
  const nav = useNavigate();

  if (!isOpen) return null;

  const usagePercent = Math.round((used / limit) * 100);
  const remaining = Math.max(0, limit - used);

  const handleUpgrade = () => {
    nav(upgradeUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="glass shadow-xl max-w-md w-full mx-4 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-text-primary transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-orange-500/20">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <CardTitle>Monthly Chat Limit Reached</CardTitle>
              <CardDescription>You've used all your available chats this month</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert className="border-orange-500/30 bg-orange-500/10">
            <AlertDescription>
              <strong>Current Plan: {tier}</strong>
              <p className="text-sm mt-1">{message || `You've reached your ${tier} plan limit of ${limit.toLocaleString()} chats this month.`}</p>
            </AlertDescription>
          </Alert>

          {/* Usage Stats */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Usage this month</span>
              <span className="font-semibold">
                {used.toLocaleString()} / {limit.toLocaleString()} chats
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-300"
                style={{ width: `${Math.min(100, usagePercent)}%` }}
              />
            </div>

            <div className="text-xs text-muted-foreground text-center">
              {remaining > 0 ? `${remaining.toLocaleString()} chats remaining` : 'No chats remaining'}
            </div>
          </div>

          {/* Upgrade CTA */}
          {nextTier && (
            <div className="space-y-4 pt-4 border-t border-border-default">
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg">Upgrade to {nextTier}</h3>
                <p className="text-sm text-muted-foreground">
                  Get more capacity and unlock additional features
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={handleUpgrade}
                  className="w-full h-12 bg-gradient-to-r from-accent-primary to-accent-secondary hover:opacity-90 transition-all font-semibold"
                >
                  <ArrowUp className="mr-2 h-4 w-4" />
                  Upgrade to {nextTier} Plan
                </Button>
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="w-full"
                >
                  Maybe Later
                </Button>
              </div>
            </div>
          )}

          {!nextTier && (
            <div className="pt-4 border-t border-border-default">
              <p className="text-sm text-center text-muted-foreground">
                You're on the highest plan. Contact support for custom limits.
              </p>
            </div>
          )}

          {/* Info */}
          <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border-default">
            <p>Your chat limit resets at the start of each month.</p>
            <p className="mt-1">Upgrading will give you immediate access to more chats.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

