# FINAL IMPLEMENTATION ANALYSIS & PHASE-BY-PHASE PLAN

## Current state analysis

### What's working
1. Revenue split (75/25) — implemented in backend
2. Database schema — `marketplace_listings`, `stripe_payments` exist
3. Chat system — paywall, free messages, premium sessions
4. Stripe integration — Connect service exists
5. Chat limit tracking — `countCreatorChatsThisMonth()` exists in `publicController.ts` and `widgetController.ts`

### Critical gaps
1. Creator pricing control — no UI, stored in `priceConfig` JSONB only
2. Free tier restrictions — marketplace accessible to free tier
3. Stripe Connect onboarding — not required in flow
4. Payment UI — multiple tiers confuse users
5. Chat limit enforcement — tracked but not blocked (402 error exists but needs frontend handling)

---

## PHASE-BY-PHASE IMPLEMENTATION PLAN

### PHASE 1: Creator pricing control (Days 1-2)

#### Task 1.1: Database migration
File: `backend/src/config/database.ts`

Add columns to `marketplace_listings`:
```sql
ALTER TABLE marketplace_listings
  ADD COLUMN IF NOT EXISTS payPerChatPriceCents INT DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS freeMessageLimit INT DEFAULT 3;
```

Update existing listings:
```sql
UPDATE marketplace_listings ml
SET 
  payPerChatPriceCents = COALESCE(
    (u."priceConfig"->>'defaultTierCents')::int,
    1000
  ),
  freeMessageLimit = COALESCE(
    (u."priceConfig"->>'freeMessageLimit')::int,
    3
  )
FROM "User" u
WHERE ml."creatorId" = u.id AND ml."payPerChatPriceCents" IS NULL;
```

#### Task 1.2: Backend API — pricing endpoints
File: `backend/src/modules/creator/creatorController.ts`

Update `setPricing()`:
- Accept `payPerChatPriceCents`, `subscriptionPriceCents`, `freeMessageLimit`
- Validate: $5-100 pay-per-chat, $10-500 subscription, 0-10 free messages
- Update both `User.priceConfig` and `marketplace_listings`

New endpoint: `GET /api/creator/pricing`
- Return current pricing from `marketplace_listings` or `User.priceConfig`

#### Task 1.3: Onboarding pricing page
File: `frontend/react-app/src/pages/OnboardingPricingPage.tsx` (NEW)

Flow: `quiz → content → pricing → plan → deploy`

UI:
- Pay-per-chat input ($5-100)
- Monthly subscription input ($10-500)
- Free preview messages (0-10)
- Save → proceed to plan selection

Update onboarding router:
- Add `'pricing'` step between `'content'` and `'plan'`
- Update `useOnboardingGuard` to handle new step

#### Task 1.4: Settings pricing tab
File: `frontend/react-app/src/pages/SettingsPage.tsx`

Add "Pricing" tab:
- Same form as onboarding
- Show earnings summary (this month)
- Revenue split display (75/25)

---

### PHASE 2: Free tier restrictions (Day 3)

#### Task 2.1: Backend — block marketplace for free tier
File: `backend/src/modules/marketplace/listingController.ts`

In `upsertListing()`:
```typescript
if (user.planTier === 'free' && !user.trialActive) {
  return res.status(403).json({
    error: 'Upgrade to Starter plan to list on marketplace',
  });
}
```

Auto-hide on downgrade:
- Webhook handler: `customer.subscription.deleted`
- If tier becomes 'free' → set `isPublic = false` on listing

#### Task 2.2: Frontend — free tier UI
File: `frontend/react-app/src/pages/MarketplaceManagePage.tsx`

- Disable `isPublic` toggle for free tier
- Show banner: "Upgrade to Starter plan to list on marketplace"
- Hide marketplace section in dashboard for free tier

File: `frontend/react-app/src/pages/DashboardPage.tsx`
- Show upgrade CTA banner for free tier

#### Task 2.3: Onboarding flow update
File: `backend/src/modules/creator/creatorController.ts` (trial start)

When free trial selected:
- Skip marketplace listing creation
- `onboardingStep = 'deploy'` (skip Stripe Connect)

When paid plan selected:
- Auto-create marketplace listing with `isPublic = true`
- Use pricing from onboarding step

---

### PHASE 3: Stripe Connect onboarding (Days 4-5)

#### Task 3.1: New onboarding step
File: `frontend/react-app/src/pages/OnboardingStripeConnectPage.tsx` (NEW)

UI:
- "Connect Stripe Account" button
- OAuth flow explanation
- "Skip for now" option (can connect later)

Flow:
- Only for paid tiers (after plan selection)
- If free trial → skip this step
- After connection → `onboardingStep = 'deploy'`

#### Task 3.2: Backend — onboarding step logic
File: `backend/src/modules/creator/creatorController.ts`

Update onboarding check:
```typescript
if (user.planTier !== 'free' && !user.stripeConnectId && user.onboardingStep === 'plan') {
  // Set to stripe_connect step
  await db.query(`UPDATE "User" SET "onboardingStep" = 'stripe_connect' WHERE id = $1`, [userId]);
}
```

Stripe Connect callback:
- After OAuth success → update `stripeConnectId`
- Set `onboardingStep = 'deploy'`

#### Task 3.3: Update onboarding router
File: `frontend/react-app/src/hooks/useOnboardingGuard.ts`

Add `'stripe_connect'` to valid steps:
```typescript
const ONBOARDING_STEPS = ['quiz', 'content', 'pricing', 'plan', 'stripe_connect', 'deploy', 'done'];
```

Conditional routing:
- Free tier: `plan → deploy`
- Paid tier: `plan → stripe_connect → deploy`

---

### PHASE 4: Payment UI refactor (Day 6)

#### Task 4.1: Refactor PaymentPrompt component
File: `frontend/react-app/src/components/PaymentPrompt.tsx`

Change from:
- Multiple tier buttons ($5, $10, $25)
- Subscription at bottom

To:
- 2-tab design: "Pay Once" | "Subscribe"
- Tab 1: Single pay-per-chat price (creator's price)
- Tab 2: Monthly subscription price
- Clear value props for each option

Key changes:
1. Remove tier selection dropdown
2. Use `marketplace_listings.payPerChatPriceCents` (single price)
3. Show creator's subscription price from `marketplace_listings.subscriptionPriceCents`
4. Add comparison: "Save 60% with subscription"

#### Task 4.2: Backend — use creator prices
File: `backend/src/modules/payments/payPerChatController.ts`

Update `createPaymentIntent()`:
- Use `marketplace_listings.payPerChatPriceCents` instead of tier selection
- Validate amount matches creator's price

File: `backend/src/modules/public/publicController.ts`

Update `publicChat()` response:
- Return single `payPerChatPriceCents` from listing
- Remove tier array

---

### PHASE 5: Chat limit enforcement (Day 7)

#### Task 5.1: Frontend — handle 402 errors
File: `frontend/react-app/src/pages/PublicChatPage.tsx`

Add error handling:
```typescript
if (error.status === 402 && error.errorCode === 'CREATOR_PLAN_LIMIT') {
  // Show ChatLimitModal to creator
  // Show "Creator unavailable" to visitor
}
```

File: `frontend/react-app/src/components/ChatLimitModal.tsx` (NEW)

Modal for creator:
- "You've reached your monthly limit"
- Show usage: "4,200 / 5,000 chats"
- Upgrade CTA button

#### Task 5.2: Backend — ensure 402 is returned
File: `backend/src/modules/public/publicController.ts`

Already implemented (lines 489-519), verify:
- Returns 402 when `used >= limit`
- Includes `errorCode: 'CREATOR_PLAN_LIMIT'`
- Includes `upgradeUrl`

File: `backend/src/modules/widget/widgetController.ts`

Same check exists (lines 86-95), verify consistency.

#### Task 5.3: Visitor error message
File: `frontend/react-app/src/pages/PublicChatPage.tsx`

When visitor hits limit:
- Show: "This creator has reached their monthly chat limit. Please try again later."
- Hide chat input
- Show creator's profile link

---

### PHASE 6: Testing & polish (Day 8)

#### Task 6.1: End-to-end tests
Test scenarios:
1. Creator onboarding:
   - Signup → Quiz → Content → Pricing → Plan → Stripe Connect → Deploy
   - Verify pricing saved to `marketplace_listings`
2. Free tier:
   - Start free trial → Marketplace toggle disabled
   - Try to create listing → 403 error
3. Paid tier:
   - Select paid plan → Stripe Connect required
   - Connect Stripe → Marketplace listing auto-created
4. Visitor payment:
   - 3 free messages → Paywall shows
   - Pay-per-chat: Single price shown (not tiers)
   - Subscription: Monthly price shown
   - Payment succeeds → 24h access
5. Chat limits:
   - Creator at limit → 402 error
   - Creator sees upgrade modal
   - Visitor sees "unavailable" message

#### Task 6.2: Database cleanup
Migration script:
- Set default prices for existing creators
- Migrate `priceConfig.defaultTierCents` → `marketplace_listings.payPerChatPriceCents`
- Set `freeMessageLimit = 3` for all

#### Task 6.3: Documentation
Update:
- Creator onboarding guide
- Pricing settings help
- Marketplace listing requirements

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Creator pricing (Days 1-2)
- [ ] Database migration: Add `payPerChatPriceCents`, `freeMessageLimit` to `marketplace_listings`
- [ ] Backend: Update `setPricing()` to save to marketplace_listings
- [ ] Backend: Create `GET /api/creator/pricing` endpoint
- [ ] Frontend: Create `OnboardingPricingPage.tsx`
- [ ] Frontend: Update onboarding router (add 'pricing' step)
- [ ] Frontend: Add Pricing tab in SettingsPage
- [ ] Test: Creator can set prices in onboarding
- [ ] Test: Creator can update prices in settings

### Phase 2: Free tier restrictions (Day 3)
- [ ] Backend: Block marketplace listing creation for free tier
- [ ] Backend: Auto-hide listing on downgrade (webhook)
- [ ] Frontend: Disable marketplace toggle for free tier
- [ ] Frontend: Show upgrade banner in dashboard
- [ ] Frontend: Hide marketplace section for free tier
- [ ] Test: Free tier cannot create listing
- [ ] Test: Trial expiry → listing hidden

### Phase 3: Stripe Connect onboarding (Days 4-5)
- [ ] Frontend: Create `OnboardingStripeConnectPage.tsx`
- [ ] Backend: Add 'stripe_connect' step logic
- [ ] Backend: Update onboarding step after Stripe Connect
- [ ] Frontend: Update onboarding router (conditional: free vs paid)
- [ ] Frontend: Add skip option for Stripe Connect
- [ ] Test: Paid tier → Stripe Connect required
- [ ] Test: Free tier → Skip Stripe Connect

### Phase 4: Payment UI (Day 6)
- [ ] Frontend: Refactor `PaymentPrompt.tsx` to 2-tab design
- [ ] Frontend: Remove tier selection, show single price
- [ ] Frontend: Show creator's subscription price
- [ ] Backend: Update payment intent to use creator's price
- [ ] Test: Paywall shows single pay-per-chat price
- [ ] Test: Subscription tab shows monthly price

### Phase 5: Chat limits (Day 7)
- [ ] Frontend: Create `ChatLimitModal.tsx`
- [ ] Frontend: Handle 402 error in PublicChatPage
- [ ] Frontend: Show upgrade modal to creator
- [ ] Frontend: Show "unavailable" to visitor
- [ ] Backend: Verify 402 error returned correctly
- [ ] Test: Creator at limit → upgrade modal
- [ ] Test: Visitor at limit → unavailable message

### Phase 6: Testing (Day 8)
- [ ] End-to-end: Full creator onboarding flow
- [ ] End-to-end: Visitor payment flow
- [ ] End-to-end: Chat limit enforcement
- [ ] Database: Migrate existing creators
- [ ] Documentation: Update help center

---

## FILES TO CREATE/MODIFY

### New files
1. `frontend/react-app/src/pages/OnboardingPricingPage.tsx`
2. `frontend/react-app/src/pages/OnboardingStripeConnectPage.tsx`
3. `frontend/react-app/src/components/ChatLimitModal.tsx`
4. `frontend/react-app/src/components/PricingSettingsTab.tsx` (optional, can be in SettingsPage)

### Files to modify
1. `backend/src/config/database.ts` — Add migration SQL
2. `backend/src/modules/creator/creatorController.ts` — Pricing API, onboarding logic
3. `backend/src/modules/marketplace/listingController.ts` — Free tier block
4. `backend/src/modules/payments/payPerChatController.ts` — Use creator price
5. `backend/src/modules/public/publicController.ts` — Return single price
6. `backend/src/modules/billing/stripeController.ts` — Webhook: downgrade handling
7. `frontend/react-app/src/pages/SettingsPage.tsx` — Add Pricing tab
8. `frontend/react-app/src/pages/OnboardingPlanPage.tsx` — Update flow
9. `frontend/react-app/src/pages/OnboardingDeployPage.tsx` — Handle new steps
10. `frontend/react-app/src/components/PaymentPrompt.tsx` — 2-tab refactor
11. `frontend/react-app/src/pages/PublicChatPage.tsx` — Error handling, single price
12. `frontend/react-app/src/hooks/useOnboardingGuard.ts` — Add 'pricing', 'stripe_connect' steps
13. `frontend/react-app/src/pages/MarketplaceManagePage.tsx` — Free tier restrictions
14. `frontend/react-app/src/pages/DashboardPage.tsx` — Upgrade banner

---

## CRITICAL DECISIONS

1. Pricing storage: Use `marketplace_listings` (Option A) — single source of truth
2. Onboarding flow:
   - Free tier: `quiz → content → pricing → plan → deploy`
   - Paid tier: `quiz → content → pricing → plan → stripe_connect → deploy`
3. Payment UI: 2-tab design (Pay Once | Subscribe) — simpler UX
4. Chat limits: Hard block (402 error) — simpler for Phase 1
5. Stripe Connect: Required for paid tiers, skip allowed (can connect later)

---

## SUCCESS CRITERIA

Before launch:
- Creator can set own prices (onboarding + settings)
- Free tier blocked from marketplace
- Stripe Connect step in onboarding (paid tiers)
- Payment UI shows single creator price (2-tab design)
- Chat limits enforced (402 error + frontend handling)
- End-to-end flow works: signup → pricing → payment → payout

---

## ESTIMATED TIMELINE

- Phase 1: 2 days (Creator Pricing)
- Phase 2: 1 day (Free Tier)
- Phase 3: 2 days (Stripe Connect)
- Phase 4: 1 day (Payment UI)
- Phase 5: 1 day (Chat Limits)
- Phase 6: 1 day (Testing)

Total: 8 days of focused work

---

Ready to start. Which phase should we begin with?