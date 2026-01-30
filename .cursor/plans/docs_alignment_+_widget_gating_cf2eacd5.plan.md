---
name: Docs alignment + Widget gating
overview: Update docs to reflect instant/async training (not 24h) and implement pay-per-chat gating in the website embed widget to match public chat/WhatsApp behavior.
todos:
  - id: docs-remove-24h-training
    content: Update PHASE1 + Phase2/3 docs to remove 24h training claim; document async training job interval + correct webhook path.
    status: pending
  - id: widget-stable-visitor
    content: Persist and send a stable visitorId from embed-frame.js to /api/widget/chat so sessions are reused.
    status: pending
  - id: widget-pay-per-chat-gating
    content: Implement pay-per-chat gating in backend widgetChat using the same logic as public chat and return requiresPayment/upgradeUrl.
    status: pending
    dependencies:
      - widget-stable-visitor
  - id: widget-message-storage
    content: Store widget chat messages in chat_messages so gating can count messages per session consistently.
    status: pending
    dependencies:
      - widget-pay-per-chat-gating
---

# Docs alignment + Widget pay-per-chat gating

## Docs updates (remove 24h training claim)

- Update [`docs/phase1/PHASE1.md`](docs/phase1/PHASE1.md):
- Replace “AI ready in 24 hours” language with **async training job** wording (embeddings build happens shortly after content upload; processor runs on an interval).
- Clarify that “training” here means **RAG/embeddings preparation**, not a long offline model training.
- Align Stripe webhook path to the actual code: **`/api/billing/stripe/webhook`**.
- Update [`docs/phase2_3/phase2+3.md`](docs/phase2_3/phase2+3.md):
- Same: remove/replace 24h training references (if any), keep 24h premium session window (that is implemented).
- Note that widget embed is iframe-based (already implemented), and widget pay-per-chat unlock redirects to full chat page.

## Fix: widget pay-per-chat gating (currently missing)

- Problem: `frontend/src/public/embed-frame.js` expects `requiresPayment`, but backend `widgetChat` never returns it; also widget requests currently don’t send a stable `visitorId` so each message becomes a new visitor/session.
- Backend changes in [`backend/src/modules/widget/widgetController.ts`](backend/src/modules/widget/widgetController.ts):
- Reuse the same decision logic used by public chat (`backend/src/modules/public/publicController.ts`):
- Respect `(priceConfig as any).enablePayments`
- Check premium unlock via `premiumSessionQueries.isSessionPremium(sessionId)`
- Apply free message threshold + `paymentTriggerRules` + `shouldRequirePayment` from [`backend/src/modules/identity/intelligentPricing.ts`](backend/src/modules/identity/intelligentPricing.ts)
- Store widget conversation messages in `chat_messages` (via `chatMessageQueries`) so we can count messages per session and keep logic consistent.
- When payment is required, return `{ requiresPayment: true, upgradeUrl: ... }` and do **not** return a full `reply`.
- Keep existing voice behavior (only when a reply is produced).
- Frontend embed changes in [`frontend/src/public/embed-frame.js`](frontend/src/public/embed-frame.js):
- Generate a stable `visitorId` (localStorage) and include it in POST body to `/api/widget/chat`.
- Improve the payment-required UX to use backend-provided `upgradeUrl` when present.

## Validation checklist

- Widget sends multiple messages → backend reuses same session (stable `visitorId`).
- If creator enabled pay-per-chat:
- widget returns `requiresPayment: true` after triggers, and iframe shows unlock message/link.
- public chat flow continues to work unchanged.
- If pay-per-chat disabled: widget continues to return full replies as before.