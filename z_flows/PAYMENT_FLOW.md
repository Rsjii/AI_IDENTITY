# Payment Flow Overview

## Architecture

**Multi-Gateway System:**
- **Razorpay** → Indian users (INR, UPI/Cards/Netbanking)
- **LemonSqueezy** → International users (USD, Cards)

**Decision Logic:** 
- **Primary:** User's explicit `billingCountry` selection at checkout (`IN` or `OTHER`)
- **Fallback:** Backend checks user's phone number → If starts with `+91` or `91` → Razorpay, else → LemonSqueezy
- **Frontend Default:** localStorage → phone prefix → browser locale/timezone → `OTHER`

---

## 1. Creator Plan Purchase (Your SaaS Billing)

### Flow: User Buys Plan (Starter/Growth/Scale)

**Step 1:** User selects billing country and clicks "Choose Plan" on frontend
- User sees billing country dropdown: "India" or "Outside India"
- Prices update immediately based on selection (₹ for India, $ for International)
- Selection saved to localStorage: `selflyx.billingCountry`
- Frontend calls `startPlanCheckout({ tier: 'starter' | 'growth' | 'scale', billingCountry: 'IN' | 'OTHER', returnUrl })`

**Step 2:** Frontend → Backend
- `POST /api/billing/checkout` with `{ tier, billingCountry, returnUrl }`
- Backend prioritizes explicit `billingCountry` from request
- **If `billingCountry === 'IN'`** → Creates Razorpay Order → Returns `{ gateway: 'razorpay', keyId, order, tier }`
- **If `billingCountry === 'OTHER'`** → Creates LemonSqueezy Checkout → Returns `{ gateway: 'lemonsqueezy', url }`

**Step 3A: LemonSqueezy Path (International)**
- Frontend redirects user to LemonSqueezy Checkout URL
- User pays on LemonSqueezy (USD)
- LemonSqueezy redirects back to `returnUrl`
- **LemonSqueezy Webhook** (`POST /api/billing/lemonsqueezy/webhook`) processes events:
  - `subscription_created` / `subscription_updated` → Updates:
    - `User.planTier` → selected tier
    - `User.onboardingStep` → 'deploy' (if onboarding)
    - `billing_transactions.status` → 'succeeded'

**Step 3B: Razorpay Path (India)**
- Frontend opens Razorpay modal (no redirect)
- User pays via UPI/Card/Netbanking (INR)
- On success, frontend calls `POST /api/billing/razorpay/verify` with signature
- Backend verifies signature → Updates:
  - `User.planTier` → selected tier
  - `User.onboardingStep` → 'deploy' (if onboarding)
  - `billing_transactions.status` → 'succeeded'

**Result:** User's plan tier is unlocked, can access paid features

---

## 2. End-User Pay-Per-Chat

### Status: ⚠️ Currently Disabled (Returns 501)

**Flow:** Visitor Pays to Chat with Creator

**Current Implementation:**
- `POST /api/payments/pay-per-chat/create-intent` → Returns `501 Not Implemented`
- `POST /api/payments/pay-per-chat/confirm` → Returns `501 Not Implemented`

**Reason:** Pay-per-chat was heavily dependent on Stripe. After Stripe removal, this feature is temporarily disabled.

**Future:** Will be re-implemented with Razorpay (India) and LemonSqueezy (International) when needed.

---

## 3. Marketplace Subscriptions

### Status: ⚠️ Currently Disabled (Returns 501)

**Flow:** Visitor Subscribes to Creator's Monthly Plan

**Current Implementation:**
- `POST /api/marketplace/subscriptions/checkout` → Returns `501 Not Implemented`
- `POST /api/marketplace/subscriptions/cancel` → No longer interacts with payment gateway

**Reason:** Marketplace paid subscriptions were dependent on Stripe Connect. After Stripe removal, this feature is temporarily disabled.

**Future:** Will be re-implemented with Razorpay (India) and LemonSqueezy (International) when needed.

---

## 4. Payouts (Creator Earnings)

### Status: ⚠️ Currently Disabled

**Flow:** Creator Receives Money

**Current Implementation:**
- `POST /api/creator/stripe/connect` → Returns `501 Not Implemented`
- `GET /api/creator/stripe/status` → Returns `501 Not Implemented`

**Reason:** Payouts were handled via Stripe Connect. After Stripe removal, payout functionality is temporarily disabled.

**Future:** Will be re-implemented with Razorpay X (India) and LemonSqueezy payouts (International) when needed.

---

## Currency Display and Pricing

### Frontend Price Book

All prices are managed in `frontend/react-app/src/lib/planPriceBook.ts`:

- **India (IN):** INR (₹) - ₹999 / ₹1999 / ₹4999 per month
- **International (OTHER):** USD ($) - $49 / $149 / $499 per month

**Price Display Logic:**
- Prices display based on user's selected `billingCountry`
- Default selection: localStorage → phone prefix → browser locale/timezone → `OTHER`
- All plan pages use `formatMonthlyPrice(billingCountry, tier)` helper

**Backend Price Matching:**
- Razorpay amounts in paise: 99900 / 199900 / 499900 (displayed as ₹999 / ₹1999 / ₹4999)
- LemonSqueezy variant prices: $49 / $149 / $499 (configured in LemonSqueezy dashboard)

---

## Database Tables

- **`billing_transactions`** → Stores all creator plan purchases (Razorpay + LemonSqueezy)
  - `gateway`: `'razorpay'` or `'lemonsqueezy'`
  - `status`: `'pending'`, `'succeeded'`, `'failed'`
- **`User.planTier`** → Creator's current plan (free/starter/growth/scale)
- **`User.onboardingStep`** → Updated to 'deploy' after successful payment

---

## Key Points

✅ **Razorpay** = India creators buying SaaS plans (INR)  
✅ **LemonSqueezy** = International creators buying SaaS plans (USD)  
✅ **Billing Country Selection** = User-driven via dropdown, persisted in localStorage  
✅ **Webhooks** = LemonSqueezy handles subscription renewals/cancellations automatically  
✅ **Razorpay** = One-time payment (not recurring subscription yet)  
⚠️ **Pay-per-chat** = Currently disabled (501)  
⚠️ **Marketplace Subscriptions** = Currently disabled (501)  
⚠️ **Payouts** = Currently disabled (Stripe Connect removed)  

---

## Environment Variables Required

### Razorpay (India)
- `RAZORPAY_KEY_ID` - Razorpay API key
- `RAZORPAY_KEY_SECRET` - Razorpay API secret
- `RAZORPAY_PRICE_STARTER_PAISE` - Starter plan price in paise (default: 99900)
- `RAZORPAY_PRICE_GROWTH_PAISE` - Growth plan price in paise (default: 199900)
- `RAZORPAY_PRICE_SCALE_PAISE` - Scale plan price in paise (default: 499900)

### LemonSqueezy (International)
- `LEMONSQUEEZY_API_KEY` - LemonSqueezy API key
- `LEMONSQUEEZY_WEBHOOK_SECRET` - Webhook signature verification secret
- LemonSqueezy variant prices configured in LemonSqueezy dashboard (must match frontend price book)

---

## Webhook Setup

### LemonSqueezy Webhook
- **Endpoint:** `POST /api/billing/lemonsqueezy/webhook`
- **Events Handled:**
  - `subscription_created` - New subscription started
  - `subscription_updated` - Subscription tier changed
  - `subscription_cancelled` - Subscription cancelled
- **Verification:** Uses `LEMONSQUEEZY_WEBHOOK_SECRET` to verify signature

### Razorpay Webhook (Future)
- Currently not used (one-time payments verified via signature in frontend)
- Future: Can be set up for recurring subscriptions if needed
