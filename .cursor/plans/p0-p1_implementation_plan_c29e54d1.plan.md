---
name: P0-P1 Implementation Plan
overview: Implement P0 revenue/compliance features in code, document P1 launch-readiness tasks, and park all P2 items in can_do lists as requested.
todos:
  - id: p0-paytiers
    content: Implement pay-per-chat tier list end-to-end
    status: in_progress
  - id: p0-wa-paylink
    content: Add Stripe payment link flow for WhatsApp
    status: pending
  - id: p0-export
    content: Add data export endpoint + Settings UI
    status: pending
  - id: p0-delete
    content: Add account deletion endpoint + Settings UI
    status: pending
  - id: p1-docs
    content: Update legal/a11y/perf/beta/launch docs
    status: pending
  - id: p2-can-do
    content: Add P2 items to both can_do lists
    status: pending
---

# P0-P1 Implementation Plan

## Scope

- P0: Implement revenue/compliance features in code.
- P1: Document-only checklists for legal/a11y/perf/beta/launch.
- P2: Add to both can_do lists.

## P0 — Implement Now

- **Pay-per-chat tier list ($1/$5/$10/$25/$50)**
- Extend creator `priceConfig` to support tiered amounts in backend, update validation, and adjust payment intent creation and paywall UI.
- Update frontend settings + integrations screens to allow selection of preset tiers and custom amount.
- Files: [backend/src/modules/payments/payPerChatController.ts](backend/src/modules/payments/payPerChatController.ts), [backend/src/modules/creator/creatorController.ts](backend/src/modules/creator/creatorController.ts), [frontend/react-app/src/pages/SettingsPage.tsx](frontend/react-app/src/pages/SettingsPage.tsx), [frontend/react-app/src/pages/Integrations.tsx](frontend/react-app/src/pages/Integrations.tsx), [frontend/react-app/src/components/PaymentPrompt.tsx](frontend/react-app/src/components/PaymentPrompt.tsx)

- **WhatsApp Stripe payment link in chat**
- Add Stripe Payment Link creation for WhatsApp paywalls and insert the link into outbound messages.
- Store minimal metadata to map pay-per-chat payments back to creator/session where applicable.
- Files: [backend/src/modules/whatsapp/whatsappController.ts](backend/src/modules/whatsapp/whatsappController.ts), [backend/src/services/stripeService.ts](backend/src/services/stripeService.ts)

- **Data export**
- Add `GET /api/profile/export` to aggregate user data and return a ZIP (profile, identities, chats, payments, uploads).
- Add Settings UI button for export download.
- Files: [backend/src/modules/profile/profileController.ts](backend/src/modules/profile/profileController.ts), [backend/src/modules/profile/profileRoutes.ts](backend/src/modules/profile/profileRoutes.ts), [frontend/react-app/src/pages/SettingsPage.tsx](frontend/react-app/src/pages/SettingsPage.tsx)

- **Account deletion (soft delete + grace period)**
- Add `DELETE /api/profile/account` with soft-delete fields and 30-day grace window; block login after deletion request.
- Add Settings UI confirmation + OTP flow reuse.
- Files: [backend/src/modules/profile/profileController.ts](backend/src/modules/profile/profileController.ts), [backend/src/config/database.ts](backend/src/config/database.ts), [frontend/react-app/src/pages/SettingsPage.tsx](frontend/react-app/src/pages/SettingsPage.tsx)

## P1 — Docs/Checklist Only

- Update checklists for:
- Legal review (privacy/terms)
- Accessibility audit
- Performance optimization
- Beta testing
- Launch checklist
- Files: [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md), [docs/INTEGRATION_TEST_CHECKLIST.md](docs/INTEGRATION_TEST_CHECKLIST.md), [docs/phase1/can_do.md](docs/phase1/can_do.md) if needed for notes.

## P2 — Defer to Can-Do (both lists)

- Add to both:
- API keys, custom domain, i18n, advanced payments, team/collab, bulk ops, cost tracking, unused event types.
- Files: [docs/phase1/can_do.md](docs/phase1/can_do.md), [docs/phase2_3/can_do_phase_2_3.md](docs/phase2_3/can_do_phase_2_3.md)

## Validation

- Run lints on touched files.
- Re-check `docs/FINAL_REQUIREMENTS_GAP_PLAN.md` for updated status after changes.