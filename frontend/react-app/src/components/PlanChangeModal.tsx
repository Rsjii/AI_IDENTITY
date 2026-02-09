import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ArrowRight, Check, X } from 'lucide-react';

interface PlanChangeModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  changeType: 'upgrade' | 'downgrade';
  currentPlan: {
    name: string;
    price: string;
    features: string[];
  };
  newPlan: {
    name: string;
    price: string;
    features: string[];
  };
  billingInfo: {
    immediateCharge?: string;
    nextBillingDate: string;
    nextBillingAmount: string;
  };
  loading?: boolean;
}

export function PlanChangeModal({
  open,
  onClose,
  onConfirm,
  changeType,
  currentPlan,
  newPlan,
  billingInfo,
  loading,
}: PlanChangeModalProps) {
  if (!open) return null;

  const isUpgrade = changeType === 'upgrade';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in-0">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">
              {isUpgrade ? '⬆️ Upgrade' : '⬇️ Downgrade'} to {newPlan.name}
            </CardTitle>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              disabled={loading}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <CardDescription>
            {isUpgrade
              ? 'Review the changes and confirm your upgrade'
              : 'Please review what you will lose by downgrading'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Plan Comparison */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 bg-bg-secondary/30">
              <Badge variant="outline" className="mb-2">Current</Badge>
              <div className="font-semibold text-lg">{currentPlan.name}</div>
              <div className="text-muted-foreground">{currentPlan.price}</div>
            </div>
            <div className={`border-2 rounded-lg p-4 ${isUpgrade ? 'border-green-500 bg-green-500/5' : 'border-orange-500 bg-orange-500/5'}`}>
              <Badge className={isUpgrade ? 'bg-green-500' : 'bg-orange-500'}>
                {isUpgrade ? 'Upgrading to' : 'Downgrading to'}
              </Badge>
              <div className="font-semibold text-lg mt-2">{newPlan.name}</div>
              <div className="text-muted-foreground">{newPlan.price}</div>
            </div>
          </div>

          {/* Feature Changes */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              {isUpgrade ? "What you'll get" : "What you'll lose"}
            </h3>
            <div className="space-y-2">
              {isUpgrade ? (
                <ul className="space-y-2">
                  {newPlan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="space-y-2">
                  {currentPlan.features
                    .filter(f => !newPlan.features.includes(f))
                    .map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-orange-700 dark:text-orange-300">
                        <X className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>

          {/* Billing Information */}
          <div className={`border rounded-lg p-4 ${isUpgrade ? 'bg-blue-500/10 border-blue-500/30' : 'bg-orange-500/10 border-orange-500/30'}`}>
            <h3 className="font-semibold mb-3">💳 Billing Details</h3>
            <div className="space-y-2 text-sm">
              {billingInfo.immediateCharge && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {isUpgrade ? 'Charged immediately:' : 'Charged today:'}
                  </span>
                  <span className="font-semibold">{billingInfo.immediateCharge}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next billing date:</span>
                <span className="font-semibold">{billingInfo.nextBillingDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next billing amount:</span>
                <span className="font-semibold">{billingInfo.nextBillingAmount}</span>
              </div>
            </div>

            {isUpgrade ? (
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-3">
                ✓ You get upgraded features RIGHT NOW. Your billing date stays the same.
              </p>
            ) : (
              <p className="text-xs text-orange-700 dark:text-orange-300 mt-3">
                ℹ️ You keep {currentPlan.name} features until {billingInfo.nextBillingDate}. From that date, you'll be on the {newPlan.name} plan.
              </p>
            )}
          </div>

          {!isUpgrade && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-yellow-700 dark:text-yellow-300 mb-1">
                  Are you sure you want to downgrade?
                </p>
                <p className="text-yellow-700 dark:text-yellow-300">
                  You'll lose access to premium features and may not be able to restore them at the current price.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className={`flex-1 ${isUpgrade ? 'bg-gradient-to-r from-accent-primary to-accent-secondary' : ''}`}
              variant={isUpgrade ? 'default' : 'destructive'}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : isUpgrade ? (
                billingInfo.immediateCharge ? `Confirm Upgrade - ${billingInfo.immediateCharge}` : 'Confirm Upgrade'
              ) : (
                'Confirm Downgrade'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
