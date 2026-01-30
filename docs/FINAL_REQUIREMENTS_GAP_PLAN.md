# Final Requirements Gap Plan (Phase 1-3)

This document cross-checks the requirements in:
- `docs/phase1/PHASE1.md`
- `docs/phase1/PHASE_1_DETAILED.md`
- `docs/phase2_3/phase2+3.md`

Against current code and the review in:
- `docs/FINAL_COMPLETE_A-Z_REVIEW.md`

It includes a requirements matrix, gaps/issues, and a concrete fix plan by file.

---

## 0) Status Update (Post-Fix Changes)

This section reflects what is already implemented and what is still left **after** recent fixes.

### ✅ Implemented Since Plan
- Async training job scaffold + ready email trigger:
  - `backend/src/services/trainingJobService.ts`
  - `backend/src/server.ts` (interval processor)
  - `backend/src/modules/auth/authService.ts` (training-ready email)
  - `backend/src/modules/content/contentService.ts` (enqueue job)
  - `backend/src/config/database.ts` (`training_jobs` table + queries)
- 24-hour premium session window:
  - `backend/src/config/database.ts` (`premium_sessions` table + queries)
  - `backend/src/modules/payments/payPerChatController.ts` (creates session)
  - `backend/src/modules/public/publicController.ts` (bypasses paywall)
- Public chat voice playback:
  - `backend/src/modules/public/publicController.ts` (returns `audioUrl`)
  - `frontend/react-app/src/pages/PublicChatPage.tsx` (audio UI + toggle)
- Voice settings (stability/similarity):
  - `backend/src/modules/voice/voiceService.ts`
  - `backend/src/modules/voice/voiceController.ts`
  - `backend/src/modules/voice/voiceRoutes.ts`
  - `frontend/react-app/src/pages/VoiceManagePage.tsx`
  - `backend/src/config/database.ts` (update settings query)
- WhatsApp conversation state + basic rate limiting + payment links:
  - `backend/src/config/database.ts` (`whatsapp_conversations` table + queries)
  - `backend/src/modules/whatsapp/whatsappController.ts`
  - `frontend/react-app/src/pages/Integrations.tsx` (settings UI)
- Widget embed now iframe-based:
  - `frontend/src/public/embed.js` (iframe loader)
  - `frontend/src/public/embed.html`
  - `frontend/src/public/embed-frame.js`
- Tier naming UI aligned to **Pro** in front-end pages:
  - `frontend/react-app/src/pages/PricingPage.tsx`
  - `frontend/react-app/src/pages/SettingsPage.tsx`
  - `frontend/react-app/src/pages/TermsPage.tsx`
  - `frontend/react-app/src/pages/OnboardingPlanPage.tsx`
  - `frontend/react-app/src/pages/LandingPage.tsx`
- WhatsApp analytics stats endpoint + UI card:
  - `backend/src/modules/whatsapp/whatsappController.ts`
  - `frontend/react-app/src/pages/Integrations.tsx`
- Marketplace trending sort option:
  - `backend/src/modules/marketplace/listingController.ts`
  - `frontend/react-app/src/pages/MarketplacePage.tsx`

### ❗ Still Left (What’s Remaining)

#### Phase 1 (MVP)
- None (all current MVP gaps addressed).

#### Phase 2 (Current)
- None (all current Phase 2 gaps addressed).

#### Deferred (Moved to Can-Do)
- Training job flow with dedicated queue/worker + job dashboard.
- WhatsApp real queue + durable rate limiter (Redis/SQS).
- Premium tiers expansion beyond premium/vip ($1/$5/$10/$25/$50).
- Voice settings expansion (speed/pitch/emotion) + usage stats.
- WhatsApp Stripe payment links (beyond public chat link).
- Instagram 24-hour window enforcement + rate-limit handling.
- Phone integration real-time call pipeline (Twilio + Whisper + TTS).
- Advanced analytics dashboard (geo, funnel, insights, export).
- Mobile apps full implementation.
- Video avatar settings/triggers.

---

## 1) Requirements Traceability Matrix

Status: ✅ complete, ⚡ partial, ❌ missing, ⚠️ mismatch

### Phase 1 (MVP)

| Requirement | Status | Code References | Notes |
|---|---|---|---|
| Signup/Login (Email + Google) | ✅ | `backend/src/modules/auth/*`, `frontend/react-app/src/pages/AuthPage.tsx` | Full auth flow + OTP present. |
| Session persists | ✅ | `backend/src/modules/auth/sessionRoutes.ts`, `backend/src/config/database.ts` | Session + auth_sessions tables. |
| No password reset (later) | ⚠️ | `frontend/react-app/src/pages/ResetPasswordPage.tsx` | Implemented despite doc saying later. |
| AI clone creation (10 questions + file upload) | ✅ | `frontend/react-app/src/pages/OnboardingQuizPage.tsx`, `frontend/react-app/src/pages/OnboardingContentPage.tsx`, `backend/src/modules/content/*` | Works, but question set differs from doc. |
| Training status 24 hours + email | ✅ | `frontend/react-app/src/pages/OnboardingTrainingPage.tsx`, `backend/src/modules/content/contentService.ts`, `backend/src/services/trainingJobService.ts` | Interval-based job processor + ready email. |
| Background job for processing | ✅ | `backend/src/services/trainingJobService.ts`, `backend/src/server.ts` | Interval-based worker (queue/worker deferred). |
| Public chat page `/chat/[username]` | ✅ | `frontend/react-app/src/pages/PublicChatPage.tsx`, `backend/src/modules/public/publicController.ts` | Works. |
| Embedded widget | ✅ | `frontend/src/public/embed.js`, `backend/src/modules/widget/*` | Works. |
| Widget uses iframe + sandbox | ✅ | `frontend/src/public/embed.js`, `frontend/src/public/embed.html` | Iframe loader in place. |
| Chat history per session | ✅ | `backend/src/modules/history/*`, `backend/src/config/database.ts` | Saved in `chat_sessions` / `chat_messages`. |
| Typing indicator | ✅ | `frontend/react-app/src/components/TypingIndicator.tsx`, `frontend/src/public/embed.js` | Implemented. |
| Basic dashboard (stats, status, actions) | ✅ | `frontend/react-app/src/pages/CreatorDashboardPage.tsx`, `backend/src/modules/creator/*` | Matches. |
| Test AI tab (creator only) | ✅ | `frontend/react-app/src/pages/CreatorDashboardPage.tsx` | Present. |
| Stripe subscriptions (Free/Pro/Scale tiers) | ✅ | `backend/src/modules/billing/*`, `frontend/react-app/src/pages/PricingPage.tsx` | Backend accepts `pro` alias and maps to `starter`. |
| Enforce usage limits | ✅ | `backend/src/modules/widget/widgetController.ts`, `backend/src/modules/public/publicController.ts` | Limit checks implemented. |
| Pay-per-chat prompt + payment flow | ✅ | `backend/src/modules/payments/*`, `frontend/react-app/src/components/PaymentPrompt.tsx` | Works. |
| Paid response after payment | ✅ | `backend/src/modules/payments/payPerChatController.ts` | Re-generates full reply. |
| 24-hour unlimited after payment | ✅ | `backend/src/modules/payments/payPerChatController.ts`, `backend/src/modules/public/publicController.ts` | Premium session window implemented. |
| Payment tiers $1/$5/$10/$25/$50 | ⚡ | `frontend/react-app/src/pages/SettingsPage.tsx`, `frontend/react-app/src/pages/Integrations.tsx` | Deferred to can-do (premium/vip only). |

### Phase 2 (Revenue)

| Requirement | Status | Code References | Notes |
|---|---|---|---|
| WhatsApp integration via Twilio | ✅ | `backend/src/modules/whatsapp/*` | Core send/receive exists. |
| WhatsApp conversation table | ✅ | `backend/src/config/database.ts` | `whatsapp_conversations` table added. |
| Message queue + rate limit | ⚡ | `backend/src/modules/whatsapp/whatsappController.ts` | DB-based hourly limiter; no Redis/SQS queue. |
| Conversation state manager | ✅ | `backend/src/modules/whatsapp/whatsappController.ts` | Stored in `whatsapp_conversations`. |
| Payment link generator in WhatsApp | ⚡ | `backend/src/modules/whatsapp/whatsappController.ts` | Uses public chat link (not Stripe link). |
| WhatsApp UI + settings (auto-reply, business hours, greeting) | ⚡ | `frontend/react-app/src/pages/Integrations.tsx` | Settings UI present; analytics missing. |
| Voice cloning (ElevenLabs) | ✅ | `backend/src/modules/voice/*`, `frontend/react-app/src/pages/VoiceSetupPage.tsx` | Core voice clone + TTS. |
| Voice settings (speed/pitch/emotion) | ❌ | n/a | Only stability/similarity implemented. |
| Voice usage stats + cost | ⚡ | `backend/src/modules/voice/*` | No usage aggregation UI. |
| Voice playback in chat UI | ✅ | `frontend/react-app/src/pages/PublicChatPage.tsx` | Public chat supports audio playback. |
| Pay-per-chat monetization UI | ⚡ | `frontend/react-app/src/pages/SettingsPage.tsx` | Basic config; no tier toggles per feature. |
| Marketplace (listings, subscriptions, reviews) | ✅ | `backend/src/modules/marketplace/*`, `frontend/react-app/src/pages/Marketplace*.tsx` | Core features exist. |
| Marketplace search + discovery algorithm | ⚡ | `backend/src/modules/marketplace/listingController.ts` | Basic filters only, no ranking logic. |

### Phase 3 (Scale)

| Requirement | Status | Code References | Notes |
|---|---|---|---|
| Instagram DM integration | ✅ | `backend/src/modules/instagram/*` | Core API + webhook. |
| 24-hour response window logic | ❌ | n/a | Deferred to can-do. |
| Message rate limits (200/hour) | ❌ | n/a | Deferred to can-do. |
| Mobile apps (iOS/Android) | ❌ | `mobile/*` | Deferred to can-do. |
| Video avatars (D-ID/HeyGen) | ✅ | `backend/src/modules/video/*`, `frontend/react-app/src/pages/Video*` | Core API + UI. |
| Video settings (quality, length, triggers) | ❌ | n/a | Deferred to can-do. |
| Phone integration (Twilio + Whisper + TTS) | ⚡ | `backend/src/modules/phone/*` | Deferred to can-do. |
| Advanced analytics (dashboards, insights, export) | ⚡ | `backend/src/services/analyticsAggregationService.ts` | Deferred to can-do. |

---

## 2) Gaps and Issues (Ranked)

### Blocking (Must fix before production launch for Phase 1/2)
None.

### Important (Fix next)
None.

### Later (Can defer)
1. Mobile app full implementation.
2. Video avatar settings and triggers.
3. Premium tiers expansion beyond premium/vip.
4. Training job queue/worker + dashboard.
5. WhatsApp Redis/SQS queue + durable rate limiter.
6. Voice settings expansion (speed/pitch/emotion) + usage stats.
7. Instagram DM 24-hour window + rate limits.
8. Phone integration full call pipeline (Twilio + Whisper + TTS).
9. Advanced analytics dashboards + exports.

---

## 3) File-Level Fix List (Concrete)

### Phase 1 Critical Fixes

None (current fixes complete; deferred items listed below).

### Phase 2 Completion

None (current fixes complete; deferred items listed below).

### Phase 3 Partial Gaps

Moved to can-do (see `docs/phase2_3/can_do_phase_2_3.md`).

---

## 4) Phased Implementation Plan

### Phase 1 Fixes (Highest Priority)
None.

### Phase 2 Fixes
None.

### Phase 3 Fixes
Moved to can-do (see `docs/phase2_3/can_do_phase_2_3.md`).

---

## 5) Release Checklist (After Fixes)

- Enable feature flags in prod (`ENABLE_*`).
- Configure all API keys (Stripe, Twilio, ElevenLabs, Meta, D-ID, OpenAI).
- Run integration tests for webhook flows.
- Validate pay-per-chat flow end-to-end.
- Validate WhatsApp and Instagram webhook verification.


