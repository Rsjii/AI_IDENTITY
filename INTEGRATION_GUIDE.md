# Payment Integration & Testing Guide

## ✅ Approach Review

**Your current approach is CORRECT and follows industry best practices:**

1. **Multi-Gateway Strategy** ✅
   - Stripe for international (better for marketplace + payouts)
   - Razorpay for India (better UPI/card success rate)
   - This is exactly what companies like Razorpay themselves recommend

2. **Gateway Selection Logic** ✅
   - Phone number-based detection (`+91` → Razorpay)
   - Simple, works for MVP
   - Can be enhanced later with IP geolocation if needed

3. **Payment Architecture** ✅
   - **Stripe Connect** for marketplace payouts (industry standard)
   - **Webhook-first** design (reliable, handles edge cases)
   - **Unified database table** (`billing_transactions`) for easy management

4. **Security** ✅
   - Server-side signature verification (Razorpay)
   - Webhook signature verification (Stripe)
   - CSP headers configured correctly

**One Note:** Razorpay creator plan is currently **one-time payment**, not recurring subscription. If you want true monthly recurring for India, you'll need to implement Razorpay Subscriptions API later. For MVP, this is fine.

---

## 📋 Integration Steps

### Step 1: Backend Environment Setup

**File:** `backend/.env` (copy from `backend/env.example`)

```env
# Stripe (Required)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_STARTER=price_xxx
STRIPE_PRICE_GROWTH=price_xxx
STRIPE_PRICE_SCALE=price_xxx

# Razorpay (Required for India users)
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_PRICE_STARTER_PAISE=99900
RAZORPAY_PRICE_GROWTH_PAISE=199900
RAZORPAY_PRICE_SCALE_PAISE=499900

# Frontend URL (Required for redirects)
FRONTEND_URL=http://localhost:5173

# Feature Flags (Enable payments)
ENABLE_PAYMENTS=true
ENABLE_PAY_PER_CHAT=true
ENABLE_MARKETPLACE=true
```

**How to get these values:**

1. **Stripe Keys:**
   - Go to https://dashboard.stripe.com/test/apikeys
   - Copy `Publishable key` → `VITE_STRIPE_PUBLISHABLE_KEY` (frontend)
   - Copy `Secret key` → `STRIPE_SECRET_KEY` (backend)

2. **Stripe Price IDs:**
   - Go to https://dashboard.stripe.com/test/products
   - Create products: "Starter", "Growth", "Scale"
   - Create prices for each (monthly recurring)
   - Copy Price IDs → `STRIPE_PRICE_STARTER`, etc.

3. **Razorpay Keys:**
   - Go to https://dashboard.razorpay.com/app/keys
   - Copy `Key ID` → `RAZORPAY_KEY_ID`
   - Copy `Key Secret` → `RAZORPAY_KEY_SECRET`

4. **Stripe Webhook Secret:**
   - After setting up webhook (Step 3), copy signing secret

---

### Step 2: Frontend Environment Setup

**File:** `frontend/react-app/.env` (copy from `frontend/react-app/env.example`)

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
VITE_API_BASE_URL=
```

**Note:** Leave `VITE_API_BASE_URL` empty if frontend and backend are on same origin (recommended for dev).

---

### Step 3: Stripe Webhook Setup

1. **Install Stripe CLI** (for local testing):
   ```bash
   # Windows (PowerShell)
   winget install stripe.stripe-cli
   
   # Or download from: https://stripe.com/docs/stripe-cli
   ```

2. **Login to Stripe CLI:**
   ```bash
   stripe login
   ```

3. **Forward webhooks to local backend:**
   ```bash
   stripe listen --forward-to localhost:3000/api/billing/stripe/webhook
   ```
   - This will output a `whsec_xxx` secret → Copy to `STRIPE_WEBHOOK_SECRET`

4. **For Production:**
   - Go to https://dashboard.stripe.com/test/webhooks
   - Click "Add endpoint"
   - URL: `https://yourdomain.com/api/billing/stripe/webhook`
   - Select events: `checkout.session.completed`, `customer.subscription.*`, `payment_intent.*`
   - Copy signing secret → `STRIPE_WEBHOOK_SECRET` in production `.env`

---

### Step 4: Database Migration

**The `billing_transactions` table is created automatically** when you start the backend (idempotent SQL in `database.ts`).

**Verify it exists:**
```sql
-- Run in your PostgreSQL client
SELECT * FROM billing_transactions LIMIT 1;
```

If table doesn't exist, restart backend server.

---

### Step 5: Start Services

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend/react-app
npm install
npm run dev
```

**Stripe Webhook Forwarding (separate terminal):**
```bash
stripe listen --forward-to localhost:3000/api/billing/stripe/webhook
```

---

## 🧪 Testing Guide

### Test 1: Creator Plan Purchase (Stripe - International User)

**Setup:**
1. Create user account with phone: `+1-555-123-4567` (non-India)
2. Complete profile setup

**Test:**
1. Go to `/onboarding/plan` or `/pricing`
2. Click "Choose" on Starter plan ($49/mo)
3. **Expected:** Redirects to Stripe Checkout
4. Use test card: `4242 4242 4242 4242`
5. Complete payment
6. **Expected:** Redirects back, plan tier = `starter`

**Verify:**
```sql
SELECT "planTier", "onboardingStep" FROM "User" WHERE id = 'your_user_id';
SELECT * FROM billing_transactions WHERE "userId" = 'your_user_id';
```

---

### Test 2: Creator Plan Purchase (Razorpay - India User)

**Setup:**
1. Create user account with phone: `+91-9876543210`
2. Complete profile setup

**Test:**
1. Go to `/onboarding/plan` or `/pricing`
2. Click "Choose" on Starter plan
3. **Expected:** Razorpay modal opens (no redirect)
4. Use test UPI: `success@razorpay` or test card: `4111 1111 1111 1111`
5. Complete payment
6. **Expected:** Modal closes, plan tier = `starter`

**Verify:**
```sql
SELECT "planTier" FROM "User" WHERE id = 'your_user_id';
SELECT * FROM billing_transactions WHERE "gateway" = 'razorpay';
```

---

### Test 3: Pay-Per-Chat (End-User Payment)

**Setup:**
1. Creator must have:
   - `planTier` = `starter` or higher (OR active trial)
   - Listing published (`isPublic = true`, `publishStatus = 'published'`)
   - `enablePayPerChat = true`
   - Stripe Connect account connected (`payouts_enabled = true`)

2. Creator connects Stripe:
   - Go to `/settings?tab=integrations`
   - Click "Connect Stripe"
   - Complete Stripe onboarding (use test mode)

**Test:**
1. Visit creator's chat page (as visitor)
2. Click "Unlock Chat" or see teaser message
3. **Expected:** Stripe payment form appears
4. Use test card: `4242 4242 4242 4242`
5. Complete payment
6. **Expected:** Chat unlocks, visitor can send messages

**Verify:**
```sql
SELECT * FROM premium_sessions WHERE "visitorId" = 'visitor_id';
```

---

### Test 4: Marketplace Subscription

**Setup:**
1. Creator has listing with `subscriptionPriceCents` set (e.g., 1000 = $10/mo)
2. Creator has Stripe Connect connected

**Test:**
1. Visit `/marketplace/creator-slug` (as visitor)
2. Click "Subscribe"
3. **Expected:** Redirects to Stripe Checkout
4. Use test card: `4242 4242 4242 4242`
5. Complete payment
6. **Expected:** Redirects back, subscription active

**Verify:**
```sql
SELECT * FROM marketplace_subscriptions WHERE "userId" = 'visitor_id' AND "listingId" = 'listing_id';
```

---

### Test 5: Webhook Handling (Stripe)

**Test:**
1. Complete a Stripe payment (Test 1 or 3 or 4)
2. Check Stripe CLI terminal for webhook events
3. **Expected:** See `checkout.session.completed` or `payment_intent.succeeded`
4. Check backend logs for webhook processing
5. **Expected:** Database updated correctly

**If webhook fails:**
- Check `STRIPE_WEBHOOK_SECRET` matches
- Check webhook URL is accessible
- Check backend logs for errors

---

## 🐛 Common Issues & Fixes

### Issue 1: "Razorpay not loaded"
**Fix:** Check `frontend/react-app/index.html` has:
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

### Issue 2: CSP blocking Stripe/Razorpay
**Fix:** Check `backend/src/app.ts` CSP directives include:
- `scriptSrc`: `https://js.stripe.com`, `https://checkout.razorpay.com`
- `frameSrc`: `https://js.stripe.com`, `https://checkout.razorpay.com`

### Issue 3: Webhook not working
**Fix:**
- Verify `STRIPE_WEBHOOK_SECRET` is correct
- Check webhook URL is accessible (use ngrok for local testing)
- Check backend logs for signature verification errors

### Issue 4: Razorpay payment succeeds but plan not unlocked
**Fix:**
- Check backend logs for `/api/billing/razorpay/verify` errors
- Verify signature verification is working
- Check `billing_transactions` table for failed status

### Issue 5: "Creator unavailable" for pay-per-chat
**Fix:**
- Creator must have `planTier` ≥ `starter` OR active trial
- Check `trialEndsAt` is in future if using trial

---

## ✅ Production Checklist

Before going live:

- [ ] Switch to **live** Stripe keys (not test)
- [ ] Switch to **live** Razorpay keys (not test)
- [ ] Update `FRONTEND_URL` to production domain
- [ ] Set up production Stripe webhook endpoint
- [ ] Test all flows with real payment methods (small amounts)
- [ ] Verify CSP headers in production
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Test webhook retry mechanism
- [ ] Document refund process
- [ ] Set up Stripe Connect onboarding for creators

---

## 📚 Additional Resources

- **Stripe Docs:** https://stripe.com/docs
- **Razorpay Docs:** https://razorpay.com/docs
- **Stripe Test Cards:** https://stripe.com/docs/testing
- **Razorpay Test Cards:** https://razorpay.com/docs/payments/test-cards

