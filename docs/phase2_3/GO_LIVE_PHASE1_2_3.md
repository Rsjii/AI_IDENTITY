# Go‑Live Guide (Phase 1 + 2 + 3) — A‑Z

This is the **production go‑live** checklist for Selflyx/AI_IDENTITY with Phase 1/2/3 features.

---

## 0) What “go live” means here

You need:
- A public backend URL (HTTPS)
- A public frontend URL (HTTPS)
- A Postgres database reachable from backend
- Correct webhooks configured (Stripe/Twilio/Meta)
- Correct feature flags enabled (so only the features you want are live)

---

## 1) Environment files

### Backend
- Copy `backend/env.example` → `backend/.env`
- In production: **set env vars in your hosting provider** (don’t upload `.env` to git)

### Frontend
- Copy `frontend/react-app/env.example` → `frontend/react-app/.env`
- Build with the right `VITE_*` values

### Railway notes (recommended deployment shape)
- **Backend**: one Railway service (Node) for API
- **Database**: Railway Postgres (or managed Postgres)
- **(Optional later)**: separate Railway service for background workers (Redis/BullMQ) — see `docs/phase2_3/can_do_phase_2_3.md`

---

## 2) MUST‑SET production env vars (backend)

Minimum:
- `NODE_ENV=production`
- `APP_ENV=prod`
- `PORT=3000` (or your platform)
- `DATABASE_URL=...`
- `SESSION_SECRET=...` (strong random)
- `JWT_SECRET=...` (strong random)
- `ID_TOKEN_SECRET=...` (strong random)
- `FRONTEND_URL=https://<YOUR_FRONTEND_DOMAIN>`
- `APP_URL=https://<YOUR_FRONTEND_DOMAIN>`
- `ADMIN_EMAILS=...`

Payments (if you enable payments):
- `STRIPE_SECRET_KEY=sk_live_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`
- `STRIPE_PRICE_STARTER=price_...`
- `STRIPE_PRICE_GROWTH=price_...`
- `STRIPE_PRICE_SCALE=price_...`

Storage (S3/R2 for uploads):
- `S3_BUCKET=...`
- `AWS_ACCESS_KEY_ID=...`
- `AWS_SECRET_ACCESS_KEY=...`
- `S3_PUBLIC_BASE_URL=...`

Recommended (prod)
- **Email**: set SMTP vars if you want receipt/summary emails
- **Sentry**: set `SENTRY_DSN` for crash/error visibility
- **CORS for widget**: set `CORS_ALLOWED_ORIGINS` (or accept public widget behavior)

---

## 3) Feature flags (prod control switch)

In production, you should explicitly control what is ON.

Recommended defaults (prod):
- Enable only what you are ready to support.

Flags:
- `ENABLE_PAYMENTS`
- `ENABLE_WIDGET`
- `ENABLE_PAY_PER_CHAT`
- `ENABLE_MARKETPLACE`
- `ENABLE_VOICE`
- `ENABLE_VIDEO`
- `ENABLE_PHONE`
- `ENABLE_WHATSAPP`
- `ENABLE_INSTAGRAM`

Behavior:
- When a flag is OFF, the backend **does not mount those routes** (so the feature is effectively disabled).

Recommended rollout order (prod):
- **Week 0 (launch)**: `ENABLE_WIDGET=true`, `ENABLE_PAY_PER_CHAT=true` (only if payments are ready)
- **Week 1**: `ENABLE_MARKETPLACE=true` (after pricing + Stripe is stable)
- **Week 2+**: `ENABLE_WHATSAPP=true` (after Twilio configured and tested)
- **Later**: `ENABLE_INSTAGRAM=true` (Meta approval can take time)
- **Later**: `ENABLE_VIDEO=true` (provider cost + async processing)
- **Later**: `ENABLE_PHONE=true` (voice flow is complex; keep off until ready)

---

## 4) Webhooks to configure (prod)

### Stripe
- Webhook URL: `https://<BACKEND_DOMAIN>/api/billing/stripe/webhook`

### Twilio WhatsApp
- Incoming message webhook: `https://<BACKEND_DOMAIN>/api/whatsapp/webhook`

### Meta Instagram
- Webhook callback: `https://<BACKEND_DOMAIN>/api/instagram/webhook`
- Verify token: `META_VERIFY_TOKEN`

### Twilio Voice (Phone)
- Voice webhook: `https://<BACKEND_DOMAIN>/api/phone/webhook`

---

## 5) Deployment steps (generic)

1. Provision Postgres (managed is best).
2. Deploy backend (Node/Express):
   - Install deps
   - Set env vars
   - Start server (use a process manager: PM2 / systemd / platform runtime)
3. Deploy frontend:
   - Set `VITE_*` vars
   - Build and host (Netlify/Vercel/S3/Cloudflare Pages/etc.)
4. Configure webhooks (Stripe/Twilio/Meta).
5. Turn on feature flags one-by-one and test.

Practical Railway sequence:
- Deploy backend service → confirm `GET /health` works
- Add Stripe webhook → send one test event
- Turn on `ENABLE_PAYMENTS` only after Stripe keys are live keys
- Turn on 1 feature flag → test → then next

---

## 6) Final smoke test flow (do this after deploy)

- Auth signup/login
- Create identity + test mirror
- Upload knowledge base
- Widget embed chat works
- Pay‑Per‑Chat:
  - preview shown → pay → full answer returned
- WhatsApp:
  - send message → webhook hit → response arrives
- Instagram:
  - webhook verification passes → DM triggers response (Meta approval required)
- Marketplace:
  - list page loads → listing page → subscribe flow (Stripe)
- Video:
  - upload sample video → list avatar → generate video (provider key required)
- Phone:
  - Twilio hits `/api/phone/webhook` (and then expand call flow as needed)

---

## 7) What we intentionally did NOT do yet (to keep MVP stable)

These are optional and should be implemented only when traffic/ops demands it (details in `docs/phase2_3/can_do_phase_2_3.md`):
- Redis queue + worker for webhooks
- Redis caching
- WebSockets / SSE realtime dashboards
- Algolia search
- TimescaleDB migration
- PDF exports (Puppeteer)
- Full phone-call conversational loop (Whisper → LLM → TTS streaming)


