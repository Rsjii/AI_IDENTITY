/**
 * Token Pack Purchase Component
 * Allows users to purchase one-time token packs for a specific creator
 * Integrates with Razorpay (India) and LemonSqueezy (International)
 */

import { useState } from 'react';
import { Package, Check, CreditCard, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface TokenPack {
  id: string;
  name: string;
  tokens: number;
  price: number;
  currency: string;
  conversationTurns: number;
  popular?: boolean;
  bestValue?: boolean;
  description?: string;
}

export interface TokenPackPurchaseProps {
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  packs: TokenPack[];
  currentBalance?: number;
  onPurchase: (packId: string) => Promise<void>;
  loading?: boolean;
}

export function TokenPackPurchase({
  creatorName,
  packs,
  currentBalance = 0,
  onPurchase,
  loading = false,
}: TokenPackPurchaseProps) {
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  const handlePurchase = async (packId: string) => {
    try {
      setPurchasing(true);
      setSelectedPack(packId);
      await onPurchase(packId);
    } catch (error) {
      console.error('Purchase failed:', error);
    } finally {
      setPurchasing(false);
      setSelectedPack(null);
    }
  };

  const formatPrice = (price: number, currency: string): string => {
    if (currency === 'INR') {
      return `₹${price}`;
    }
    return `$${price}`;
  };

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return tokens.toString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-primary mb-2">
          Purchase Token Packs for {creatorName}
        </h2>
        <p className="text-text-secondary">
          One-time purchase • Never expires • Support {creatorName} directly
        </p>
        {currentBalance > 0 && (
          <div className="mt-3">
            <Badge variant="outline" className="text-sm">
              Current Balance: {formatTokens(currentBalance)} tokens
            </Badge>
          </div>
        )}
      </div>

      {/* Pack Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {packs.map((pack) => {
          const isPurchasing = purchasing && selectedPack === pack.id;

          return (
            <Card
              key={pack.id}
              className={`relative transition-all hover:shadow-lg ${
                pack.bestValue
                  ? 'border-2 border-green-500 shadow-md'
                  : pack.popular
                  ? 'border-2 border-blue-500'
                  : 'border border-border-default'
              }`}
            >
              {/* Badge */}
              {pack.bestValue && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-green-500 text-white font-semibold">
                    Best Value
                  </Badge>
                </div>
              )}
              {pack.popular && !pack.bestValue && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-blue-500 text-white font-semibold">
                    Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-3">
                <div className="flex justify-center mb-2">
                  <div
                    className={`p-3 rounded-full ${
                      pack.bestValue
                        ? 'bg-green-100 dark:bg-green-900/20'
                        : pack.popular
                        ? 'bg-blue-100 dark:bg-blue-900/20'
                        : 'bg-purple-100 dark:bg-purple-900/20'
                    }`}
                  >
                    <Package
                      className={`h-6 w-6 ${
                        pack.bestValue
                          ? 'text-green-600'
                          : pack.popular
                          ? 'text-blue-600'
                          : 'text-purple-600'
                      }`}
                    />
                  </div>
                </div>
                <CardTitle className="text-xl">{pack.name}</CardTitle>
                <CardDescription className="text-3xl font-bold text-text-primary mt-2">
                  {formatPrice(pack.price, pack.currency)}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 pb-3">
                <div className="text-center">
                  <div className="text-lg font-semibold text-text-primary">
                    {formatTokens(pack.tokens)} tokens
                  </div>
                  <div className="text-sm text-text-secondary">
                    ~{pack.conversationTurns} conversation turns
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                    <span>Never expires</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                    <span>Use anytime</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                    <span>75% to creator</span>
                  </div>
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  onClick={() => handlePurchase(pack.id)}
                  disabled={loading || isPurchasing}
                  className={`w-full ${
                    pack.bestValue
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                      : pack.popular
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                      : ''
                  }`}
                  variant={pack.bestValue || pack.popular ? 'default' : 'outline'}
                >
                  {isPurchasing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Buy Now
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Benefits Section */}
      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Why Buy Token Packs?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/20 flex-shrink-0">
                <Check className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-text-primary text-sm">Never Expires</div>
                <div className="text-xs text-text-secondary">
                  Buy once, use anytime. Tokens don't expire.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/20 flex-shrink-0">
                <Check className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <div className="font-semibold text-text-primary text-sm">Support Creators</div>
                <div className="text-xs text-text-secondary">
                  75% of your purchase goes directly to {creatorName}.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/20 flex-shrink-0">
                <Check className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <div className="font-semibold text-text-primary text-sm">Instant Activation</div>
                <div className="text-xs text-text-secondary">
                  Tokens are added to your account immediately after payment.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/20 flex-shrink-0">
                <Check className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <div className="font-semibold text-text-primary text-sm">Secure Payment</div>
                <div className="text-xs text-text-secondary">
                  Powered by Razorpay & LemonSqueezy. All major cards accepted.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer Note */}
      <div className="text-center text-xs text-text-tertiary">
        <p>
          🔒 Secure payment • 💳 All major cards accepted • ✨ Instant activation
        </p>
        <p className="mt-1">
          Tokens purchased for {creatorName} can only be used with their avatars
        </p>
      </div>
    </div>
  );
}

export default TokenPackPurchase;
