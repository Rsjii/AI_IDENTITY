/**
 * Token Paywall Modal Component
 * Displayed when user hits token limit (free tier, subscription, or token pack exhausted)
 * Offers two options: Subscriptions or Token Packs
 */

import { Lock, Sparkles, Zap, Package, CreditCard, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export interface TokenPackOption {
  id: string;
  name: string;
  price: number;
  currency: string;
  conversationTurns: number;
  popular?: boolean;
  bestValue?: boolean;
}

export interface SubscriptionOption {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  recommended?: boolean;
}

export interface TokenPaywallModalProps {
  creatorName: string;
  creatorHandle: string;
  tokenPacks: TokenPackOption[];
  subscriptions?: SubscriptionOption[];
  onPurchaseTokenPack: (packId: string) => void;
  onSubscribe?: (subId: string) => void;
  defaultTab?: 'packs' | 'subscription';
}

export function TokenPaywallModal({
  creatorName,
  tokenPacks,
  subscriptions = [],
  onPurchaseTokenPack,
  onSubscribe,
  defaultTab = 'packs',
}: TokenPaywallModalProps) {
  const formatPrice = (price: number, currency: string) => {
    if (currency === 'INR') {
      return `₹${price}`;
    }
    return `$${price}`;
  };

  return (
    <div className="bg-bg-secondary border border-border-default rounded-xl shadow-2xl max-w-4xl mx-auto my-8 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mb-4">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Continue Your Conversation</h2>
          <p className="text-blue-100">
            You've reached your token limit. Choose an option below to keep chatting with {creatorName}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="packs" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Token Packs
            </TabsTrigger>
            {subscriptions.length > 0 && onSubscribe && (
              <TabsTrigger value="subscription" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Subscriptions
              </TabsTrigger>
            )}
          </TabsList>

          {/* Token Packs Tab */}
          <TabsContent value="packs" className="space-y-4">
            <p className="text-sm text-text-secondary text-center mb-4">
              One-time purchase • Never expires • Use anytime with {creatorName}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {tokenPacks.map((pack) => (
                <Card
                  key={pack.id}
                  className={`relative ${
                    pack.bestValue
                      ? 'border-2 border-green-500 shadow-lg'
                      : pack.popular
                      ? 'border-2 border-blue-500'
                      : 'border border-border-default'
                  }`}
                >
                  {pack.bestValue && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Best Value
                    </div>
                  )}
                  {pack.popular && !pack.bestValue && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Popular
                    </div>
                  )}

                  <CardHeader className="text-center pb-3">
                    <CardTitle className="text-lg">{pack.name}</CardTitle>
                    <CardDescription className="text-2xl font-bold text-text-primary mt-2">
                      {formatPrice(pack.price, pack.currency)}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="text-center pb-3">
                    <p className="text-sm text-text-secondary">
                      ~{pack.conversationTurns} conversation turns
                    </p>
                  </CardContent>

                  <CardFooter>
                    <Button
                      onClick={() => onPurchaseTokenPack(pack.id)}
                      className="w-full"
                      variant={pack.bestValue || pack.popular ? 'default' : 'outline'}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Buy Now
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>

            {/* Benefits */}
            <div className="bg-bg-tertiary rounded-lg p-4 mt-6">
              <h4 className="font-semibold text-text-primary text-sm mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-500" />
                What You Get:
              </h4>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Tokens never expire - use them anytime</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Only works with {creatorName}'s avatars</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>75% goes directly to support {creatorName}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Secure payment via Razorpay/LemonSqueezy</span>
                </li>
              </ul>
            </div>
          </TabsContent>

          {/* Subscriptions Tab */}
          {subscriptions.length > 0 && onSubscribe && (
            <TabsContent value="subscription" className="space-y-4">
              <p className="text-sm text-text-secondary text-center mb-4">
                Recurring subscription • Renews automatically • Cancel anytime
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {subscriptions.map((sub) => (
                  <Card
                    key={sub.id}
                    className={`relative ${
                      sub.recommended
                        ? 'border-2 border-purple-500 shadow-lg'
                        : 'border border-border-default'
                    }`}
                  >
                    {sub.recommended && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        Recommended
                      </div>
                    )}

                    <CardHeader className="text-center pb-3">
                      <CardTitle className="text-lg">{sub.name}</CardTitle>
                      <CardDescription className="text-2xl font-bold text-text-primary mt-2">
                        {formatPrice(sub.price, sub.currency)}
                        <span className="text-sm text-text-secondary font-normal">/{sub.interval}</span>
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="pb-3">
                      <ul className="space-y-2 text-sm">
                        {sub.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-text-secondary">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>

                    <CardFooter>
                      <Button
                        onClick={() => onSubscribe(sub.id)}
                        className="w-full"
                        variant={sub.recommended ? 'default' : 'outline'}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Subscribe
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Footer */}
      <div className="bg-bg-tertiary px-6 py-4 border-t border-border-default">
        <p className="text-xs text-text-tertiary text-center">
          🔒 Secure payment processing • 💳 All major cards accepted • ✨ Instant activation
        </p>
      </div>
    </div>
  );
}

export default TokenPaywallModal;
