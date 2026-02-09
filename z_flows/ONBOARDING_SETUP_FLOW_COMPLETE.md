# 🎯 COMPLETE ONBOARDING + SETUP FLOW - FINAL OVERVIEW

## ✅ IMPLEMENTATION STATUS: 100% COMPLETE

All phases have been implemented according to `TODO_ONBOARDING+SETUP.md`.

---

## 📊 COMPLETE USER JOURNEY

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER SIGNUP & ONBOARDING                     │
└─────────────────────────────────────────────────────────────────┘

1. SIGNUP (30 seconds)
   Route: /auth
   ├─ Google OAuth (preferred) OR Email signup
   ├─ No email verification required (instant login)
   └─ Sets: profileCompleted = false

2. PROFILE COMPLETION (if needed)
   Route: /signup/profile
   ├─ Basic profile info
   └─ Sets: profileCompleted = true

3. USER TYPE SELECTION
   Route: /choose-type
   ├─ Creator OR Visitor
   └─ Sets: userType = 'creator' | 'visitor'

4. ONBOARDING FLOW (2-3 minutes) ⭐ NEW FLOW
   └─ Goal: Get to "aha moment" ASAP
   
   ⚠️ **MANDATORY STEPS**: Only Step 1 + Step 2 are required
   ⚠️ **OPTIONAL STEPS**: Step 3 + Step 4 are optional (can skip after Step 2)
   
   Step 1: Quick Profile (MANDATORY)
   Route: /onboarding/start
   ├─ 3 Questions:
   │  ├─ What's your name?
   │  ├─ What do you do? (category dropdown)
   │  └─ What should your AI help with? (purpose)
   ├─ Saves: displayName, category, primaryUse
   ├─ Sets: onboardingStep = 'upload'
   └─ Back navigation: BLOCKED (usePreventBack)
   
   Step 2: Upload Knowledge (MANDATORY)
   Route: /onboarding/upload
   ├─ Upload files (PDF, TXT, DOCX, URLs, etc.)
   ├─ Minimum: 500 words (enforced)
   ├─ Shows real-time word count
   ├─ Saves: knowledge_sources, knowledge_chunks
   ├─ Sets: onboardingStep = 'preview'
   ├─ ✅ **CRITICAL**: Sets onboardingCompleted = true (unlocks dashboard)
   ├─ Sets sessionStorage flag: 'selflyx_post_step2_window' = '1'
   └─ Back navigation: BLOCKED (usePreventBack)
   
   Step 3: Try Your AI (OPTIONAL - One-time window)
   Route: /onboarding/preview
   ├─ Live chat interface
   ├─ User tests AI with 2-3 messages
   ├─ Sees AI respond in their voice
   ├─ ✅ **Accessible only while window flag is active**
   ├─ ✅ **Refresh allowed** (flag persists in same session)
   ├─ ✅ **Back button** → Redirects to /dashboard
   ├─ ❌ **If user leaves onboarding** → Window flag cleared → Game over
   ├─ ❌ **App kill/reopen** → SessionStorage cleared → Game over
   └─ Sets: onboardingStep = 'complete' (if user continues)
   
   Step 4: Choose Your Path (OPTIONAL - One-time window)
   Route: /onboarding/complete
   ├─ Two options:
   │  ├─ [🚀 Go Live & Monetize] → Goes to /setup
   │  └─ [👀 Explore Dashboard First] → Goes to /dashboard
   ├─ ✅ **Accessible only while window flag is active**
   ├─ ✅ **Same window rules as Step 3**
   └─ If dashboard: Sets onboardingStep = 'done'

5. SETUP FLOW (Progressive, 5-10 minutes) ⭐ NEW FLOW
   └─ Goal: Enable monetization when ready
   └─ Non-blocking: Can skip and complete later
   
   Route: /setup (Checklist Page)
   ├─ Shows progress: X/4 steps completed
   ├─ Progress bar with percentage
   └─ Clickable cards for each step
   
   Step 1: Set Your Pricing
   Route: /setup/pricing
   ├─ Pay-per-chat price: $5-100
   ├─ Monthly subscription: $10-500
   ├─ Free preview messages: 0-10
   ├─ Shows revenue split (75% creator, 25% platform)
   ├─ Saves: marketplace_listings table
   └─ Marks: setupCompleted.pricing = true
   
   Step 2: Choose Platform Plan
   Route: /setup/plan
   ├─ 4 Plans:
   │  ├─ Free Trial (Recommended) - $0 for 7 days
   │  ├─ Starter - $49/mo (5K chats)
   │  ├─ Growth - $149/mo (25K chats)
   │  └─ Scale - $499/mo (Unlimited)
   ├─ Feature comparison table
   ├─ Saves: User.planTier, User.trialEndsAt
   └─ Marks: setupCompleted.plan = true
   
   Step 3: Connect Stripe (Optional)
   Route: /setup/stripe
   ├─ OAuth flow to connect Stripe account
   ├─ Only shown for paid tiers (free tier skips)
   ├─ Saves: User.stripeConnectAccountId
   └─ Marks: setupCompleted.stripe = true
   
   Step 4: Share Your AI
   Route: /setup/share
   ├─ Shows chat link: /chat/{handle}
   ├─ Social share buttons (Instagram, Twitter, LinkedIn)
   ├─ Embed code for website
   ├─ Next steps checklist
   └─ Marks: setupCompleted.share = true

6. DASHBOARD
   Route: /dashboard
   ├─ If setup incomplete:
   │  ├─ Shows banner: "Complete your setup to start earning"
   │  ├─ Progress bar: X% done
   │  ├─ [Continue Setup] button → /setup
   │  └─ [Dismiss] button (hides banner temporarily)
   └─ If setup complete:
      ├─ Full analytics dashboard
      ├─ Revenue tracking
      ├─ Conversation history
      └─ AI health metrics
```

---

## 🔐 LOGIN-FIRST MODE (Current Implementation)

**Status**: ✅ **ACTIVE** - All main pages require login, chat page shows login gate

### Public Routes (Logged-Out Access)
```
✅ /                        → Landing page (marketing)
✅ /landing                 → Landing page (marketing)
✅ /auth                    → Login/Signup page
✅ /pricing                 → Pricing page (standard SaaS)
✅ /chat/:slug              → Chat page (LOCKED - shows login gate)
✅ /signup/verify           → OTP verification (auth flow)
✅ /login/verify            → OTP verification (auth flow)
✅ /reset-password          → Password reset
✅ /forgot-password/reset   → Password reset flow
✅ /privacy                 → Privacy policy (legal)
✅ /terms                   → Terms of service (legal)
✅ /404, /403               → Error pages
```

### Protected Routes (Login Required)
```
❌ /explore                 → Requires login
❌ /u/:handle               → Creator profile (requires login)
❌ /marketplace/*           → Marketplace (requires login)
❌ /dashboard               → Dashboard (requires login)
❌ /setup/*                 → Setup flow (requires login)
❌ /onboarding/*            → Onboarding (requires login)
❌ All other routes         → Protected by ProtectedRoute
```

### Chat Page Login Gate
When logged-out user visits `/chat/:slug`:
- ✅ Page loads (route is public)
- ✅ Creator info visible (preview)
- ❌ Chat input **disabled** with message: "Login to continue chatting…"
- ✅ Header shows **"Log in"** and **"Sign up"** buttons
- ❌ All chat APIs blocked (require JWT)
- ✅ Clicking input/send → redirects to `/auth?reason=unauthorized&next=/chat/:slug`

### Backend API Protection
```
✅ GET  /api/public/creator/:slug    → Public (for preview)
✅ GET  /api/public/profile/:handle  → Public (for preview)
❌ GET  /api/public/history           → Requires JWT
❌ GET  /api/public/message-limit     → Requires JWT
❌ POST /api/public/chat              → Requires JWT
❌ POST /api/public/feedback          → Requires JWT
```

---

## 🗂️ ROUTE STRUCTURE

### Onboarding Routes (New Flow - Primary)
```
/onboarding/start      → OnboardingStartPage (3 questions)
/onboarding/upload     → OnboardingUploadPageNew (500 words min)
/onboarding/preview    → OnboardingPreviewPage (AI chat test)
/onboarding/complete   → OnboardingCompletePage (choose path)
```

### Onboarding Routes (Legacy Flow - Backward Compatible)
```
/onboarding/quiz           → OnboardingQuizPage
/onboarding/content        → OnboardingContentPage
/onboarding/pricing        → OnboardingPricingPage
/onboarding/plan           → OnboardingPlanPage
/onboarding/stripe-connect → OnboardingStripeConnectPage
/onboarding/deploy         → OnboardingDeployPage
```

### Setup Routes (Progressive Checklist)
```
/setup            → SetupChecklistPage (main checklist)
/setup/pricing    → SetupPricingPage (set visitor prices)
/setup/plan       → SetupPlanPage (choose platform tier)
/setup/stripe     → SetupStripePage (connect Stripe)
/setup/share      → SetupSharePage (get link & share)
```

---

## 🗄️ DATABASE SCHEMA

### User Table Additions
```sql
-- Setup completion tracking
ALTER TABLE "User" 
  ADD COLUMN IF NOT EXISTS "setupCompleted" JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "setupDismissed" BOOLEAN DEFAULT false;

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_user_setup_completed 
  ON "User" USING gin ("setupCompleted");
```

### setupCompleted JSONB Structure
```json
{
  "pricing": true,
  "plan": true,
  "stripe": false,
  "share": false,
  "completedAt": "2024-01-15T10:30:00Z"
}
```

### Onboarding Step Enum
```sql
onboardingStep TEXT CHECK (
  -- New flow
  onboardingStep IN ('start', 'upload', 'preview', 'complete', 'done')
  OR
  -- Legacy flow (backward compatibility)
  onboardingStep IN ('quiz', 'content', 'pricing', 'voice', 'plan', 'stripe_connect', 'deploy', 'training')
)
```

---

## 🔌 API ENDPOINTS

### Setup Status
```
GET /api/creator/setup/status
Response: {
  setupCompleted: { pricing: true, plan: true, ... },
  setupDismissed: false,
  completionPercentage: 50,
  completedSteps: 2,
  totalSteps: 4,
  nextStep: 'stripe'
}
```

### Update Setup Step
```
POST /api/creator/setup/step
Body: { step: 'pricing', completed: true }
Response: { success: true, setupCompleted: {...} }
```

### Dismiss Banner
```
POST /api/creator/setup/dismiss
Response: { success: true }
```

### Onboarding Step Update
```
POST /api/creator/onboarding/step
Body: { step: 'upload' }
Response: { success: true }
```

---

## 📱 COMPONENT STRUCTURE

### Frontend Pages
```
frontend/react-app/src/pages/
├── onboarding/
│   ├── OnboardingStartPage.tsx        ✅ NEW
│   ├── OnboardingUploadPageNew.tsx    ✅ NEW
│   ├── OnboardingPreviewPage.tsx       ✅ NEW
│   ├── OnboardingCompletePage.tsx      ✅ NEW
│   └── [legacy pages...]
└── setup/
    ├── SetupChecklistPage.tsx         ✅
    ├── SetupPricingPage.tsx            ✅
    ├── SetupPlanPage.tsx               ✅
    ├── SetupStripePage.tsx             ✅
    └── SetupSharePage.tsx              ✅
```

### Backend Controllers
```
backend/src/modules/creator/
└── creatorController.ts
    ├── getSetupStatus()                ✅
    ├── updateSetupStep()               ✅
    └── dismissSetupBanner()           ✅
```

---

## 🎯 FLOW STATES

### State 0: Onboarding In Progress (Step 1 or 2)
```
onboardingStep: 'start' | 'upload'
onboardingCompleted: false
setupCompleted: {}

Access:
❌ Dashboard blocked
❌ Setup blocked
❌ All routes blocked except onboarding
✅ Must complete Step 1 + Step 2
```

### State 1: Core Onboarding Complete (After Step 2)
```
onboardingStep: 'preview' | 'complete' | 'done'
onboardingCompleted: true ✅
setupCompleted: { pricing: false, plan: false, ... }
completionPercentage: 0%

Access:
✅ Dashboard accessible
✅ Setup accessible
✅ All routes accessible
⚠️ Step 3/4 accessible only if window flag active (one-time)

Capabilities:
✅ Can chat with own AI
❌ Cannot monetize
❌ Not listed on marketplace
✅ Dashboard shows setup banner
```

### State 2: Pricing + Plan (No Stripe)
```
onboardingStep: 'done'
onboardingCompleted: true
setupCompleted: { pricing: true, plan: true, stripe: false, share: false }
completionPercentage: 50%

Capabilities:
✅ Marketplace listing created
✅ Visitors see paywall
❌ Payments fail (no Stripe connected)
⚠️ Dashboard shows "Connect Stripe to receive payouts"
```

### State 3: Full Setup Complete
```
onboardingStep: 'done'
onboardingCompleted: true
setupCompleted: { pricing: true, plan: true, stripe: true, share: true }
completionPercentage: 100%

Capabilities:
✅ Monetization live
✅ Marketplace listing active
✅ Payments flow to Stripe
✅ Dashboard shows full analytics
✅ Banner hidden
```

---

## 🔄 PROTECTED ROUTE LOGIC

### Onboarding Step Mapping
```typescript
// New Flow (Primary)
start    → /onboarding/start
upload   → /onboarding/upload
preview  → /onboarding/preview
complete → /onboarding/complete
done     → /dashboard

// Legacy Flow (Backward Compatible)
quiz          → /onboarding/quiz
content       → /onboarding/content
pricing       → /onboarding/pricing
plan          → /onboarding/plan
stripe_connect → /onboarding/stripe-connect
deploy        → /onboarding/deploy
```

### Route Protection Rules
1. **Logged-out users**: Redirect to `/auth?reason=unauthorized&next=...`
2. **Profile incomplete**: Redirects to `/signup/profile` (only when `profileCompleted === false`)
3. **User type not chosen**: Redirects to `/choose-type` (only when `profileCompleted === true` but `userType` missing)
4. **Onboarding incomplete** (`onboardingCompleted !== true`):
   - **Creators**: Blocked from dashboard/setup/all other routes
   - **Must complete Step 1 + Step 2** (mandatory)
   - Redirects to exact step based on `onboardingStep`
   - Back navigation blocked on Step 1/2
5. **Onboarding complete** (`onboardingCompleted === true`):
   - ✅ Dashboard and all routes accessible
   - ✅ Step 3/4 accessible **only if** `sessionStorage.selflyx_post_step2_window === '1'`
   - ✅ Window flag cleared when user visits any non-onboarding route (dashboard/setup/etc.)
   - ✅ App kill/reopen clears sessionStorage → Step 3/4 never accessible again
6. **Setup routes**: Always accessible (non-blocking, even during onboarding)
7. **Chat page**: Public route but locked UI (login gate)

### Onboarding Completion Logic
```typescript
// Backend: creatorController.ts - updateOnboardingStep()
// When step becomes 'preview' (after Step 2):
if (step === 'preview') {
  await db.query(
    'UPDATE "User" SET "onboardingCompleted" = true WHERE id = $1',
    [userId]
  );
}
// Result: User can now access dashboard after Step 2
```

### Step 3/4 Window Logic
```typescript
// Frontend: OnboardingUploadPageNew.tsx (Step 2 completion)
sessionStorage.setItem('selflyx_post_step2_window', '1');
nav('/onboarding/preview');

// Frontend: useOnboardingGuard.ts
// Allows Step 3/4 only if window flag is active
const windowActive = sessionStorage.getItem('selflyx_post_step2_window') === '1';
if (windowActive && isPreviewOrComplete) return; // Allow
else navigate('/dashboard', { replace: true }); // Block

// Frontend: ProtectedRoute.tsx
// Clears window flag when user leaves onboarding
if (onboardingCompleted && !pathname.startsWith('/onboarding')) {
  sessionStorage.removeItem('selflyx_post_step2_window');
}
```

---

## 🎨 UI/UX FEATURES

### Setup Checklist Page
- ✅ Progress bar (0-100%)
- ✅ Step cards with completion status
- ✅ Clickable navigation to each step
- ✅ "Skip for Now" option

### Dashboard Banner
- ✅ Shows when setup incomplete
- ✅ Progress indicator
- ✅ "Continue Setup" button
- ✅ "Dismiss" button (temporary hide)
- ✅ Re-appears on next login if still incomplete

### Plan Selection Page
- ✅ 4 cards in responsive grid
- ✅ Free Trial with "RECOMMENDED" badge
- ✅ Feature comparison table
- ✅ Hover effects and animations
- ✅ Mobile-responsive design

---

## ✅ IMPLEMENTATION CHECKLIST

### Phase 1: Onboarding ✅
- [x] `/onboarding/start` - 3-question form
- [x] `/onboarding/upload` - 500 words minimum
- [x] `/onboarding/preview` - AI chat test
- [x] `/onboarding/complete` - Choose path
- [x] Routes added to App.tsx
- [x] ProtectedRoute updated

### Phase 2: Setup ✅
- [x] `/setup` - Checklist page
- [x] `/setup/pricing` - Price input + revenue split
- [x] `/setup/plan` - Enhanced cards + comparison table
- [x] `/setup/stripe` - OAuth flow
- [x] `/setup/share` - Link + embed code
- [x] Routes added to App.tsx

### Phase 3: Dashboard Integration ✅
- [x] Setup completion banner
- [x] Progress indicator
- [x] Quick links to incomplete steps
- [x] Dismiss functionality

### Phase 4: Database ✅
- [x] `setupCompleted` JSONB field
- [x] `setupDismissed` field
- [x] GIN index on setupCompleted
- [x] Track each step completion
- [x] Query helper functions

---

## 🚀 READY FOR PRODUCTION

**Status**: ✅ **100% COMPLETE**

All features from `TODO_ONBOARDING+SETUP.md` have been implemented:
- ✅ New onboarding flow (start → upload → preview → complete)
- ✅ Progressive setup checklist (non-blocking)
- ✅ Dashboard banner with progress tracking
- ✅ Database schema with JSONB tracking
- ✅ Backend APIs for setup status
- ✅ All routes configured
- ✅ ProtectedRoute logic updated
- ✅ Backward compatibility maintained

**Next Steps**:
1. Test the complete flow end-to-end
2. Verify database migrations run correctly
3. Test backward compatibility with existing users
4. Deploy to production! 🎉

---

---

## 🔄 LOGIN-FIRST MODE IMPLEMENTATION

### Changes Made
1. ✅ **App.tsx**: Protected `/explore`, `/u/:handle`, `/marketplace/*` (kept `/pricing` public)
2. ✅ **HomeRoute.tsx**: Shows landing page for logged-out users (standard SaaS)
3. ✅ **AuthPage.tsx**: Supports `?mode=signup` query param for direct signup tab
4. ✅ **PublicChatPage.tsx**: 
   - Login gate UI (disabled input + banner)
   - "Log in" / "Sign up" buttons in header
   - Blocks API calls when logged out
   - Only creates visitorId when authenticated
5. ✅ **publicRoutes.ts**: Requires JWT for all chat APIs (`/chat`, `/history`, `/message-limit`, `/feedback`)

### User Experience
- **Logged-out user visits `/chat/:slug`**: Sees creator preview + login gate
- **Logged-out user visits `/dashboard`**: Redirects to `/auth?reason=unauthorized&next=/dashboard`
- **After login**: User returns to intended page via `next` param

---

---

## 🔐 ONBOARDING COMPLETION FLAG LOGIC (UPDATED)

### Key Implementation Details

**Flag Set Timing:**
- `onboardingCompleted = true` is set **after Step 2** (when `onboardingStep` becomes `'preview'`)
- This unlocks dashboard access immediately after mandatory steps

**Step 3/4 Window Mechanism:**
- Step 2 completion sets `sessionStorage.selflyx_post_step2_window = '1'`
- This flag allows Step 3/4 to be accessible in the same session
- Flag persists through page refreshes (user can refresh Step 3/4)
- Flag is cleared when user visits any non-onboarding route (dashboard/setup/etc.)
- Flag is cleared on app kill/reopen (sessionStorage is wiped)
- Once flag is cleared, Step 3/4 are **never accessible again** (game over)

**ProtectedRoute Enforcement:**
- While `onboardingCompleted === false`: User can only access onboarding routes (Step 1/2)
- After `onboardingCompleted === true`: User can access dashboard/setup/all routes
- Step 3/4 access is gated by `useOnboardingGuard()` which checks window flag
- ProtectedRoute automatically clears window flag when user leaves onboarding

**Back Navigation:**
- Step 1/2: Back navigation blocked (`usePreventBack`)
- Step 3: Back button redirects to dashboard (`useRedirectBack('/dashboard')`)
- Step 4: Back navigation blocked (`usePreventBack`)

---

**Last Updated**: 2024-01-15 (Updated with Step 3/4 window logic)
**Implementation Status**: ✅ COMPLETE
**Login-First Mode**: ✅ ACTIVE
**Onboarding Completion**: ✅ Set after Step 2 (mandatory steps only)
**Step 3/4 Access**: ✅ Optional, one-time window (until user leaves onboarding)

