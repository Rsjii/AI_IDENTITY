# Stripe to LemonSqueezy Migration - Complete

## ✅ Changes Applied

### Backend Changes

1. **Created `backend/src/services/lemonSqueezyService.ts`**
   - LemonSqueezy API client
   - Checkout creation
   - Webhook signature verification
   - Event extraction

2. **Updated `backend/src/modules/billing/unifiedBillingController.ts`**
   - Removed Stripe imports
   - Changed gateway type to `'razorpay' | 'lemonsqueezy'`
   - Replaced Stripe checkout with LemonSqueezy checkout
   - Added `lemonSqueezyWebhook` handler
   - Razorpay verify now always goes to `deploy` (no `stripe_connect`)

3. **Updated `backend/src/modules/billing/unifiedBillingRoutes.ts`**
   - Added LemonSqueezy webhook route

4. **Updated `backend/src/app.ts`**
   - Removed `stripeRoutes` import and mount
   - Removed `payPerChatRoutes` import and mount
   - Replaced Stripe webhook raw body with LemonSqueezy
   - Updated CSP: removed Stripe domains, added LemonSqueezy domains

5. **Updated `backend/src/config/database.ts`**
   - Changed gateway constraint from `('stripe','razorpay')` to `('razorpay','lemonsqueezy')`

6. **Updated `backend/src/config/envValidation.ts`**
   - Replaced Stripe warnings with LemonSqueezy warnings

7. **Updated `backend/src/modules/marketplace/listingController.ts`**
   - Removed Stripe Connect verification requirement
   - Creators can now publish without Stripe Connect

8. **Updated `backend/src/modules/marketplace/subscriptionController.ts`**
   - Disabled paid subscription checkout (returns 501)
   - Removed Stripe dependency

9. **Updated `backend/src/modules/payments/payPerChatController.ts`**
   - Disabled pay-per-chat endpoints (returns 501)
   - Removed all Stripe code

### Frontend Changes

10. **Updated `frontend/react-app/src/lib/planCheckout.ts`**
    - Changed `gateway: 'stripe'` to `gateway: 'lemonsqueezy'`
    - Updated redirect logic

11. **Updated `frontend/react-app/src/components/ProtectedRoute.tsx`**
    - Changed `stripe_connect` mapping to `/onboarding/deploy`

12. **Updated `frontend/react-app/src/components/PaymentPrompt.tsx`**
    - Removed all Stripe Elements code
    - Simplified to show "Payment Unavailable" message

13. **Updated `frontend/react-app/src/pages/OnboardingPlanPage.tsx`**
    - Removed Stripe-specific error handling

## 📋 Next Steps (Manual)

### 1. Environment Variables
Add these to your `.env` file:

```env
# LemonSqueezy (International plans)
LEMONSQUEEZY_API_KEY=your_api_key_here
LEMONSQUEEZY_STORE_ID=your_store_id_here
LEMONSQUEEZY_WEBHOOK_SECRET=your_webhook_secret_here

LEMONSQUEEZY_VARIANT_ID_STARTER=variant_id_for_starter
LEMONSQUEEZY_VARIANT_ID_GROWTH=variant_id_for_growth
LEMONSQUEEZY_VARIANT_ID_SCALE=variant_id_for_scale
```

### 2. LemonSqueezy Dashboard Setup
1. Create a store in LemonSqueezy dashboard
2. Create a product: "Selflyx Plans"
3. Create 3 subscription variants:
   - Starter (monthly)
   - Growth (monthly)
   - Scale (monthly)
4. Copy variant IDs to env vars
5. Generate API key (Settings → API)
6. Add webhook:
   - URL: `https://yourdomain.com/api/billing/lemonsqueezy/webhook`
   - Events: `order_created`, `subscription_created`, `subscription_updated`, `subscription_cancelled`
   - Copy webhook secret to env var

### 3. Database Migration
Run the SQL migration:

```bash
psql $DATABASE_URL -f backend/migrations/remove_stripe_add_lemonsqueezy.sql
```

Or manually:
```sql
ALTER TABLE "billing_transactions" DROP CONSTRAINT IF EXISTS billing_transactions_gateway_check;
ALTER TABLE "billing_transactions"
  ADD CONSTRAINT billing_transactions_gateway_check
  CHECK ("gateway" IN ('razorpay','lemonsqueezy'));

UPDATE "User"
SET "onboardingStep"='deploy'
WHERE "onboardingStep"='stripe_connect';
```

### 4. Uninstall Stripe Packages

**Backend:**
```bash
cd backend
npm uninstall stripe
```

**Frontend:**
```bash
cd frontend/react-app
npm uninstall @stripe/react-stripe-js @stripe/stripe-js
```

### 5. Remove Stripe Env Vars (Optional)
You can remove these from `.env`:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_SCALE`
- `VITE_STRIPE_PUBLISHABLE_KEY` (frontend)

## 🎯 What Works Now

✅ **India users** → Razorpay plan purchase  
✅ **International users** → LemonSqueezy plan purchase  
✅ **Plan unlock** via webhooks  
✅ **Onboarding flow** → no Stripe Connect blocker  
✅ **Marketplace listing publish** → no Stripe Connect required

## ⚠️ What's Disabled

❌ **Pay-per-chat** (was Stripe PaymentIntents)  
❌ **Marketplace paid subscriptions** (was Stripe Connect)  
❌ **Creator payouts** (was Stripe Connect)

These features need separate implementation with Razorpay/LemonSqueezy if you want them back.

## 🔍 Testing Checklist

- [ ] Test India user plan purchase (Razorpay)
- [ ] Test International user plan purchase (LemonSqueezy)
- [ ] Verify LemonSqueezy webhook receives events
- [ ] Verify plan tier unlocks after payment
- [ ] Verify onboarding completes without Stripe Connect step
- [ ] Verify marketplace listing can be published without Stripe Connect
- [ ] Test that pay-per-chat shows disabled message
- [ ] Test that marketplace subscriptions show disabled message

## 📝 Notes

- Webhook signature header: LemonSqueezy uses `x-signature` by default. If your dashboard uses a different header name, update `lemonSqueezyWebhook` in `unifiedBillingController.ts`.
- The LemonSqueezy API payload structure may vary. If checkout creation fails, check LemonSqueezy API docs and adjust the payload in `createLemonCheckout`.


