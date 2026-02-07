# Marketplace & Monetization Flow

## User Journey

### 1. Signup & Onboarding
- User signs up → completes profile → chooses creator type
- **Step 1**: Quiz (mandatory)
- **Step 2**: Upload content (mandatory, minimum 500 words)
- **Step 3**: Preview (optional)
- **Step 4**: Complete (optional)
- After Step 2, user can access dashboard. Steps 3-4 are optional.

### 2. Setup Flow (Monetization)
Creator must complete these steps to publish:

#### Step 1: Set Pricing
- Configure pay-per-chat price
- Configure subscription price (if enabled)
- Set free message limit

#### Step 2: Choose Platform Plan
- Free tier: Can create draft listing, **cannot publish**
- Starter/Growth/Scale: Can publish
- Trial: Can publish during trial period

#### Step 3: Connect Stripe
- Required if monetization enabled (subscriptions OR pay-per-chat)
- Must complete Stripe Connect onboarding
- Must have `details_submitted` + `payouts_enabled` = true

#### Step 4: Publish Listing
- Fill listing basics: title, thumbnail, category, description
- Enable monetization modes (subscriptions and/or pay-per-chat)
- Set prices for enabled modes
- Click "Make listing public"
- Backend validates all prerequisites before publishing

**Share step**: Optional marketing (not counted in completion)

---

## Publishing Rules

### Free Tier
- ✅ Can create/edit **draft** listing
- ❌ **Cannot publish** (blocked at backend)
- Must upgrade to Starter+ or start trial

### Publishing Prerequisites (All Must Pass)
1. **Plan eligible**: Starter/Growth/Scale OR active trial
2. **Listing basics**: title, thumbnail, category, description filled
3. **Pricing configured**: At least one monetization mode enabled with valid price
4. **Stripe Connect verified**: Required if subscriptions OR pay-per-chat enabled

If any prerequisite fails → backend returns error list → user redirected to setup

---

## Monetization Modes

### Subscriptions
- Monthly recurring payment
- Requires Stripe Connect verified
- Price must be > 0

### Pay-Per-Chat
- One-time payment for 24-hour access
- Requires Stripe Connect verified
- Price must be > 0
- Additional gating: Creator must be published + pay-per-chat enabled

### Free Chat Preview
- Limited free messages (configurable)
- No payment required
- Can be enabled alongside monetization

---

## Payment Flow (Pay-Per-Chat)

1. Visitor clicks "Pay to chat"
2. Backend checks:
   - Creator plan eligible (Starter+ or trial)
   - Creator listing is published
   - Pay-per-chat is enabled
   - Stripe Connect is verified
   - Amount matches listing price
3. If all pass → Create Stripe PaymentIntent
4. Visitor pays → Payment confirmed
5. Premium session unlocked (24 hours)
6. Full answer generated and sent

---

## Setup Status Logic

Backend computes completion from **real data**, not just UI clicks:

- **Pricing**: Listing has valid prices configured
- **Plan**: User has Starter+ or active trial
- **Stripe**: Connect account verified (details + payouts)
- **Publish**: Listing is actually published

Setup checklist shows green checkmark only when backend confirms real completion.

---

## Error Handling

### Publishing Fails
- Backend returns `PUBLISH_PREREQ_FAILED` with list of missing items
- Frontend shows error list
- Auto-redirects to `/setup` after 2 seconds

### Free Tier Tries to Publish
- Backend returns `UPGRADE_REQUIRED`
- Frontend redirects to `/pricing`

### Pay-Per-Chat Payment Fails
- Creator not published → `CREATOR_NOT_PUBLISHED`
- Pay-per-chat disabled → `PAY_PER_CHAT_DISABLED`
- Stripe not verified → `STRIPE_CONNECT_REQUIRED`
- Creator on free tier → `CREATOR_UNAVAILABLE_TRIAL_ENDED`

---

## Summary

**Free creators**: Draft only, no publish  
**Paid creators**: Can publish after completing setup (pricing + plan + stripe + listing basics)  
**Monetization**: Requires Stripe Connect if any payment mode enabled  
**Publishing**: Backend enforces all prerequisites before allowing public listing  
**Payments**: Only work if creator is published + verified + eligible plan

