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
        <Card className="glass">
          <CardHeader>
            <CardTitle>Choose your plan</CardTitle>
            <CardDescription>Start with a 7-day free trial or subscribe.</CardDescription>
          </CardHeader>
          <CardContent className="pb-0">
            <div className="flex items-center justify-between gap-3 border rounded-md p-3">
              <div>
                <div className="font-medium">Billing country</div>
                <div className="text-xs text-muted-foreground">
                  India → Razorpay • Outside India → LemonSqueezy
                </div>
              </div>
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
            </div>
          </CardContent>
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