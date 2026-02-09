import { useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Zap, TrendingUp, Building2, HelpCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { startPlanCheckout, getLastBillingCountry, setLastBillingCountry, type BillingCountry } from '@/lib/planCheckout';
import { formatMonthlyPrice } from '@/lib/planPriceBook';
import { PlanChangeModal } from '@/components/PlanChangeModal';

export function PricingPage() {
  const { state } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPlanChangeModal, setShowPlanChangeModal] = useState(false);
  const [selectedPlanChange, setSelectedPlanChange] = useState<{
    tier: 'starter' | 'growth' | 'scale';
    type: 'upgrade' | 'downgrade';
  } | null>(null);

  const user = state.status === 'authenticated' ? state.user : null;
  const userPhone = state.status === 'authenticated' ? (state.user as any)?.phone || '' : '';
  const currentPlanTier = (user as any)?.planTier || 'free';
  const planStartDate = (user as any)?.planStartDate;
  const nextBillingDate = (user as any)?.nextBillingDate;
  const defaultBillingCountry: BillingCountry = useMemo(() => {
    console.log('[BILLING-DETECT] === Starting billing country detection ===');
    
    // Step 1: Check localStorage
    const stored = getLastBillingCountry();
    if (stored) {
      console.log('[BILLING-DETECT] ✅ Found stored preference:', stored);
      return stored;
    }
    console.log('[BILLING-DETECT] ⏭️ No stored preference, checking hints...');

    // Step 2: Check phone number
    const p = String(userPhone || '').trim();
    console.log('[BILLING-DETECT] 📱 User phone:', p || '(not provided)');
    if (p.startsWith('+91') || p.startsWith('91')) {
      console.log('[BILLING-DETECT] ✅ Phone number indicates India (+91)');
      return 'IN';
    }
    console.log('[BILLING-DETECT] ⏭️ Phone number does not indicate India');

    // Step 3: Check browser locale/timezone
    if (typeof navigator !== 'undefined') {
      const lang = navigator.language || '';
      console.log('[BILLING-DETECT] 🌐 Browser language:', lang);
      
      let tz = '';
      try {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        console.log('[BILLING-DETECT] 🕐 Browser timezone:', tz);
      } catch (e) {
        console.warn('[BILLING-DETECT] ⚠️ Timezone detection failed:', e);
      }
      
      const langMatchesIndia = lang.toLowerCase().includes('-in');
      const tzMatchesIndia = tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta';
      
      console.log('[BILLING-DETECT] 📊 Detection results:', {
        language: lang,
        languageMatchesIndia: langMatchesIndia,
        timezone: tz,
        timezoneMatchesIndia: tzMatchesIndia,
      });
      
      if (langMatchesIndia || tzMatchesIndia) {
        console.log('[BILLING-DETECT] ✅ Browser hints indicate India');
        return 'IN';
      }
      console.log('[BILLING-DETECT] ⏭️ Browser hints do not indicate India');
    } else {
      console.log('[BILLING-DETECT] ⚠️ Navigator not available (SSR?)');
    }

    console.log('[BILLING-DETECT] 🔄 Defaulting to OTHER (International/USD)');
    return 'OTHER';
  }, [userPhone]);

  const [billingCountry, setBillingCountry] = useState<BillingCountry>(defaultBillingCountry);

  // Helper functions for plan comparison
  const planHierarchy = { free: 0, starter: 1, growth: 2, scale: 3 };
  const isCurrentPlan = (tier: string) => currentPlanTier === tier;
  const isUpgrade = (tier: string) => planHierarchy[tier as keyof typeof planHierarchy] > planHierarchy[currentPlanTier as keyof typeof planHierarchy];
  const isDowngrade = (tier: string) => planHierarchy[tier as keyof typeof planHierarchy] < planHierarchy[currentPlanTier as keyof typeof planHierarchy];

  const formatDate = (date: string | undefined) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Plan details helper
  const getPlanDetails = (tier: string) => {
    const plans: Record<string, { name: string; price: string; features: string[] }> = {
      free: {
        name: 'Free',
        price: '$0/month',
        features: ['500 chats/month', 'Create AI clone', 'Upload content', 'Chat link'],
      },
      starter: {
        name: 'Starter',
        price: formatMonthlyPrice(billingCountry, 'starter'),
        features: ['5,000 chats/month', 'Public marketplace', 'Monetization', 'Website widget', 'Email support'],
      },
      growth: {
        name: 'Growth',
        price: formatMonthlyPrice(billingCountry, 'growth'),
        features: ['25,000 chats/month', 'Everything in Starter', 'Custom branding', 'Priority support', 'Advanced analytics'],
      },
      scale: {
        name: 'Scale',
        price: formatMonthlyPrice(billingCountry, 'scale'),
        features: ['Unlimited chats', 'Everything in Growth', 'Dedicated manager', 'WhatsApp integration', 'Custom integrations'],
      },
    };
    return plans[tier] || plans.free;
  };

  const handlePlanSelect = (tier: 'starter' | 'growth' | 'scale') => {
    if (isCurrentPlan(tier)) return;

    const changeType = isUpgrade(tier) ? 'upgrade' : 'downgrade';
    setSelectedPlanChange({ tier, type: changeType });
    setShowPlanChangeModal(true);
  };

  const handleConfirmPlanChange = async () => {
    if (!selectedPlanChange) return;
    await goCheckout(selectedPlanChange.tier);
    setShowPlanChangeModal(false);
  };

  const goCheckout = async (tier: 'starter' | 'growth' | 'scale') => {
    console.log('[CHECKOUT] === Starting checkout process ===');
    console.log('[CHECKOUT] Tier:', tier);
    console.log('[CHECKOUT] Billing country:', billingCountry);
    
    if (state.status !== 'authenticated') {
      console.log('[CHECKOUT] ❌ User not authenticated, redirecting to auth');
      window.location.href = '/auth';
      return;
    }
    setLoading(true);
    setError('');
    try {
      console.log('[CHECKOUT] 📤 Calling startPlanCheckout API...');
      const result = await startPlanCheckout({
        tier,
        returnUrl: '/settings?tab=billing',
        billingCountry,
      });
      console.log('[CHECKOUT] ✅ Checkout response:', result);
      
      if (result.gateway === 'lemonsqueezy') {
        // redirect already triggered inside startPlanCheckout
        return;
      }
      
      // Razorpay path
      console.log('[CHECKOUT] 💳 Razorpay gateway selected');
      console.log('[CHECKOUT] Order ID:', result.order.id);
      console.log('[CHECKOUT] Amount:', result.order.amount, result.order.currency);
      
      // Razorpay path returns:
      window.location.href = '/settings?tab=billing';
    } catch (e: any) {
      console.error('[CHECKOUT] ❌ Checkout failed:', e);
      setError(e.message || 'Checkout failed');
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Choose Your Plan</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free, upgrade anytime. Simple monthly pricing. Keep 75% of your earnings.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Billing Country Selector */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Billing Country</CardTitle>
            <CardDescription>Select your billing country for plan purchases</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">India → Razorpay • Outside India → LemonSqueezy</div>
            <select
              className="border rounded-md px-3 py-2 bg-background text-sm"
              value={billingCountry}
              onChange={(e) => {
                const v = e.target.value as BillingCountry;
                setBillingCountry(v);
                setLastBillingCountry(v);
              }}
              disabled={loading}
            >
              <option value="IN">India</option>
              <option value="OTHER">Outside India</option>
            </select>
          </CardContent>
        </Card>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Free Plan */}
          <Card className={`glass relative ${
            isCurrentPlan('free') ? 'border-2 border-green-500 bg-green-50/50 dark:bg-green-950/20' : 'border-border-default'
          }`}>
            {isCurrentPlan('free') && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-green-500 text-white">✓ CURRENT PLAN</Badge>
              </div>
            )}
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Free
                {!isCurrentPlan('free') && <Badge variant="outline">Testing</Badge>}
              </CardTitle>
              <CardDescription>Perfect for trying out</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">
                $0
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
              <div className="text-sm text-muted-foreground mb-4">
                500 chats/month
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Create AI clone</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Upload content</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Chat link</span>
                </li>
                <li className="flex items-center gap-2">
                  <X className="h-4 w-4 text-red-500" />
                  <span className="text-muted-foreground">Public marketplace</span>
                </li>
                <li className="flex items-center gap-2">
                  <X className="h-4 w-4 text-red-500" />
                  <span className="text-muted-foreground">Monetization</span>
                </li>
                <li className="flex items-center gap-2">
                  <X className="h-4 w-4 text-red-500" />
                  <span className="text-muted-foreground">Website widget</span>
                </li>
              </ul>
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Zap className="h-3 w-3" />
                  <span>Best for: Testing your AI</span>
                </div>
                {isCurrentPlan('free') ? (
                  <div className="space-y-2">
                    <p className="text-sm text-green-600 dark:text-green-400">
                      ✓ Active since {formatDate(planStartDate)}
                    </p>
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    Downgrade to Free
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Starter Plan */}
          <Card className={`glass relative ${
            isCurrentPlan('starter')
              ? 'border-2 border-green-500 bg-green-50/50 dark:bg-green-950/20'
              : 'border-accent-primary/30'
          }`}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              {isCurrentPlan('starter') ? (
                <Badge className="bg-green-500 text-white">✓ CURRENT PLAN</Badge>
              ) : (
                <Badge className="bg-accent-primary text-white">Most Popular</Badge>
              )}
            </div>
            <CardHeader>
              <CardTitle>Starter</CardTitle>
              <CardDescription>Start earning money</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">
                {formatMonthlyPrice(billingCountry, 'starter').replace('/mo', '')}
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
              <div className="text-sm text-muted-foreground mb-4">
                5,000 chats/month
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Everything in Free</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Public marketplace</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Monetization (earn $)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Website widget</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Standard analytics</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Email support</span>
                </li>
              </ul>
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <TrendingUp className="h-3 w-3" />
                  <span>Best for: Beginners</span>
                </div>
                {isCurrentPlan('starter') ? (
                  <div className="space-y-2">
                    <p className="text-sm text-green-600 dark:text-green-400">
                      ✓ Active since {formatDate(planStartDate)}
                    </p>
                    {nextBillingDate && (
                      <p className="text-xs text-text-secondary">
                        Next billing: {formatDate(nextBillingDate)}
                      </p>
                    )}
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  </div>
                ) : isUpgrade('starter') ? (
                  <Button className="w-full bg-accent-gradient hover:opacity-90 text-white" disabled={loading} onClick={() => handlePlanSelect('starter')}>
                    Upgrade to Starter →
                  </Button>
                ) : isDowngrade('starter') ? (
                  <Button variant="outline" className="w-full" disabled={loading} onClick={() => handlePlanSelect('starter')}>
                    Downgrade to Starter
                  </Button>
                ) : (
                  <Button className="w-full" disabled={loading} onClick={() => handlePlanSelect('starter')}>
                    Choose Starter
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Growth Plan */}
          <Card className={`glass relative ${
            isCurrentPlan('growth')
              ? 'border-2 border-green-500 bg-green-50/50 dark:bg-green-950/20'
              : 'border-border-default'
          }`}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              {isCurrentPlan('growth') ? (
                <Badge className="bg-green-500 text-white">✓ CURRENT PLAN</Badge>
              ) : (
                <Badge variant="secondary">Best Value</Badge>
              )}
            </div>
            <CardHeader>
              <CardTitle>Growth</CardTitle>
              <CardDescription>Scale your audience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">
                {formatMonthlyPrice(billingCountry, 'growth').replace('/mo', '')}
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
              <div className="text-sm text-muted-foreground mb-4">
                25,000 chats/month
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Everything in Starter</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>5x more chats</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Advanced analytics</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Priority support</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>All integrations</span>
                </li>
              </ul>
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <TrendingUp className="h-3 w-3" />
                  <span>Best for: Growing creators</span>
                </div>
                {isCurrentPlan('growth') ? (
                  <div className="space-y-2">
                    <p className="text-sm text-green-600 dark:text-green-400">
                      ✓ Active since {formatDate(planStartDate)}
                    </p>
                    {nextBillingDate && (
                      <p className="text-xs text-text-secondary">
                        Next billing: {formatDate(nextBillingDate)}
                      </p>
                    )}
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  </div>
                ) : isUpgrade('growth') ? (
                  <Button className="w-full bg-accent-gradient hover:opacity-90 text-white" disabled={loading} onClick={() => handlePlanSelect('growth')}>
                    Upgrade to Growth →
                  </Button>
                ) : isDowngrade('growth') ? (
                  <Button variant="outline" className="w-full" disabled={loading} onClick={() => handlePlanSelect('growth')}>
                    Downgrade to Growth
                  </Button>
                ) : (
                  <Button className="w-full" disabled={loading} onClick={() => handlePlanSelect('growth')}>
                    Choose Growth
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Scale Plan */}
          <Card className={`glass relative ${
            isCurrentPlan('scale')
              ? 'border-2 border-green-500 bg-green-50/50 dark:bg-green-950/20'
              : 'border-border-default'
          }`}>
            {isCurrentPlan('scale') && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-green-500 text-white">✓ CURRENT PLAN</Badge>
              </div>
            )}
            <CardHeader>
              <CardTitle>Scale</CardTitle>
              <CardDescription>Enterprise features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">
                {formatMonthlyPrice(billingCountry, 'scale').replace('/mo', '')}
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
              <div className="text-sm text-muted-foreground mb-4">
                Unlimited chats
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Everything in Growth</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Unlimited chats</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>A/B Testing</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>White-label option</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Dedicated support</span>
                </li>
              </ul>
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Building2 className="h-3 w-3" />
                  <span>Best for: Established brands</span>
                </div>
                {isCurrentPlan('scale') ? (
                  <div className="space-y-2">
                    <p className="text-sm text-green-600 dark:text-green-400">
                      ✓ Active since {formatDate(planStartDate)}
                    </p>
                    {nextBillingDate && (
                      <p className="text-xs text-text-secondary">
                        Next billing: {formatDate(nextBillingDate)}
                      </p>
                    )}
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  </div>
                ) : isUpgrade('scale') ? (
                  <Button className="w-full bg-accent-gradient hover:opacity-90 text-white" disabled={loading} onClick={() => handlePlanSelect('scale')}>
                    Upgrade to Scale →
                  </Button>
                ) : isDowngrade('scale') ? (
                  <Button variant="outline" className="w-full" disabled={loading} onClick={() => handlePlanSelect('scale')}>
                    Downgrade to Scale
                  </Button>
                ) : (
                  <Button className="w-full" disabled={loading} onClick={() => handlePlanSelect('scale')}>
                    Choose Scale
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Feature Comparison Table */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Feature Comparison</CardTitle>
            <CardDescription>See what's included in each plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">Feature</th>
                    <th className="text-center p-3 font-semibold">Free</th>
                    <th className="text-center p-3 font-semibold">Starter</th>
                    <th className="text-center p-3 font-semibold">Growth</th>
                    <th className="text-center p-3 font-semibold">Scale</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Price</td>
                    <td className="text-center p-3">$0</td>
                    <td className="text-center p-3">{formatMonthlyPrice(billingCountry, 'starter')}</td>
                    <td className="text-center p-3">{formatMonthlyPrice(billingCountry, 'growth')}</td>
                    <td className="text-center p-3">{formatMonthlyPrice(billingCountry, 'scale')}</td>
                  </tr>
                  <tr className="border-b bg-bg-tertiary/30">
                    <td className="p-3 font-medium">Monthly Chats</td>
                    <td className="text-center p-3">500</td>
                    <td className="text-center p-3">5,000</td>
                    <td className="text-center p-3">25,000</td>
                    <td className="text-center p-3 font-semibold text-accent-primary">Unlimited</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">AI Clone Creation</td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Content Upload</td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                  </tr>
                  <tr className="border-b bg-red-500/5">
                    <td className="p-3 font-medium">Public Marketplace</td>
                    <td className="text-center p-3"><X className="h-4 w-4 mx-auto text-red-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                  </tr>
                  <tr className="border-b bg-red-500/5">
                    <td className="p-3 font-medium">Monetization (Earn Money)</td>
                    <td className="text-center p-3"><X className="h-4 w-4 mx-auto text-red-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Chat Link</td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                  </tr>
                  <tr className="border-b bg-red-500/5">
                    <td className="p-3 font-medium">Website Widget</td>
                    <td className="text-center p-3"><X className="h-4 w-4 mx-auto text-red-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Analytics</td>
                    <td className="text-center p-3 text-muted-foreground">Basic</td>
                    <td className="text-center p-3 text-muted-foreground">Standard</td>
                    <td className="text-center p-3 font-medium">Advanced</td>
                    <td className="text-center p-3 font-medium">Advanced</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Support</td>
                    <td className="text-center p-3 text-muted-foreground">Email</td>
                    <td className="text-center p-3 text-muted-foreground">Email</td>
                    <td className="text-center p-3 font-medium">Priority</td>
                    <td className="text-center p-3 font-medium">Dedicated</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">A/B Testing</td>
                    <td className="text-center p-3"><X className="h-4 w-4 mx-auto text-red-500" /></td>
                    <td className="text-center p-3"><X className="h-4 w-4 mx-auto text-red-500" /></td>
                    <td className="text-center p-3"><X className="h-4 w-4 mx-auto text-red-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">White-label</td>
                    <td className="text-center p-3"><X className="h-4 w-4 mx-auto text-red-500" /></td>
                    <td className="text-center p-3"><X className="h-4 w-4 mx-auto text-red-500" /></td>
                    <td className="text-center p-3"><X className="h-4 w-4 mx-auto text-red-500" /></td>
                    <td className="text-center p-3"><Check className="h-4 w-4 mx-auto text-green-500" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Can I upgrade later?</h3>
              <p className="text-sm text-muted-foreground">
                Yes! You can upgrade or downgrade your plan anytime. Changes take effect immediately.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What happens if I hit my chat limit?</h3>
              <p className="text-sm text-muted-foreground">
                You'll receive a notification when you're close to your limit. Upgrade to a higher plan for more chats, or wait until next month.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Can I monetize on the free plan?</h3>
              <p className="text-sm text-muted-foreground">
                No. Monetization (earning money from visitors) requires a paid plan (Starter, Growth, or Scale). Free plan is for testing only.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Can I make my AI public on the free plan?</h3>
              <p className="text-sm text-muted-foreground">
                No. Your AI clone will be private on the free plan. Upgrade to any paid plan to make it public in the marketplace.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">How much do I earn from monetization?</h3>
              <p className="text-sm text-muted-foreground">
                You keep 75% of all earnings. Platform takes 25% as a transaction fee. For example, if a visitor pays $10, you get $7.50.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
              <p className="text-sm text-muted-foreground">
                Yes, you can cancel your subscription anytime. You'll retain access until the end of your billing period.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan Change Confirmation Modal */}
      {selectedPlanChange && (
        <PlanChangeModal
          open={showPlanChangeModal}
          onClose={() => {
            setShowPlanChangeModal(false);
            setSelectedPlanChange(null);
          }}
          onConfirm={handleConfirmPlanChange}
          changeType={selectedPlanChange.type}
          currentPlan={getPlanDetails(currentPlanTier)}
          newPlan={getPlanDetails(selectedPlanChange.tier)}
          billingInfo={{
            immediateCharge: selectedPlanChange.type === 'upgrade' ? '$100' : undefined,
            nextBillingDate: formatDate(nextBillingDate) || 'Feb 28, 2026',
            nextBillingAmount: getPlanDetails(selectedPlanChange.tier).price,
          }}
          loading={loading}
        />
      )}
    </Layout>
  );
}
