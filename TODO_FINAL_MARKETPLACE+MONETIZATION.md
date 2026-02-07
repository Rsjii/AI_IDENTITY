Plan: main current `setup/*` pages + marketplace listing UI paths read karke exact “line-wise, file-wise” change list banaunga. Phir final decisions lock: free creators publish blocked (confirmed) + pay-per-chat monetization ke liye Stripe Connect required (industry standard marketplace).

[16 tools called]

### Final decisions (locked)
- **A) Free creators publish not allowed**: ✅ already your direction; keep it (marketplace publish + public discoverability locked behind Starter+ or active trial).
- **B) Pay‑per‑chat me Stripe chahiye ya nahi?**  
  **Final (standard marketplace practice): YES — Stripe (and Stripe Connect verification) required for any monetization you promise to pay out.**  
  Reason: your UI literally says **“Automatic 75/25 split”** (see `SetupStripePage.tsx` L89-L94). Without Connect verification you either:
  - can’t pay creators automatically, or  
  - you become “merchant of record” holding creator money (compliance + refunds + disputes + tax risk).  
  So: **subscriptions + pay‑per‑chat** → Connect verified required **before enabling monetization and before publish**.

---

## A→Z Final Flow (top‑notch, your codebase compatible)

### Phase 0 — Account gating (already)
- Signup → profile complete → choose type.
- Creator must pass onboarding Step1+Step2 (AI ready). Step3/4 optional (you already fixed back behaviour).

### Phase 1 — Draft listing (allowed for everyone)
- Creator can create/edit **draft** listing anytime.
- Even free tier can draft (recommended for upsell). **Publish** still blocked.

### Phase 2 — Monetization readiness (conditional)
Creator chooses what they want:
- **Enable subscriptions** (monthly)
- **Enable pay‑per‑chat** (24h access)
- (Optional growth mode) **Enable free chat preview** (limited)

Rules:
- If **subscriptions ON** → Connect verified required.
- If **pay‑per‑chat ON** → Connect verified required (since you show revenue split + creator earnings).
- If **free preview ON** → no payments required, but still publish blocked on free tier.

### Phase 3 — Publish (Marketplace)
- Publish button triggers backend checks.
- If fail → backend returns **error list** (missing pricing, missing connect, missing listing basics, free tier, etc.).
- If pass → listing becomes public, visible in marketplace, accessible by slug.

### Phase 4 — Share/Marketing (optional)
- Share link, embed widget etc. **Never** counted as “setup done”.

---

## Mandatory vs Optional (crystal clear)

### Mandatory to **Publish on Marketplace**
1) **Plan**: Starter/Growth/Scale OR trial active (free creators cannot publish)  
2) **Listing basics**: category + description (+ title + image once added)  
3) **Pricing**: at least one monetization mode enabled with valid price  
4) **Stripe Connect verified**: required if any monetization enabled (subs or pay‑per‑chat)

### Optional / Not mandatory
- Share page, social links, embed, marketing.

---

## What’s currently wrong in code (and what you will fix)

### 1) “Setup” steps are not trustworthy (UI-only)
Backend uses `User.setupCompleted` purely as stored JSON (see `creatorController.ts`):
- Steps are hardcoded: `['pricing','plan','stripe','share']` (`getSetupStatus` L911-L923)
- `updateSetupStep` accepts these steps only (`z.enum([...])` L934-L937)

Problem:
- `SetupSharePage` marks `share=true` just by opening the page (`SetupSharePage.tsx` L17-L26)
- `SetupStripePage` marks `stripe=true` just by `?success=1` (`SetupStripePage.tsx` L16-L35)

### 2) Marketplace publish only checks plan tier (missing prerequisites)
`listingController.upsertListing` only blocks free plan/trial for `isPublic=true` (see `listingController.ts` L214-L234).  
It does **not** enforce pricing/connect/listing completeness.

### 3) Pay‑per‑chat currently collects money without any connect enforcement
`payPerChatController.createPaymentIntent` only validates amount equals listing price (L59-L68). No plan/connect/publish gating.

---

# File‑wise, line‑wise change plan (A→Z)

## Backend changes

### (B1) `backend/src/config/database.ts` — extend marketplace_listings schema (around L794+)
Add columns (idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` just like you already do):
- **Listing basics**
  - `title` (TEXT)
  - `shortPitch` (TEXT)
  - `thumbnailUrl` (TEXT)
- **Monetization toggles**
  - `enableSubscriptions` BOOLEAN NOT NULL DEFAULT false
  - `enablePayPerChat` BOOLEAN NOT NULL DEFAULT false
  - `enableFreeChat` BOOLEAN NOT NULL DEFAULT true (or false; your call)
- **Publish state**
  - `publishStatus` TEXT NOT NULL DEFAULT 'draft' CHECK IN ('draft','ready','published','suspended')
  - `publishedAt` TIMESTAMPTZ

Why: today you only have `isPublic` and basic fields (see `marketplace_listings` create table L794-L812).

---

### (B2) `backend/src/modules/marketplace/listingController.ts`
#### (a) Update schema parsing (near `upsertListingSchema`)
Add new fields: title/shortPitch/thumbnailUrl, toggles, publishStatus (optional).
Currently schema only has `isPublic,isFeatured,category,subscriptionPriceCents,currency,freeTrialQuestions,description,tags,slug` (L19-L29).

#### (b) Add a **single source of truth validation function**:
When request tries to set **`isPublic=true`** (or publishStatus → published), run checks:
- plan eligible (already exists)
- listing basics present (category + description + title + thumbnailUrl)
- pricing/toggles valid:
  - if enableSubscriptions → subscriptionPriceCents > 0
  - if enablePayPerChat → payPerChatPriceCents > 0
  - at least one enabled
- Stripe Connect verified (see `creatorController.getStripeConnectStatus` L646-L662)
  - require `detailsSubmitted && payoutsEnabled`

Return error payload like:
- `errorCode: 'PUBLISH_PREREQ_FAILED'`
- `missing: ['pricing','stripe','listing_basics', ...]`

#### (c) Change free-tier behaviour
Right now you block marketplace listing entirely for free tier at the top (L214-L224).  
Recommended:
- Allow saving draft listing even on free tier
- Block only `isPublic=true` / `publishStatus='published'`

This improves conversion (users prepare listing then upgrade to publish).

---

### (B3) `backend/src/modules/payments/payPerChatController.ts`
Add gating at `createPaymentIntent` (before creating Stripe PI):
- creator plan must be eligible (Starter+ or trial)
- creator listing must be **published** (or at least `isPublic=true`)
- listing must have pay‑per‑chat enabled + price set
- creator Stripe Connect must be verified (same rule as subs)

Right now it only checks amount matches listing price (L59-L68).

---

### (B4) `backend/src/modules/creator/creatorController.ts` — make “setup status” real (lines ~900+)
Keep `setupCompleted` for UI, but add a new response section `setupRequirements` computed from real data:
- pricingConfigured: listing prices + toggles valid
- planEligible: planTier != free OR trialActive
- stripeVerified: from Connect status
- publishReady: all of the above + listing basics
- published: listing.isPublic true (or publishStatus published)

Also update setup steps list to:
- replace `'share'` with `'publish'`
- keep `'share'` optional (don’t count in completion percentage)

Where:
- `getSetupStatus` steps array currently hardcoded (L911-L923)
- `updateSetupStep` enum currently hardcoded (L934-L937)

---

## Frontend changes

### (F1) `frontend/react-app/src/pages/setup/SetupSharePage.tsx` (L17-L26)
Remove auto “markComplete on mount”. Sharing is optional marketing.  
Today it does:

- `useEffect(() => { markComplete(); }, [])` (L17-L19)
- posts `step:'share'` (L21-L26)

Fix: **no automatic completion**. If you still want a checkbox/button “I shared”, make it manual + optional.

---

### (F2) `frontend/react-app/src/pages/setup/SetupStripePage.tsx` (L16-L35)
Replace `?success=1` based completion with backend verification:
- On load: call `GET /api/creator/stripe/status`
- Only mark setup step complete when:
  - connected=true AND detailsSubmitted=true AND payoutsEnabled=true

Currently it marks complete purely from query param (L16-L35).

---

### (F3) `frontend/react-app/src/pages/setup/SetupChecklistPage.tsx` (steps array L30-L59)
Update steps:
- Add new **Publish** step (route `/setup/publish` or `/marketplace/manage` publish section)
- Make Share optional (don’t include in progress %)
- Show backend `missingRequirements` for each step (so user knows exactly what to do)

---

### (F4) `frontend/react-app/src/pages/MarketplaceManagePage.tsx`
This is your publish toggle UI:
- It currently sends `isPublic: form.isPublic` in `/api/marketplace/listings` (L63-L78) and only handles 403 upgrade errors (L81-L86).

Update behaviour:
- When user toggles public ON:
  - call backend publish endpoint (or same upsert but expect prereq errors)
  - display missing prerequisites errors (pricing, stripe connect, listing basics)
  - auto-navigate to `/setup` or specific step page.

---

# Detailed codebase overview (what’s happening today)
- **Marketplace listing storage**: `marketplace_listings` table (`database.ts` L794+). Minimal fields + pricing columns.
- **Publish**: `listingController.upsertListing` handles isPublic flag, but only plan gating (L214-L234).
- **Setup checklist**: purely `User.setupCompleted` JSON (`creatorController.getSetupStatus` L900+). Not validated.
- **Stripe connect**: backend has real status endpoint (`creatorController.getStripeConnectStatus` L646-L662), but setup UI is not using it.
- **Pay-per-chat**: charges via Stripe PaymentIntent (`payPerChatController.createPaymentIntent`), validates amount equals listing price, then records payment on confirm. No publish/connect gating yet.

---

## Next step
Aapne requirements lock kar diye, so next message me aap bolo **Agent mode ON** (kyunki ab actual code edits+testing chahiye). Main:
- DB migration additions
- backend publish prereq enforcement
- pay-per-chat gating
- setup pages fixes (Stripe verification + Share optional + Publish step)
- and then `tsc -b && vite build` + basic flows smoke test

Bol do “Agent mode karo, implement now” and I’ll ship the full patch.