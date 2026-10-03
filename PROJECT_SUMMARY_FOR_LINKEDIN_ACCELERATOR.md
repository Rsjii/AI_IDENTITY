










https://ai-identity-delta.vercel.app/

# MirrorMe — AI Clone / Digital Twin Platform
### Detailed Project Documentation (for repurposing into LinkedIn posts, accelerator applications, and pitch material)

> **Context note (read first):** This is a side project, not the founder's current main product/focus. It was designed, built, and largely completed solo, but was not launched to real paying users at scale (no meaningful user traction was achieved). This document is a factual, detailed record of what was actually designed and built, intended to be fed to another LLM to generate LinkedIn posts, accelerator application answers, and portfolio copy. Minor bugs/incomplete polish items are intentionally excluded since this is not being positioned as a live production product — the focus here is on scope, architecture, and engineering depth.

---

## 1. One-line description

**MirrorMe** is a platform that lets any creator, expert, or public figure turn their knowledge and personality into a monetizable AI clone ("digital twin") that can chat with their audience 24/7 — trained on their own content, styled in their own voice, and embeddable anywhere (standalone link, website widget, WordPress, WhatsApp, Instagram).

Think: "Give your audience 24/7 access to a version of you that talks like you, knows what you know, and can be sold as a subscription or pay-per-chat product."

---

## 2. The problem it was trying to solve

Creators, coaches, consultants, educators, and public figures get repetitive questions from their audience/customers every day (DMs, emails, comments) but can't scale themselves. Existing chatbot builders are generic and don't capture a person's actual voice, personality, or expertise, and don't come with a built-in way to monetize access to that AI version of the person.

MirrorMe's core idea: **turn a person's content + personality into a sellable AI product in under 10–15 minutes**, with monetization (subscriptions + pay-per-chat) built in from day one, not bolted on later.

---

## 3. Who it was for (target users)

- Content creators / influencers with an engaged audience who get repetitive DMs
- Coaches, consultants, and educators who want to scale 1:1 advice
- Authors / public figures who want a "chat with me" experience for fans/readers
- Small businesses that want a branded AI assistant trained on their own material

Two sides of the platform:
1. **Creators** — people who train and sell their AI clone
2. **End-users / visitors** — people who chat with a creator's AI clone (and pay for extended access)

---

## 4. High-level product concept

1. A creator signs up, answers a personality quiz, and uploads their content (PDFs, docs, pasted text, YouTube videos, URLs, social profiles).
2. The platform processes that content into a searchable knowledge base (chunking + vector embeddings) and combines it with a structured "identity" (personality rules, tone, boundaries) to create the AI clone.
3. The creator sets pricing (free preview messages, pay-per-chat price, monthly subscription price) and picks a subscription plan for themselves (Starter / Pro / Free trial).
4. The platform generates a distribution package: a standalone public chat link, an embeddable website widget, and a WordPress plugin.
5. Visitors chat with the creator's AI for free up to a limit, then hit a paywall (pay-per-chat or subscribe) to continue — visible immediately to the creator on a dashboard with usage/revenue analytics.

---

## 5. Full technical architecture

### Tech stack

**Backend**
- Node.js + Express, written in TypeScript
- PostgreSQL as the primary database (raw SQL, no ORM — full control over queries/schema)
- Authentication: Passport.js (Google OAuth) + custom JWT-based auth + email/password with OTP verification
- AI/LLM: OpenAI API (primary) with Groq API as a secondary/faster LLM option
- Payments: Stripe (global/card payments + subscriptions) and Razorpay (India-focused payments, UPI)
- File storage: AWS S3 for uploaded content (PDFs, docs, images)
- Transactional email: Resend API (OTPs, notifications)
- Product analytics: PostHog
- Error monitoring: Sentry
- Session storage: PostgreSQL-backed session store (connect-pg-simple)
- Background processing: interval-based training job worker (polls for pending jobs every ~2 minutes)

**Frontend**
- React 19 + TypeScript
- Vite as the build tool
- React Router v7 for routing
- TanStack Query (React Query) for server-state management
- Tailwind CSS for styling
- Radix UI as the headless component primitive layer, with a custom design system on top
- Stripe Elements for embedded payment UI
- Sentry for frontend error tracking

**Browser Extension**
- A separate Chrome Extension ("Identity Mirror") built with Manifest V3
- Injects into Gmail's compose window and generates reply suggestions written in the user's own "identity voice" (tone/style rules defined on the platform), rather than a generic AI tone
- Structure: background service worker, Gmail-specific content script injection, popup UI, and shared style/utility modules

**Infrastructure / Deployment**
- Designed for deployment on Railway / Render-style platforms (a `render.yaml` is present for Render deployment)
- Environment-variable-driven configuration for all secrets and provider keys
- A feature-flag system (`featureFlags.ts`) to turn entire feature areas on/off without code changes — used to gate Phase 2/3 features and to safely disable payments in non-production environments

### Why raw SQL instead of an ORM
A deliberate architecture decision: full control over query performance and schema evolution for a fairly complex relational schema (30+ tables with many foreign-key relationships), rather than fighting an ORM's abstractions — a common systems-level tradeoff made by more experienced backend engineers.

---

## 6. Core systems built (module-by-module)

The backend is organized into clearly separated feature modules (`backend/src/modules/`), each with its own controller/service/routes:

1. **Auth module** — Email + OTP signup/login, Google OAuth, JWT issuance, multi-device session tracking, password reset flows, refresh tokens.
2. **Identity module** — The "AI clone" engine itself: personality configuration, versioned identity records (so a creator can iterate on their AI's personality without losing history), A/B testing variants of an identity, and intelligent pricing logic.
3. **Content module** — Ingestion pipeline for training data: file upload (PDF via `pdf-parse`, DOCX via `mammoth`, plain text, audio via Whisper transcription), pasted text, YouTube transcript import, generic URL scraping, and social profile import (Twitter/LinkedIn/Instagram) hooks.
4. **RAG / embeddings pipeline** — Uploaded content is chunked (~1,200 characters per chunk), stored, and later embedded via OpenAI's embedding model in a background job; at chat time, the system does a similarity search over the creator's knowledge chunks and injects the most relevant ones into the LLM prompt alongside the personality rules and recent conversation history.
5. **Public chat module** — The visitor-facing chat experience: session handling for anonymous visitors (cookie-based visitor IDs), free-message-limit enforcement, teaser/preview response generation once the limit is hit, and full response generation for paying/allowed users.
6. **Widget module** — A standalone embeddable JS widget (`embed-frame.js`) that any website can drop in to expose the same chat experience, plus a config/code-generation endpoint so creators can copy-paste an embed snippet.
7. **Billing module (Stripe)** — Creator-side subscription billing: checkout session creation, webhook handling for `checkout.session.completed`, customer portal access, plan-tier updates, and cancellation flow.
8. **Payment module (Razorpay)** — India-specific payment rail: order creation, signature verification, and subscription creation parallel to the Stripe flow, so the platform supports both global card payments and UPI/India-preferred payments.
9. **Payments module (pay-per-chat)** — A separate, more granular monetization layer: per-visitor payment intents that unlock 24-hour "premium sessions" on a specific creator's chat, with an automatic revenue split (75% to creator / 25% platform fee) computed and stored per transaction.
10. **Creator dashboard module** — Aggregated stats (total chats, revenue, top questions, recent conversations), identity editing, pricing management, and earnings views.
11. **Marketplace module** (Phase 2, built but feature-flagged off) — Public discovery listings for creators' AI clones (slug, category, tags, public visibility toggle) so visitors could browse and find AI clones to chat with, not just arrive via a direct link.
12. **Voice module** (Phase 2, built but feature-flagged off) — Voice cloning integration (ElevenLabs) so a creator's AI could respond in synthesized audio matching their real voice, not just text.
13. **Video module** (Phase 3, partial) — Video avatar integration (D-ID) for a talking-head video response mode.
14. **WhatsApp module** (Phase 2, built but feature-flagged off) — Lets a creator's AI clone be reached over WhatsApp, not just the web chat.
15. **Instagram module** (Phase 2, built but feature-flagged off) — Same concept for Instagram DMs.
16. **Phone module** (Phase 3, partial) — Early groundwork for phone-call-based access to the AI clone.
17. **Admin module** — Platform-level statistics, user listing, and revenue analytics for the platform operator.
18. **Rate limiting middleware** — Custom, OWASP-aligned rate limiting backed by PostgreSQL rather than an in-memory store, so limits survive server restarts and work across multiple server instances.
19. **Plan-gate middleware** — Enforces per-plan usage ceilings (e.g., a Starter plan capped at 5,000 chats/month) at the request level, returning proper HTTP 402-style responses when a creator's audience exceeds their plan's chat volume.

---

## 7. Database design

- **30+ PostgreSQL tables** with **50+ indexes**, all relationships enforced via foreign keys.
- Key table groups:
  - **User management:** `User`, `OTP`, `auth_sessions`
  - **AI identity:** `identities`, `identity_versions`, `mirror_runs` (logs every AI request with token/cost usage), `trust_events` (captures user feedback signals on AI responses)
  - **Content & training:** `knowledge_sources`, `knowledge_chunks` (with JSONB-stored embedding vectors), `training_jobs`
  - **Chat:** `chat_sessions`, `chat_messages`
  - **Payments:** `subscriptions`, `stripe_customers`, `stripe_payments`, `premium_sessions`
  - **Marketplace:** `marketplace_listings`
  - **Analytics:** `Event`, `api_latency_events`

This is a schema-level decision that reflects real product thinking, not just CRUD: e.g., versioning the AI identity instead of overwriting it, logging every AI call with cost/tokens for margin tracking, and separating "premium session" (time-boxed access) from "subscription" (recurring access) as distinct monetization primitives.

---

## 8. API surface

**50+ REST endpoints**, grouped by domain: authentication, identity management, content upload/import, public chat, widget embedding, Stripe billing, Razorpay payments, pay-per-chat payments, creator dashboard, conversation management (favorite/archive/history), and admin analytics.

---

## 9. Key end-to-end flows actually implemented

### A. Creator onboarding (signup → live AI clone)
Landing page → Auth (Google OAuth or email/OTP) → onboarding-step state machine (`quiz` → `content` → `pricing` → `plan` → `deploy` → `done`, persisted per-user so a creator can resume onboarding after leaving) → 10-question personality quiz → content upload (multiple sources) → pricing setup (pay-per-chat price, subscription price, free-message allowance) → plan selection with Stripe checkout → deploy screen showing the standalone link, embed code, and WordPress instructions → dashboard.

### B. Visitor chat flow
Visitor lands on `/chat/{creator-handle}` → sees creator profile + welcome message → sends a message → backend checks the creator's plan limits, creates/reuses a chat session, and checks the visitor's free-message usage → if under the limit, generates a full RAG-grounded AI response; if over the limit, generates a short teaser and returns a "payment required" response with tier options → frontend shows a payment modal → on successful payment, a 24-hour premium session is created and the chat unlocks fully.

### C. Payment & subscription flow
Two independent monetization tracks: (1) creator-side recurring subscription to the platform itself (Starter/Pro/free-trial, via Stripe, gating how many total chats a creator's audience can have per month), and (2) end-user-side pay-per-chat (via Stripe or Razorpay) that unlocks time-boxed premium access to one specific creator's AI, with automatic revenue-split accounting.

### D. Content ingestion & AI training
Upload/import → file parsing (PDF/DOCX/text/YouTube transcript/URL scrape) → text chunking → chunks stored without embeddings initially (fast upload response) → background job on a ~2-minute interval finds pending training jobs, generates embeddings in batches, marks the job complete, and (in production) emails the creator that training is done → subsequent chats use vector similarity search over those embeddings to ground responses in the creator's actual content.

---

## 10. Feature flag system (what's live vs. dormant by design)

The platform was deliberately built in three phases, with later phases fully coded but shipped **disabled by default** via a central feature-flag file — a mature engineering choice that let one person build ahead of the current rollout stage without risking stability of the core product:

- **Phase 1 (core, enabled by default):** Auth, onboarding, content upload + RAG training, public chat, widget embed, Stripe + Razorpay payments, pay-per-chat, creator dashboard, subscriptions.
- **Phase 2 (built, flagged off):** Creator marketplace/discovery, voice cloning (ElevenLabs), WhatsApp integration, Instagram DM integration.
- **Phase 3 (partially built):** Video avatars (D-ID), phone-call access, advanced analytics.

---

## 11. Security & reliability measures actually implemented

- JWT-based authentication with refresh tokens and multi-device session tracking
- CSRF protection
- OWASP-aligned rate limiting, backed by PostgreSQL (not just in-memory) so it holds up across restarts/instances
- Security headers via Helmet.js
- Payment webhook signature verification for both Stripe and Razorpay (prevents forged payment events)
- Structured logging via Pino
- Centralized error tracking via Sentry on both frontend and backend
- Plan-based usage gating enforced server-side (not just UI-side), so limits can't be bypassed by calling the API directly

---

## 12. Chrome Extension (separate but connected sub-product)

A Manifest V3 Chrome extension called **"Identity Mirror"** that:
- Injects directly into Gmail's compose window
- Reads the user's defined "identity" (tone, style, communication rules) from the main platform
- Generates reply drafts in that specific voice, rather than a generic AI-sounding reply
- Structured as background service worker + Gmail-specific content script + popup settings UI

This represents a second, more personal-productivity-oriented product surface built on top of the same "identity" concept as the core platform — showing the underlying idea (a portable, reusable model of a person's voice) was explored across more than one product form (monetizable creator AI clone *and* a personal writing assistant).

---

## 13. Scale of the build (objective numbers)

- **131 commits** across the project's lifetime
- Active development span: **late January 2026 to September 2026** (~8 months)
- **30+ database tables**, **50+ indexes**, all foreign-key-enforced
- **50+ REST API endpoints**
- **3 major product phases** planned and substantially implemented (not just designed on paper — Phase 2 features are fully coded, just flag-gated)
- **2 payment providers** integrated end-to-end (Stripe + Razorpay), including webhook handling and signature verification for both
- **6+ third-party service integrations**: OpenAI, Groq, Stripe, Razorpay, AWS S3, Resend, PostHog, Sentry, ElevenLabs (voice), D-ID (video)
- **1 separate browser extension** shipped as a connected sub-product
- Full separation of frontend (React/Vite) and backend (Express/TS), independently deployable

---

## 14. What this project demonstrates (for accelerator / LinkedIn framing)

Use these as the "why this matters" talking points — they are honest, defensible claims backed by what's actually in the repo:

- **End-to-end product ownership:** one person designed and built the entire stack — auth, database schema, AI/RAG pipeline, two independent payment systems, admin tooling, and a browser extension — not just a UI or just a backend.
- **Real systems-engineering decisions, not tutorial-level code:** raw SQL over an ORM for control at scale, a feature-flag architecture to ship ahead of rollout safely, versioned AI "identity" records instead of overwriting state, PostgreSQL-backed rate limiting for durability, and a background-job pattern for expensive embedding generation instead of blocking user requests.
- **Monetization built in from the start, not bolted on:** two distinct payment rails (global + India-specific) and two distinct monetization models (recurring subscription + pay-per-chat with automatic revenue split) — this is product thinking about how a two-sided marketplace actually gets paid, not just "add a Stripe button."
- **Applied AI/RAG experience:** a working retrieval-augmented generation pipeline — content ingestion, chunking, embedding generation, vector similarity search, and prompt construction that blends personality rules + retrieved knowledge + conversation history — the same core pattern used in production AI products today.
- **Willingness to build ambitiously and phase it responsibly:** Phase 2/3 features (voice cloning, video avatars, WhatsApp/Instagram bots) were fully built rather than just scoped, then deliberately gated off rather than shipped half-working — shows planning discipline, not just enthusiasm.
- **Full-cycle thinking beyond code:** launch checklists, testing checklists, deployment runbooks, and rollback plans were written for this project, showing an operational mindset (thinking about production readiness, not just "does it run on my machine").
- **Honest outcome, still a valuable data point:** the project did not acquire meaningful users despite being technically complete — a genuinely useful, common founder lesson (technical execution ≠ distribution/GTM), worth stating plainly rather than hiding. Accelerators generally respond well to candor here paired with evidence of real technical capability.

---

## 15. Suggested honest framing for external use (LinkedIn / accelerator applications)

Recommended positioning (for the second LLM to adapt into final copy):

> "MirrorMe — an AI clone platform I designed and built solo: creators upload their content and personality, and the platform generates a monetizable AI version of them (RAG-based chat, Stripe + Razorpay payments, pay-per-chat and subscription models, website widget + WordPress embed, and a companion Chrome extension for Gmail). Full production-style stack: React/TypeScript frontend, Node/Express/PostgreSQL backend, 30+ tables, 50+ API endpoints, background job processing for AI training, and a feature-flagged 3-phase roadmap (voice cloning, video avatars, WhatsApp/Instagram integration built and ready behind flags). It didn't get user traction, but it's a complete, technically real build — a good example of what I can architect and ship end-to-end."

Points to explicitly keep in any generated copy:
1. Call it a side project / independent build, not the current main venture.
2. Lead with technical scope and completeness, not user numbers.
3. Be upfront that it did not gain users — frame as a learning outcome about distribution, not a technical failure.
4. Emphasize the two hardest-to-fake signals: (a) real payment integration (not a mock), and (b) a working RAG/AI pipeline (not just a wrapper around a single prompt).

---

## 16. What is intentionally excluded from this document

Per the request, day-to-day minor bugs, incomplete polish items (e.g., WordPress plugin needing final testing, "top questions" analytics being basic, auto-payout being manual rather than automatic), and other small in-progress rough edges are intentionally left out of this document, since this project is being positioned as a completed technical showcase rather than a live product needing a full status report. If needed later, these can be pulled from `docs/FINAL_COMPLETE_A-Z_REVIEW.md`, `TODO_FINAL.md`, and `full_overview.md` in the repo.
