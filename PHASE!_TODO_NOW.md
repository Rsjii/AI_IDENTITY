Got it — ab main repo ke actual backend+frontend code ko Phase1.md ke exact flow se map karke **file-wise exact changes** likhunga (new files + existing files edits). Pehle DB schema + core services/routes ko read karke patch points lock kar raha hoon, phir per-file code blocks dunga.

[5 tools called]

Nice — repo already has strong infra (auth + identity engine + mirror logs + voice + widget + IG/WA + payments via Razorpay). Ab Phase1.md ke “AI Clone Platform” flow ke liye missing parts mainly **knowledge/content ingestion**, **public standalone chat + history**, **trial/plan gating + Stripe/pay-per-chat**, and **creator dashboard/earnings**. Next I’ll read remaining DB schema and payment/auth flows to pinpoint exact file edits.

[10 tools called]

### Important (Ask mode limit)
Aap **Ask mode** me ho, isliye main repo me changes apply/run nahi kar sakta. PHASE1.md ko “A–Z” implement karne ke liye **~25–35 files + DB migration + new modules** chahiye (1000+ LOC). Yahan main **file-wise exact change map** de raha hoon; agar aap **Agent mode** on kar do, main ye sab **exact line-level patches** ke saath repo me apply karke de dunga.

---

## ### A–Z FILE-WISE CHANGE LIST (Frontend + Backend)

## ✅ Backend (Node/Express)

### 1) DB schema upgrades — `backend/src/config/database.ts`
**Add/Change (User table):**
- `trialEndsAt TIMESTAMPTZ`
- `planTier TEXT DEFAULT 'free'` (values: `free|starter|growth|scale`)
- `onboardingStep TEXT DEFAULT 'quiz'` (values: `quiz|content|voice|plan|deploy|done`)
- `publicSlug TEXT UNIQUE` (standalone link `/chat/:slug`)
- `creatorTitle TEXT`, `creatorTags JSONB`, `priceConfig JSONB` (pay-per-chat tiers)

**Add new tables (Phase1.md required):**
- `knowledge_sources` (uploaded files / pasted text / youtube url metadata)
- `knowledge_chunks` (searchable chunks for RAG; later embeddings)
- `chat_sessions` (public + authenticated sessions)
- `chat_messages` (history)
- `stripe_customers` (map userId -> stripeCustomerId)
- `stripe_payments` (pay-per-chat PaymentIntent logs)
- `creator_earnings` (aggregated) OR compute from `stripe_payments`
- *(optional now)* `qr_links` (store generated QR + link)

**Also update queries in this same file:**
- `userQueries.create/findByEmail/findById` must SELECT/INSERT new columns.
- Add DAO objects: `knowledgeSourceQueries`, `knowledgeChunkQueries`, `chatSessionQueries`, `chatMessageQueries`, `stripeCustomerQueries`, `stripePaymentQueries`.

---

### 2) Plan + trial gating middleware — new file
**NEW:** `backend/src/middleware/planGate.ts`
- Enforce **Free=500 chats/month**, Starter=5K, Growth=25K, Scale=unlimited.
- Allow **trial**: `trialEndsAt > now()` => treat as Growth (all unlocked).
- Apply this middleware on:
  - `/api/identity/mirror`, `/api/identity/mirror-voice`
  - `/api/widget/chat`
  - `/api/instagram/webhook` + `/api/whatsapp/webhook` (creator usage counts)

---

### 3) Knowledge/content upload module — new files
**NEW:** `backend/src/modules/content/contentRoutes.ts`  
**NEW:** `backend/src/modules/content/contentController.ts`  
**NEW:** `backend/src/modules/content/contentService.ts`

Endpoints (Phase1.md “Content Upload”):
- `POST /api/content/paste` (auth) → store text
- `POST /api/content/upload` (auth, multipart) → store file in S3/R2 or local; extract text (MVP: store raw, parsing TODO)
- `POST /api/content/youtube` (auth) → store URL; later transcription
- `GET /api/content/list` (auth)
- `DELETE /api/content/:id` (auth)

---

### 4) “Training” (24h) status + job stub — new files (MVP)
**NEW:** `backend/src/modules/training/trainingService.ts`
- For now: mark `knowledge_sources.status = 'processed'` immediately after save.
- Later: async worker; for MVP just show “processing” UI optionally.

---

### 5) Standalone public chat API — new files
**NEW:** `backend/src/modules/public/publicRoutes.ts`  
**NEW:** `backend/src/modules/public/publicController.ts`

Endpoints:
- `GET /api/public/creator/:slug` → public profile + displayName + avatar + pricing config
- `POST /api/public/chat` → `{ slug, visitorId?, message }` → creates session + message history + calls mirror engine

---

### 6) Chat history saving — extend identity flow
**Edit:** `backend/src/modules/identity/identityService.ts`
- In `generateMirrorReplyWithLogging(...)` add optional params: `sessionId`, `visitorId`, `source`.
- After reply generation: write into `chat_sessions/chat_messages`.

---

### 7) Creator dashboard APIs — new files
**NEW:** `backend/src/modules/creator/creatorRoutes.ts`  
**NEW:** `backend/src/modules/creator/creatorController.ts`

Endpoints:
- `GET /api/creator/dashboard` → today/week/month chats, revenue, active sessions (approx), top questions
- `GET /api/creator/earnings` → Stripe payments list + totals

---

### 8) Stripe integration (required in PHASE1.md) — new files
**NEW:** `backend/src/modules/billing/stripeRoutes.ts`  
**NEW:** `backend/src/modules/billing/stripeController.ts`  
**NEW:** `backend/src/services/stripeService.ts`

Flows:
- **Creator subscription (Starter/Growth/Scale):**
  - `POST /api/billing/stripe/create-checkout-session`
  - `POST /api/billing/stripe/webhook` (Stripe signature verify)
- **Pay-per-chat (end user):**
  - `POST /api/billing/stripe/create-payment-intent` with amount from creator’s pricing config
  - `POST /api/billing/stripe/confirm` (or rely on webhook)

Env vars:
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_SCALE`

---

### 9) Mount routes — `backend/src/app.ts`
Add imports + `app.use(...)`:
- `/api/content`
- `/api/public`
- `/api/creator`
- `/api/billing/stripe`
And add webhook raw-body handling for Stripe route (important).

---

## ✅ Frontend (React/Vite)

### 1) Replace “IdentitySetup form only” with PHASE1 onboarding wizard
**NEW pages:**
- `frontend/react-app/src/pages/OnboardingQuizPage.tsx` (10 questions → maps to identityJson + profile fields)
- `frontend/react-app/src/pages/OnboardingContentPage.tsx` (upload/paste/youtube)
- `frontend/react-app/src/pages/OnboardingPlanPage.tsx` (trial + Stripe checkout)
- `frontend/react-app/src/pages/OnboardingDeployPage.tsx` (widget code + standalone link + WhatsApp/IG connect)

**Edit:** `frontend/react-app/src/App.tsx` routes:
- add `/onboarding/quiz`, `/onboarding/content`, `/onboarding/plan`, `/onboarding/deploy`

**Edit:** `frontend/react-app/src/pages/SignupProfilePage.tsx` (after profile completion redirect to `/onboarding/quiz`)

---

### 2) Standalone chat page
**NEW:** `frontend/react-app/src/pages/PublicChatPage.tsx`
Route: `/chat/:slug`
- WhatsApp-like UI
- creates `visitorId` in localStorage
- calls `/api/public/chat`
- shows typing indicator (local “AI is typing…” state)

---

### 3) Creator dashboard UI
**NEW:** `frontend/react-app/src/pages/CreatorDashboardPage.tsx`
Route: `/dashboard`
- chats today/week/month
- revenue
- top questions list
- quick links: Integrations, Pricing, Knowledge Base

---

### 4) Knowledge base management UI
**NEW:** `frontend/react-app/src/pages/KnowledgeBasePage.tsx`
Route: `/knowledge`
- list uploads
- paste text
- youtube url input
- delete

---

### 5) Monetization UI (pay-per-chat + tiers)
**Edit:** `frontend/react-app/src/pages/Integrations.tsx`
- add “Pricing” card: free/premium/vip amounts + save to backend (`/api/creator/pricing` or `/api/profile` update)
- show standalone link `/chat/{slug}` + copy + QR (later)

---

## ### “Exact patch blocks” (most critical ones)
Below are the core patches you can copy. (Remaining modules are too large for one message; Agent mode me main complete repo patch laga means full A–Z.)

### A) `backend/src/config/database.ts` — add Phase1 tables/columns
```diff
--- a
+++ b
@@
 CREATE TABLE IF NOT EXISTS "User" (
@@
     "profileImage" TEXT,
     "timeZone" TEXT,
+    "trialEndsAt" TIMESTAMPTZ,
+    "planTier" TEXT NOT NULL DEFAULT 'free' CHECK ("planTier" IN ('free','starter','growth','scale')),
+    "onboardingStep" TEXT NOT NULL DEFAULT 'quiz' CHECK ("onboardingStep" IN ('quiz','content','voice','plan','deploy','done')),
+    "publicSlug" TEXT UNIQUE,
+    "creatorTitle" TEXT,
+    "creatorTags" JSONB,
+    "priceConfig" JSONB,
     CONSTRAINT "User_pkey" PRIMARY KEY ("id")
 );
+
+-- ========== KNOWLEDGE BASE (Content Upload) ==========
+CREATE TABLE IF NOT EXISTS "knowledge_sources" (
+  "id" TEXT PRIMARY KEY,
+  "userId" TEXT NOT NULL,
+  "type" TEXT NOT NULL CHECK ("type" IN ('paste','file','youtube','url')),
+  "title" TEXT,
+  "originalUrl" TEXT,
+  "storageUrl" TEXT,
+  "rawText" TEXT,
+  "status" TEXT NOT NULL DEFAULT 'processed' CHECK ("status" IN ('pending','processing','processed','failed')),
+  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
+);
+
+CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
+  "id" TEXT PRIMARY KEY,
+  "userId" TEXT NOT NULL,
+  "sourceId" TEXT NOT NULL,
+  "chunkIndex" INTEGER NOT NULL,
+  "content" TEXT NOT NULL,
+  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
+);
+
+CREATE INDEX IF NOT EXISTS "idx_knowledge_sources_userId" ON "knowledge_sources"("userId");
+CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_userId" ON "knowledge_chunks"("userId");
+CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_sourceId" ON "knowledge_chunks"("sourceId");
+
+ALTER TABLE "knowledge_sources" ADD CONSTRAINT IF NOT EXISTS "knowledge_sources_userId_fkey"
+  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
+ALTER TABLE "knowledge_chunks" ADD CONSTRAINT IF NOT EXISTS "knowledge_chunks_userId_fkey"
+  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
+ALTER TABLE "knowledge_chunks" ADD CONSTRAINT IF NOT EXISTS "knowledge_chunks_sourceId_fkey"
+  FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
+
+-- ========== CHAT HISTORY ==========
+CREATE TABLE IF NOT EXISTS "chat_sessions" (
+  "id" TEXT PRIMARY KEY,
+  "creatorId" TEXT NOT NULL,
+  "visitorId" TEXT,
+  "userId" TEXT,
+  "platform" TEXT NOT NULL DEFAULT 'web',
+  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
+);
+
+CREATE TABLE IF NOT EXISTS "chat_messages" (
+  "id" TEXT PRIMARY KEY,
+  "sessionId" TEXT NOT NULL,
+  "role" TEXT NOT NULL CHECK ("role" IN ('user','assistant')),
+  "content" TEXT NOT NULL,
+  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
+);
+
+CREATE INDEX IF NOT EXISTS "idx_chat_sessions_creatorId_createdAt" ON "chat_sessions"("creatorId","createdAt");
+CREATE INDEX IF NOT EXISTS "idx_chat_messages_sessionId_createdAt" ON "chat_messages"("sessionId","createdAt");
+
+ALTER TABLE "chat_sessions" ADD CONSTRAINT IF NOT EXISTS "chat_sessions_creatorId_fkey"
+  FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
+ALTER TABLE "chat_messages" ADD CONSTRAINT IF NOT EXISTS "chat_messages_sessionId_fkey"
+  FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

---

### B) `backend/src/app.ts` — mount new routes + Stripe webhook raw body
```diff
--- a
+++ b
@@
 import whatsappRoutes from './modules/whatsapp/whatsappRoutes';
+import contentRoutes from './modules/content/contentRoutes';
+import publicRoutes from './modules/public/publicRoutes';
+import creatorRoutes from './modules/creator/creatorRoutes';
+import stripeRoutes from './modules/billing/stripeRoutes';
@@
-app.use(express.json({ limit: '10mb' }));
+// Stripe webhook needs raw body BEFORE json parser (only for that route)
+app.use('/api/billing/stripe/webhook', express.raw({ type: 'application/json' }));
+app.use(express.json({ limit: '10mb' }));
@@
 app.use('/api/instagram', instagramRoutes);
 app.use('/api/whatsapp', whatsappRoutes);
+app.use('/api/content', contentRoutes);
+app.use('/api/public', publicRoutes);
+app.use('/api/creator', creatorRoutes);
+app.use('/api/billing/stripe', stripeRoutes);
```

---

### C) `frontend/react-app/src/App.tsx` — add Phase1 routes
```diff
--- a
+++ b
@@
 import { IntegrationsPage } from './pages/Integrations';
+import { OnboardingQuizPage } from './pages/OnboardingQuizPage';
+import { OnboardingContentPage } from './pages/OnboardingContentPage';
+import { OnboardingPlanPage } from './pages/OnboardingPlanPage';
+import { OnboardingDeployPage } from './pages/OnboardingDeployPage';
+import { PublicChatPage } from './pages/PublicChatPage';
+import { CreatorDashboardPage } from './pages/CreatorDashboardPage';
+import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
@@
               <Route path="/integrations" element={<ProtectedRoute><IntegrationsPage /></ProtectedRoute>} />
+              <Route path="/onboarding/quiz" element={<ProtectedRoute><OnboardingQuizPage /></ProtectedRoute>} />
+              <Route path="/onboarding/content" element={<ProtectedRoute><OnboardingContentPage /></ProtectedRoute>} />
+              <Route path="/onboarding/plan" element={<ProtectedRoute><OnboardingPlanPage /></ProtectedRoute>} />
+              <Route path="/onboarding/deploy" element={<ProtectedRoute><OnboardingDeployPage /></ProtectedRoute>} />
+              <Route path="/dashboard" element={<ProtectedRoute><CreatorDashboardPage /></ProtectedRoute>} />
+              <Route path="/knowledge" element={<ProtectedRoute><KnowledgeBasePage /></ProtectedRoute>} />
+
+              {/* Public standalone chat */}
+              <Route path="/chat/:slug" element={<PublicChatPage />} />
```

---

## ### Next (so you actually get “line-by-line exact”)
Aapne “**exact detailed file wise line wise**” bola hai — wo realistically main **Agent mode** me hi perfect de sakta hoon (kyunki mujhe repo me files edit karke exact line locations lock karni hoti hain).

**Aap bas Agent mode on karo**, aur main:
- `content/ public/ creator/ billing(stripe)/ planGate` **modules complete implement**
- `IdentityService` me **knowledge injection + chat history**
- Frontend me **Quiz + Content Upload + Plan + Deploy wizard**
- `PublicChatPage` + typing indicator + payment prompt
- Dashboard stats API + UI  
sab **repo me apply karke** de dunga.

Bol do: **“Agent mode ON, implement Phase1 now”**.