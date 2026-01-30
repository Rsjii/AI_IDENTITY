## can_do_phase_2_3.md (Phase 2/3 — Do Later / Optional)

This file is the **official parking lot** for Phase 2/3 items that are NOT required for MVP stability.
Goal: keep the live system simple; add these only when metrics/ops pain proves it’s needed.

---

## Z) Deferred from FINAL_REQUIREMENTS_GAP_PLAN (Not needed now)

- Voice settings expansion (speed/pitch/emotion) + usage stats UI.
- WhatsApp: Stripe payment link generation inside chat (beyond public chat link).
- Instagram DM: 24-hour response window enforcement + 200/hour rate limits.
- Phone integration: real-time voice flow (Twilio + Whisper + TTS streaming).
- Advanced analytics dashboard (geo, funnel, insights, export).
- Mobile apps full implementation.
- Video avatar settings/triggers (quality, length, routing).

## A) Redis (Queue + Rate-limit + Cache)

### A1) Redis Queue (BullMQ) for WhatsApp/Instagram webhooks
- **Do when**
  - Webhook requests start timing out
  - Twilio/Meta retries spike
  - LLM/TTS calls slow down webhook response times
  - You need retry/backoff + ordering + burst handling
- **How**
  - Add Redis (Railway Redis or Upstash)
  - Add BullMQ queue in API server:
    - Webhook handler: validate + enqueue job + return 200 quickly
  - Add a separate Railway “worker” service:
    - Consumes jobs → calls LLM/TTS → sends replies via Twilio/Meta
- **Env**
  - `REDIS_URL=...`
  - Optional: `QUEUE_CONCURRENCY=...`, `QUEUE_RATE_LIMIT_PER_SEC=...`

### A2) Redis Rate Limiting
- **Do when**
  - DB-based rate limiting starts causing DB load or slow responses
- **How**
  - Keep “auth + pricing + payments” in DB
  - Move “per-IP/per-visitor throttle counters” to Redis with expiry keys

### A3) Redis Caching (Marketplace + Dashboard + Public profiles)
- **Do when**
  - Marketplace list/detail endpoints become hot and DB reads spike
  - Dashboard aggregation queries start getting slow
- **How**
  - Cache read-mostly endpoints with short TTL
  - Invalidate cache on writes (listing update/new review/pricing updates)

---

## B) Realtime (WebSockets / SSE)

### B1) SSE for creator dashboard updates (recommended first)
- **Do when**
  - Polling cost becomes meaningful or creators demand realtime
- **How**
  - Implement `GET /api/creator/dashboard/stream` (SSE)
  - Push events on: new chat, payment received, webhook message processed

### B2) WebSockets (Socket.IO)
- **Do when**
  - You need bidirectional realtime (chat operator tools, advanced live ops)
- **How**
  - Use Socket.IO
  - Use Redis adapter if you run multiple instances
  - Requires more infra complexity than SSE

---

## C) Marketplace Search (Algolia / Meilisearch)

### C1) Algolia
- **Do when**
  - 500–1000+ public listings OR search relevance becomes a growth lever
- **How**
  - Sync marketplace listings to Algolia index on create/update/delete
  - Implement filters (category, tags, price range)

### C2) Meilisearch (self-hosted alternative)
- **Do when**
  - Cost control matters more than hosted search

---

## D) Analytics Upgrades (TimescaleDB, heavy dashboards)

### D1) TimescaleDB
- **Do when**
  - Current `analytics_daily` queries are slow
  - You need high-frequency (hourly/minute) time-series dashboards
- **How**
  - Introduce Timescale hypertables for events/metrics
  - Keep daily aggregates for fast summary cards

### D2) “AI Insights” automation
- **Do when**
  - You want weekly/monthly automatic insights emails with GPT summaries
- **How**
  - Generate insight prompt from aggregates
  - Store insights + send via email job

---

## E) Exports (PDF / Advanced reports)

### E1) PDF Export (Puppeteer)
- **Do when**
  - Creators explicitly request PDF reports and you can afford ops cost
- **Why it’s deferred**
  - Headless Chrome increases RAM/CPU and operational complexity
- **Alternative first**
  - CSV export (already supported) + simple “email summary”

---

## F) Phone Calls (Full conversational loop)

### F1) Proper Twilio Voice conversational flow (Whisper → LLM → ElevenLabs)
- **Do when**
  - Phone calls are core monetization and you can invest in latency + reliability
- **How (typical)**
  - Twilio `<Gather>` speech input loop (or Studio Flow)
  - Speech-to-text (Whisper or Twilio STT)
  - LLM response (with function calling if needed)
  - Text-to-speech (ElevenLabs)
  - Respond with `<Say>` / `<Play>` (or streaming if you build it)
- **Important**
  - Handle billing per minute, call recording consent, transcripts, and retries

---

## G) WhatsApp-specific tables + infra

### G1) `whatsapp_conversations` table
- **Do when**
  - You need WhatsApp-only retention metrics or special conversation state
- **Why deferred**
  - Current system already stores chat history in `chat_sessions/chat_messages`

---

## H) Default rule: keep MVP simple

If a feature increases infra/ops complexity (Redis, workers, WebSockets, PDF, Phone streaming),
only add it when:
- You have real user demand, AND
- You have measurable pain (timeouts, high retries, DB load), AND
- You can monitor it (Sentry/logs/alerts).


