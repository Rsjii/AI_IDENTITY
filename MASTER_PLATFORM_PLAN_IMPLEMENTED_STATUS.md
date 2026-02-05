# SELFLYX — MASTER PLATFORM PLAN (IMPLEMENTATION STATUS)

This doc is an **implementation status + code map** for `MASTER_PLATFORM_PLAN.md`.

- **Does not modify** `MASTER_PLATFORM_PLAN.md`
- **Source of truth**: current repo code (frontend + backend)
- **Goal**: quickly answer “what’s done, where is it, what’s still left”

Last updated: 2026-02-04

---

## 0) The 8 Issues — Status

### 1) Invalid `/@xyz` or `/chat/xyz` opens even if creator doesn't exist → 404
- **Status**: ✅ DONE
- **Frontend**:
  - `frontend/react-app/src/pages/PublicChatPage.tsx` (creator fetch handles 404 → `NotFoundCreator`)
  - `frontend/react-app/src/pages/CreatorPublicProfile.tsx` (same pattern)
  - `frontend/react-app/src/components/NotFoundCreator.tsx`
- **Backend**:
  - `backend/src/modules/public/publicController.ts` (`getCreator()` returns 404 when creator missing)

### 2) Payment flow unclear — subscription vs pay-per-chat
- **Status**: ✅ DONE (hybrid paywall: pay-per-chat + subscription)
- **Pay-per-chat**:
  - Frontend paywall UI: `frontend/react-app/src/components/PaymentPrompt.tsx`
  - Public chat gating: `frontend/react-app/src/pages/PublicChatPage.tsx`
  - Backend pay-per-chat: `backend/src/modules/public/publicController.ts` + `backend/src/modules/payments/payPerChatController.ts`
- **Subscription (monthly)**:
  - Marketplace subscription checkout: `backend/src/modules/marketplace/subscriptionController.ts` (`createSubscriptionCheckout`)
  - Chat paywall “Subscribe monthly”: `frontend/react-app/src/components/PaymentPrompt.tsx`
  - Chat bypass if subscribed: `backend/src/modules/public/publicController.ts` (`publicChat`, `publicMessageLimit`)
  - Unlock teaser after checkout: `POST /api/public/unlock-by-subscription`
    - Backend: `backend/src/modules/public/publicController.ts` (`unlockBySubscription`)
    - Route: `backend/src/modules/public/publicRoutes.ts`

### 3) Chat disconnected; end users forced through creator onboarding
- **Status**: ✅ DONE
- **Key change**: `userType` = `'creator' | 'visitor'`
- **Frontend**:
  - Fork screen: `frontend/react-app/src/pages/ChooseTypePage.tsx` (route `/choose-type`)
  - Auth flow & redirects: `frontend/react-app/src/pages/AuthPage.tsx`, `frontend/react-app/src/components/ProtectedRoute.tsx`
  - `MeUser.userType`: `frontend/react-app/src/contexts/AuthContext.tsx`

### 4) Can't click creator name to see profile
- **Status**: ✅ DONE
- **Frontend**:
  - Header click opens modal: `frontend/react-app/src/pages/PublicChatPage.tsx`
  - Modal: `frontend/react-app/src/components/CreatorProfileModal.tsx`

### 5) No discovery: need `/explore` + Landing “Meet the AIs”
- **Status**: ✅ DONE (using Marketplace listings as Explore directory)
- **Frontend**:
  - Route `/explore` → `frontend/react-app/src/pages/MarketplacePage.tsx`
  - Landing “Meet the AIs” section:
    - `frontend/react-app/src/pages/LandingPage.tsx`
    - Fetch: `/api/marketplace/listings?...&featured=true`
- **Backend**:
  - Public listings: `backend/src/modules/marketplace/listingController.ts` (`getPublicListings`)
- **Featured/opt-in**:
  - DB flag: `marketplace_listings.isFeatured` in `backend/src/config/database.ts`
  - Creator toggle: `frontend/react-app/src/pages/MarketplaceManagePage.tsx`

### 6) End user conversation history across all creators → `/my-chats`
- **Status**: ✅ DONE
- **Frontend**:
  - Route `/my-chats`: `frontend/react-app/src/pages/MyChatsPage.tsx`
- **Backend**:
  - Conversations API: `backend/src/modules/conversations/conversationsRoutes.ts`
  - Logic: `backend/src/modules/conversations/conversationsController.ts` (`getUserConversations`, etc.)

### 7) Creator sees full chats + transparency notice
- **Status**: ✅ DONE (Phase 1 behavior)
- **Creator conversations**:
  - UI list: `frontend/react-app/src/pages/CreatorConversationsPage.tsx` (`/conversations`)
  - Detail view: `frontend/react-app/src/pages/CreatorConversationDetailPage.tsx`
  - Backend: `backend/src/modules/creator/creatorRoutes.ts` + `backend/src/modules/creator/creatorController.ts`
- **Transparency notice**:
  - `frontend/react-app/src/pages/PublicChatPage.tsx` (one-time banner, stored in localStorage)

### 8) “What else to add?” items (profile, nav polish, subscription mgmt, daily free reset)
- **Status**: ✅ DONE for Phase-1 scope (see sections below)

---

## 1) Core Fix: Two User Types
- **DB column**: `User.userType` is added in `backend/src/config/database.ts`
- **Fork route**: `/choose-type` in `frontend/react-app/src/App.tsx`
- **Guard behavior**: `frontend/react-app/src/components/ProtectedRoute.tsx`

---

## 2) Bug: Invalid Route → 404
- **Done** for `/chat/:slug` and `/@:handle`
- **NotFound component**: `frontend/react-app/src/components/NotFoundCreator.tsx`

---

## 3) Auth Flow Fork (Creator vs Visitor)
- **Done**
- **Frontend files**:
  - `frontend/react-app/src/pages/AuthPage.tsx`
  - `frontend/react-app/src/pages/ChooseTypePage.tsx`
  - `frontend/react-app/src/components/ProtectedRoute.tsx`

---

## 4) Payment Flow

### 4.1 Hybrid: Pay‑Per‑Chat + Subscription
- **Done**
- **Pay-per-chat**: Stripe Payment Element flow in `PaymentPrompt`
- **Subscription**: Marketplace subscription checkout + chat integration

### 4.2 Creator configures monetization
- **Pay-per-chat pricing config**:
  - Creator settings API: `POST /api/creator/pricing` (`backend/src/modules/creator/creatorController.ts` → `setPricing`)
  - UI: `frontend/react-app/src/pages/SettingsPage.tsx` (payment settings section)
- **Subscription price + listing visibility** (directory subscription):
  - Creator listing management: `frontend/react-app/src/pages/MarketplaceManagePage.tsx`
  - Backend upsert: `backend/src/modules/marketplace/listingController.ts` (`upsertListing`)

### 4.3 End user paywall shows BOTH options
- **Done**
- **UI**: `frontend/react-app/src/components/PaymentPrompt.tsx`

### 4.4 Daily free reset (24h)
- **Done**
- **Backend**: `backend/src/modules/public/publicController.ts` (`ensureDailyFreeReset`)

### 4.5 Subscription flow in chat (key behavior)
- **Done**
- **Bypass paywall**: `backend/src/modules/public/publicController.ts`
- **Unlock teaser after checkout**: `POST /api/public/unlock-by-subscription`

### 4.6 Subscription management (end-user side)
- **Done (Phase-1)**: list + cancel-at-period-end trigger
- **Frontend**:
  - `/my-profile` page: `frontend/react-app/src/pages/MyProfilePage.tsx`
- **Backend**:
  - `GET /api/user/subscriptions`: `backend/src/modules/user/userRoutes.ts` → `listMySubscriptions()`
  - Cancel:
    - `POST /api/marketplace/subscriptions/cancel`
    - Now calls Stripe `cancel_at_period_end` (if stripeSubscriptionId exists)

### 4.7 Stripe Connect payouts
- **Partially DONE**
- **Connect UX exists**:
  - Backend: `backend/src/modules/creator/creatorController.ts` (`connectStripeAccount`, `getStripeConnectStatus`)
  - UI: `frontend/react-app/src/pages/SettingsPage.tsx` (Billing tab → Stripe Connect card)
- **Note**: actual automated payout transfers are still marked TODO in code.

---

## 5) End User Journey
- **Core journey supported**:
  - Guest chat with visitorId persistence: `frontend/react-app/src/pages/PublicChatPage.tsx`
  - Login optional; guest session claim after login:
    - Frontend: `PublicChatPage.tsx` stores pending ids
    - Auth refresh claims: `frontend/react-app/src/contexts/AuthContext.tsx`
    - Backend: `POST /api/public/claim-session`
  - `/my-chats` lists cross-creator history

---

## 6) Creator Journey
- **Done for Phase-1**:
  - Onboarding flow + dashboard
  - Monetization config (pay-per-chat) + listing management (subscription)
  - Conversations view (creator can read full threads)

---

## 7) Connecting Chat to Website

### 7.1 Landing page “Meet the AIs”
- **Done**: `frontend/react-app/src/pages/LandingPage.tsx`
- **Featured flag**:
  - DB: `backend/src/config/database.ts` (`marketplace_listings.isFeatured`)
  - Creator UI: `frontend/react-app/src/pages/MarketplaceManagePage.tsx`

### 7.2 `/explore` directory
- **Done** (implemented as Marketplace listings):
  - Route `/explore`: `frontend/react-app/src/pages/MarketplacePage.tsx`
  - API: `GET /api/marketplace/listings`

### 7.3 Navigation by user type
- **Done**:
  - `frontend/react-app/src/components/Navbar.tsx`

### 7.4 Creator public profile `/@:handle`
- **Done**: `frontend/react-app/src/pages/CreatorPublicProfile.tsx`

### 7.5 Creator name clickable in chat → profile modal
- **Done**: `PublicChatPage.tsx` + `CreatorProfileModal.tsx`

---

## 8) End User Conversation History `/my-chats`
- **Done**
- `frontend/react-app/src/pages/MyChatsPage.tsx`
- Backend: `backend/src/modules/conversations/*`

---

## 9) Creator Visibility & Analytics
- **Done (baseline analytics + conversations)**
- **Transparency notice** is implemented
- **Creator Dashboard** shows analytics from `/api/creator/dashboard`:
  - Backend: `backend/src/modules/creator/creatorController.ts` (`dashboard`)
  - UI: `frontend/react-app/src/pages/CreatorDashboardPage.tsx`
- **Subscriber stats**:
  - Backend now returns `subscribers.active`
  - UI shows revenue split + active subscriber count in Revenue tab
- **Subscriber list endpoint**:
  - `GET /api/creator/subscribers` implemented:
    - Routes: `backend/src/modules/creator/creatorRoutes.ts`
    - Handler: `backend/src/modules/creator/creatorController.ts` (`listSubscribers`)

---

## 10) End User Profile & Settings `/my-profile`
- **Done (Phase-1)**:
  - `/my-profile`: `frontend/react-app/src/pages/MyProfilePage.tsx`
  - Lists subscriptions via `GET /api/user/subscriptions`

---

## 11) Mobile Considerations
- Chat layout uses mobile drawer + info bottom sheet in `PublicChatPage.tsx`

---

## 12) Database Changes (as implemented)

### Implemented
- `User.userType` (core fix)
- `marketplace_listings` table exists
  - includes `isFeatured` now
- `marketplace_subscriptions` table exists
  - includes `cancelAtPeriodEnd`, `cancelledAt` now

### Not implemented (intentionally)
- Phase-2 privacy toggle enforcement (see “Remaining”)

---

## 13) API Changes (as implemented)

### Public
- `GET /api/public/creator/:slug`
- `POST /api/public/chat`
- `GET /api/public/message-limit`
- `GET /api/public/history`
- `POST /api/public/claim-session`
- `POST /api/public/unlock-by-subscription`

### User
- `GET /api/user/subscriptions`
- Conversations:
  - `GET /api/user/conversations`
  - `GET /api/user/conversations/:sessionId/message-limit`
  - etc. in `backend/src/modules/conversations/*`

### Creator
- `GET /api/creator/dashboard`
- `GET /api/creator/chats`
- `GET /api/creator/chats/:sessionId`
- `GET /api/creator/subscribers`
- Monetization config:
  - `POST /api/creator/pricing`

### Marketplace
- `GET /api/marketplace/listings` (+ `featured=true`)
- `POST /api/marketplace/listings` (upsert listing)
- `POST /api/marketplace/subscriptions/checkout`
- `GET /api/marketplace/subscriptions/status`
- `POST /api/marketplace/subscriptions/cancel` (Stripe cancel_at_period_end + DB update)

---

## 14) Frontend Routes (as implemented)
- `/chat/:slug` → `PublicChatPage`
- `/@:handle` → `CreatorPublicProfile`
- `/explore` → `MarketplacePage`
- `/my-chats` → `MyChatsPage`
- `/my-profile` → `MyProfilePage`
- `/choose-type` → `ChooseTypePage`
- `/conversations` → `CreatorConversationsPage`
- `/conversations/:sessionId` → `CreatorConversationDetailPage`

---

## 15) Remaining Work (what’s truly left)

### Optional / Phase 2
- **Privacy toggle enforcement**: allow end users to hide chats from creator (requires DB + enforcement in creator chat endpoints)

### Nice-to-have UI polish
- Creator dashboard UI can add a “Subscribers” screen using:
  - `GET /api/creator/subscribers`

---

## Notes
- `/explore` is implemented using **marketplace listings** (directory-style), not a separate `/api/explore/creators`.
- Stripe subscription cancellation now follows “cancel at period end” semantics (when Stripe subscription ID exists) and webhook sync updates status and periods.




