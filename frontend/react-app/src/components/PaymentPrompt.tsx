import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface PaymentPromptProps {
  creatorId: string;
  sessionId: string;
  paymentOptions: {
    payPerChatPriceCents?: number;
    tiers?: { amount: number; label: string }[];
    defaultAmount?: number;
  };
  subscriptionOption?: {
    listingId: string;
    priceCents: number;
    currency?: string;
  };
  returnTo?: string;
  previewText?: string;
  messageIdToUnlock?: string;
  creatorName?: string;
  onSuccess: (reply?: string, premiumExpiresAt?: string) => void;
  onCancel: () => void;
}

export function PaymentPrompt(props: PaymentPromptProps) {
  return (
    <Card className="glass shadow-sm">
      <CardHeader>
        <CardTitle>Payment Unavailable</CardTitle>
        <CardDescription>
          Pay-per-chat and marketplace subscriptions are temporarily disabled while we migrate to a new payment system.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800 dark:text-yellow-200">
            <p className="font-semibold mb-1">We're upgrading our payment infrastructure</p>
            <p>This feature will be available again soon. Thank you for your patience!</p>
          </div>
        </div>
        <Button onClick={props.onCancel} variant="outline" className="w-full">
          Close
        </Button>
      </CardContent>
    </Card>
  );
}
