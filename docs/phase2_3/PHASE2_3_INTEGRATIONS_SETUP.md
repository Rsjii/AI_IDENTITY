# Phase 2 + 3 Integrations Setup (WhatsApp, Instagram, Stripe, Voice, Video, Phone)

This doc explains **exactly what integration setup you need to do** (dashboards + webhooks + env vars).

---

## 1) Copy env templates

### Backend
- Copy `backend/env.example` → `backend/.env`

### Frontend (Vite React App)
- Copy `frontend/react-app/env.example` → `frontend/react-app/.env`

---

## 2) Common env vars (must-have)

### Backend (`backend/.env`)
- **DATABASE_URL**: Postgres connection string.
- **SESSION_SECRET / JWT_SECRET / ID_TOKEN_SECRET**: generate long random strings.
- **FRONTEND_URL**: e.g. `http://localhost:5173` (used for redirects + email links).

### Frontend (`frontend/react-app/.env`)
- **VITE_STRIPE_PUBLISHABLE_KEY**: Stripe publishable key (starts with `pk_`).
- **VITE_API_BASE_URL**: optional. Leave empty for same-origin dev/proxy. Set in production if frontend and backend are on different domains.

---

## 2.1) Feature flags (IMPORTANT)

Phase 2/3 modules are controlled by backend env flags (recommended to explicitly set in prod):

- `ENABLE_PAYMENTS`
- `ENABLE_WIDGET`
- `ENABLE_PAY_PER_CHAT`
- `ENABLE_MARKETPLACE`
- `ENABLE_VOICE`
- `ENABLE_VIDEO`
- `ENABLE_PHONE`
- `ENABLE_WHATSAPP`
- `ENABLE_INSTAGRAM`

If a flag is OFF, the backend **does not mount those routes** (feature is effectively disabled).

Recommended production strategy:
- Keep high-cost / complex modules OFF until you are ready:
  - `ENABLE_PHONE=false` (until you build a proper Twilio Voice conversational flow)
  - `ENABLE_VIDEO=false` (until you are ready for video provider costs + async processing)
  - `ENABLE_INSTAGRAM=false` (until Meta approval is granted)
- Turn on in small steps: **one flag at a time**, test, then proceed.

---

## 3) Stripe (Payments + Pay‑Per‑Chat + Subscriptions + Connect)

### A) Create Stripe keys
In Stripe Dashboard:
- Get **Secret Key** → set `STRIPE_SECRET_KEY`
- Get **Webhook Signing Secret** (created after you add webhook endpoint) → set `STRIPE_WEBHOOK_SECRET`
- Get **Price IDs** for tiers → set:
  - `STRIPE_PRICE_STARTER`
  - `STRIPE_PRICE_GROWTH`
  - `STRIPE_PRICE_SCALE`

### B) Configure Stripe webhook endpoint
Add a webhook endpoint in Stripe to your backend:
- **Webhook URL**: `https://<YOUR_BACKEND_DOMAIN>/api/billing/stripe/webhook`
- Subscribe to events used by the app (safe superset):
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `payment_intent.succeeded`

Then copy the webhook secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.

Production notes:
- Use `sk_live_...` and `whsec_...` from the **same Stripe mode** (live vs test)
- Ensure your backend can accept Stripe requests (HTTPS, correct path, not blocked by auth)

### C) Stripe Connect (Creator payouts)
If you want creator payouts:
- Enable **Stripe Connect** in your Stripe account (Express is simplest).
- Set:
  - `STRIPE_CONNECT_RETURN_URL` (where Stripe redirects after onboarding success)
  - `STRIPE_CONNECT_REFRESH_URL` (where Stripe redirects if onboarding is incomplete)

Recommended values (local):
- `STRIPE_CONNECT_RETURN_URL=http://localhost:5173/settings?tab=billing`
- `STRIPE_CONNECT_REFRESH_URL=http://localhost:5173/settings?tab=billing`

### D) Frontend key
Set in `frontend/react-app/.env`:
- `VITE_STRIPE_PUBLISHABLE_KEY=pk_...`

---

## 4) Twilio WhatsApp (Auto‑replies)

### A) Twilio setup
In Twilio Console:
- Get:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
- Configure a WhatsApp-enabled sender / sandbox / business number:
  - `TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886` (example)

### B) Configure Twilio webhook
Set the **incoming message webhook** to:
- `https://<YOUR_BACKEND_DOMAIN>/api/whatsapp/webhook`

Notes:
- Twilio sends `application/x-www-form-urlencoded` payload.
- The backend responds with empty TwiML and sends messages via Twilio API.

Recommended:
- Start with `ENABLE_WHATSAPP=false` in prod until Twilio is verified end-to-end.
- Once verified, enable the flag + monitor logs for retries.

---

## 5) Meta / Instagram DM (Auto‑replies)

### A) Create Meta App
In Meta for Developers:
- Create an app and enable Instagram messaging permissions needed for DMs.
- Set backend env:
  - `META_APP_ID`
  - `META_APP_SECRET`
  - `META_VERIFY_TOKEN` (any random string; must match webhook verification)

### B) Configure webhook
In Meta dashboard, set webhook:
- **Callback URL**: `https://<YOUR_BACKEND_DOMAIN>/api/instagram/webhook`
- **Verify token**: same value as `META_VERIFY_TOKEN`

### C) Frontend env (only App ID)
Set in `frontend/react-app/.env`:
- `VITE_META_APP_ID=<same as META_APP_ID>`

Important:
- Instagram messaging requires **Meta approval** and **Business account** prerequisites.
- Keep `ENABLE_INSTAGRAM=false` until Meta approval is complete.

---

## 6) ElevenLabs (Voice cloning + TTS)

### A) Create ElevenLabs API key
Set backend env:
- `ELEVENLABS_API_KEY=...`

### B) Storage (audio + video uploads)
Voice/video files are uploaded to S3/R2 using:
- `S3_BUCKET`
- `S3_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- Optional (for R2):
  - `S3_ENDPOINT`
  - `S3_FORCE_PATH_STYLE=true`
  - `S3_PUBLIC_BASE_URL`

---

## 7) Video Avatars (D‑ID / HeyGen)

Current implementation reads:
- `DID_API_KEY`

Optional placeholder for future provider:
- `HEYGEN_API_KEY`

Recommended:
- Keep `ENABLE_VIDEO=false` until you validate provider latency + cost.

---

## 8) Phone Integration (Twilio Voice)

Backend uses:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- Optional: `TWILIO_VOICE_NUMBER` (your Twilio purchased Voice number)

Webhook endpoint:
- `https://<YOUR_BACKEND_DOMAIN>/api/phone/webhook`

**Important note about call flow**
- The current webhook returns a basic TwiML greeting. If you want full conversational calls (STT → LLM → TTS loop), you typically configure:
  - Twilio **Studio Flow** or `<Gather>` speech input
  - A callback from Twilio to your backend with captured speech
  - Then you respond with `<Say>` / `<Play>` (or stream audio)

Recommended:
- Keep `ENABLE_PHONE=false` for MVP unless phone calls are your core monetization channel.

---

## 9) Sentry (optional)

### Backend
- `SENTRY_DSN=...`

### Frontend
- `VITE_SENTRY_DSN=...`

---

## 10) Quick “what do I need to do” checklist

- **Stripe**: set keys + create webhook at `/api/billing/stripe/webhook` + set price IDs + (optional) enable Connect.
- **Twilio WhatsApp**: set keys + configure webhook at `/api/whatsapp/webhook`.
- **Instagram**: create Meta app + set webhook at `/api/instagram/webhook` + set verify token.
- **ElevenLabs**: add `ELEVENLABS_API_KEY` + ensure S3/R2 env works.
- **Video**: add `DID_API_KEY`.
- **Phone**: point Twilio Voice webhook to `/api/phone/webhook` (and optionally build Studio/Gather flow for a full conversation).

---

## 11) “Do later” list (to keep MVP simple)

See `docs/phase2_3/can_do_phase_2_3.md` for:
- Redis queue / worker architecture
- WebSockets/SSE realtime
- Algolia search
- TimescaleDB
- PDF export
- Full phone STT/TTS streaming loop


