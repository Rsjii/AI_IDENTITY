# 🔍 Stripe Payment & Plan Update Issue Analysis

## Problem
User ne Stripe checkout session create kiya (`POST /api/billing/stripe/create-checkout-session` - 200 OK), but **plan update nahi ho raha**.

## Root Cause Analysis

### ✅ What's Working:
1. **Checkout Session Created** ✅
   - Log: `POST /api/billing/stripe/create-checkout-session → 200 (2430ms)`
   - Session successfully created in Stripe
   - User redirected to Stripe checkout page

### ❌ What's NOT Working:
1. **Webhook NOT Received** ❌
   - Logs mein **NO webhook event** dikh raha
   - `[STRIPE_WEBHOOK] 📥 Webhook request received` - **MISSING**
   - `checkout.session.completed` event - **MISSING**

## Why Webhook Not Received?

### **Issue #1: Local Testing - Webhook Not Configured**
**Problem:** Local development mein Stripe webhooks directly nahi aate. Stripe server se tumhare localhost ko hit nahi kar sakta.

**Solution:** Use **Stripe CLI** to forward webhooks:
```bash
# Install Stripe CLI
# Windows: Download from https://github.com/stripe/stripe-cli/releases
# Or: scoop install stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/billing/stripe/webhook
```

**Expected Output:**
```
> Ready! Your webhook signing secret is whsec_xxxxx
> Forwarding events to http://localhost:3000/api/billing/stripe/webhook
```

**Then in another terminal, trigger test event:**
```bash
stripe trigger checkout.session.completed
```

---

### **Issue #2: Webhook Secret Not Set**
**Check:** `.env` file mein `STRIPE_WEBHOOK_SECRET` set hai ya nahi?

```bash
# For local testing (from Stripe CLI output)
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# For production (from Stripe Dashboard)
STRIPE_WEBHOOK_SECRET=whsec_production_xxxxx
```

**If missing:** Webhook handler will fail with:
```
[STRIPE_WEBHOOK] ❌ Missing stripe-signature header
```

---

### **Issue #3: Webhook Endpoint Not Configured in Stripe Dashboard**
**For Production:**
1. Go to: https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://yourdomain.com/api/billing/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy webhook signing secret to `.env`

---

## 🔍 How to Debug (Step by Step)

### **Step 1: Check if Webhook Received**
After payment, check logs for:
```
[STRIPE_WEBHOOK] 📥 Webhook request received
[STRIPE_WEBHOOK] ✅ Received event: checkout.session.completed
```

**If NOT found:** Webhook nahi aaya (local testing issue)

### **Step 2: Check Checkout Session Metadata**
In logs, you should see:
```
[STRIPE_CHECKOUT] ✅ Checkout session created
  metadata: { userId: "...", tier: "starter" }
```

**Verify:** `userId` and `tier` are present in metadata

### **Step 3: Check Webhook Processing**
If webhook received, you should see:
```
[STRIPE_WEBHOOK] 💳 Processing checkout.session.completed
[STRIPE_WEBHOOK] 📋 Extracted metadata from session
[STRIPE_WEBHOOK] ✅ Tier normalized
[STRIPE_WEBHOOK] 🔄 Updating user plan tier in database
[STRIPE_WEBHOOK] ✅ Updated user X from free to starter
```

**If NOT found:** Webhook processing failed

---

## 🛠️ Quick Fix for Local Testing

### **Option 1: Use Stripe CLI (Recommended)**
```bash
# Terminal 1: Start webhook forwarding
stripe listen --forward-to localhost:3000/api/billing/stripe/webhook

# Terminal 2: After payment, trigger test event
stripe trigger checkout.session.completed
```

### **Option 2: Manual Plan Update (For Testing)**
If webhook not working, manually update plan:
```sql
UPDATE "User" SET "planTier" = 'starter' WHERE email = 'a@gmail.com';
```

### **Option 3: Test in Production**
Deploy to production where webhooks are properly configured.

---

## 📊 Expected Log Flow (After Fix)

### **1. Checkout Session Creation:**
```
[STRIPE_CHECKOUT] 🚀 Creating checkout session
[STRIPE_CHECKOUT] ✅ Tier normalized
[STRIPE_CHECKOUT] 📊 Fetching user details
[STRIPE_CHECKOUT] ✅ User found
[STRIPE_CHECKOUT] 🔍 Checking existing Stripe customer
[STRIPE_CHECKOUT] ✅ Customer found/created
[STRIPE_CHECKOUT] 💳 Creating Stripe checkout session
[STRIPE_CHECKOUT] ✅ Checkout session created
```

### **2. User Completes Payment in Stripe:**
(No logs - happens in Stripe)

### **3. Webhook Received:**
```
[STRIPE_WEBHOOK] 📥 Webhook request received
[STRIPE_WEBHOOK] 🔐 Verifying webhook signature
[STRIPE_WEBHOOK] ✅ Received event: checkout.session.completed
[STRIPE_WEBHOOK] 💳 Processing checkout.session.completed
[STRIPE_WEBHOOK] 📋 Extracted metadata from session
[STRIPE_WEBHOOK] ✅ Tier normalized
[STRIPE_WEBHOOK] 🔄 Updating user plan tier in database
[STRIPE_WEBHOOK] ✅ Updated user X from free to starter
[STRIPE_WEBHOOK] ✅ Plan update complete
```

---

## ✅ Verification Query

After webhook processes, verify plan updated:
```sql
SELECT id, email, "planTier", "onboardingStep"
FROM "User"
WHERE email = 'a@gmail.com';
```

**Expected:**
- `planTier`: `'starter'` (or `'growth'`, `'scale'`)
- `onboardingStep`: `'deploy'` or `'stripe_connect'`

---

## 🚨 Common Issues & Fixes

### **Issue: "Missing stripe-signature header"**
**Fix:** 
- Check webhook endpoint is `/api/billing/stripe/webhook`
- Verify `express.raw()` middleware is applied (in `app.ts`)
- Check Stripe CLI is forwarding correctly

### **Issue: "Signature verification failed"**
**Fix:**
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe CLI output
- Check secret is correct in `.env`
- Restart server after changing `.env`

### **Issue: "Invalid metadata"**
**Fix:**
- Check `createCheckoutSession` is setting `metadata: { userId, tier }`
- Verify `userId` is correct
- Check `tier` is valid (`'starter'`, `'growth'`, `'scale'`)

### **Issue: Plan not updating even after webhook**
**Fix:**
- Check database query is executing
- Verify `userId` exists in database
- Check for SQL errors in logs

---

## 📝 Next Steps

1. **Install Stripe CLI** (if not installed)
2. **Run webhook forwarding:** `stripe listen --forward-to localhost:3000/api/billing/stripe/webhook`
3. **Complete payment** in Stripe checkout
4. **Check logs** for webhook events
5. **Verify plan updated** in database

---

**Status:** ✅ Logging added - Now you can see exactly where the flow breaks!

