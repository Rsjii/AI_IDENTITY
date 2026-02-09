import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useOnboardingGuard, usePreventBack } from '@/hooks/useOnboardingGuard';
import { useAuth } from '@/contexts/AuthContext';
import { startPlanCheckout, getLastBillingCountry, setLastBillingCountry, type BillingCountry } from '@/lib/planCheckout';
import { formatMonthlyPrice } from '@/lib/planPriceBook';

export function OnboardingPlanPage() {
  const nav = useNavigate();
  const { state, refresh } = useAuth();
  const [loading, setLoading] = useState(false);

  const userPhone = state.status === 'authenticated' ? (state.user as any)?.phone || '' : '';
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

  // ✅ Redirect to dashboard if onboarding is already complete
  useOnboardingGuard();

  // ✅ Prevent back navigation to profile page
  usePreventBack();

  const startTrial = async () => {
    setLoading(true);
    try {
      await apiFetch('/api/creator/trial/start', { method: 'POST', body: JSON.stringify({}) });
      await refresh(); // ✅ pulls onboardingStep='deploy'
      nav('/onboarding/deploy', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const checkout = async (tier: 'starter' | 'growth' | 'scale') => {
    console.log('[CHECKOUT] === Starting checkout process ===');
    console.log('[CHECKOUT] Tier:', tier);
    console.log('[CHECKOUT] Billing country:', billingCountry);
    
    setLoading(true);
    try {
      console.log('[CHECKOUT] 📤 Calling startPlanCheckout API...');
      const result = await startPlanCheckout({
        tier,
        returnUrl: '/onboarding/deploy?paid=1',
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
      
      // If Razorpay (no redirect), continue locally:
      await refresh();
      nav('/onboarding/deploy?paid=1', { replace: true });
    } catch (error: any) {
      console.error('[CHECKOUT] ❌ Checkout error:', error);
      
      showToast(error.message || 'Failed to start checkout. Please try again.', 'error');
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Base Currency Selection Card */}
        <Card className="glass border-accent-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              💰 Your Base Currency
            </CardTitle>
            <CardDescription>
              All your earnings will be paid out in this currency. Users worldwide can pay in their local currency.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div
                onClick={() => {
                  setBillingCountry('IN');
                  setLastBillingCountry('IN');
                }}
                className={`cursor-pointer border-2 rounded-lg p-4 transition-all hover:scale-105 ${
                  billingCountry === 'IN'
                    ? 'border-accent-primary bg-accent-primary/10'
                    : 'border-border-default hover:border-accent-primary/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">₹</span>
                  <div className="flex-1">
                    <div className="font-semibold text-lg">Indian Rupee (INR)</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Payouts via Razorpay to Indian bank accounts
                    </div>
                  </div>
                  {billingCountry === 'IN' && (
                    <div className="h-6 w-6 rounded-full bg-accent-primary flex items-center justify-center">
                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              <div
                onClick={() => {
                  setBillingCountry('OTHER');
                  setLastBillingCountry('OTHER');
                }}
                className={`cursor-pointer border-2 rounded-lg p-4 transition-all hover:scale-105 ${
                  billingCountry === 'OTHER'
                    ? 'border-accent-primary bg-accent-primary/10'
                    : 'border-border-default hover:border-accent-primary/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">$</span>
                  <div className="flex-1">
                    <div className="font-semibold text-lg">US Dollar (USD)</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Payouts via LemonSqueezy to international accounts
                    </div>
                  </div>
                  {billingCountry === 'OTHER' && (
                    <div className="h-6 w-6 rounded-full bg-accent-primary flex items-center justify-center">
                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                💡 <strong>Tip:</strong> Choose based on where you'll receive payments. Users worldwide can pay in their local currency, and we'll handle conversion automatically.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Choose your plan</CardTitle>
            <CardDescription>Start with a 7-day free trial or subscribe to a paid plan.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-4">
            <div className="border rounded-md p-4">
              <div className="font-semibold">Free Trial</div>
              <div className="text-sm text-muted-foreground">7 days unlocked</div>
              <Button className="mt-3 w-full" disabled={loading} onClick={startTrial}>Start trial</Button>
            </div>
            <div className="border rounded-md p-4">
              <div className="font-semibold">Pro</div>
              <div className="text-sm text-muted-foreground">{formatMonthlyPrice(billingCountry, 'starter')}</div>
              <Button className="mt-3 w-full" disabled={loading} onClick={() => checkout('starter')}>Choose</Button>
            </div>
            <div className="border rounded-md p-4">
              <div className="font-semibold">Growth</div>
              <div className="text-sm text-muted-foreground">{formatMonthlyPrice(billingCountry, 'growth')}</div>
              <Button className="mt-3 w-full" disabled={loading} onClick={() => checkout('growth')}>Choose</Button>
            </div>
            <div className="border rounded-md p-4">
              <div className="font-semibold">Scale</div>
              <div className="text-sm text-muted-foreground">{formatMonthlyPrice(billingCountry, 'scale')}</div>
              <Button className="mt-3 w-full" disabled={loading} onClick={() => checkout('scale')}>Choose</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}