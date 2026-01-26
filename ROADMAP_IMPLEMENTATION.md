# 🚀 AI CLONE EMPIRE - COMPLETE IMPLEMENTATION ROADMAP

**Project:** AI_IDENTITY (Selflyx)
**Current State:** MVP with Identity Engine + Chrome Extension
**Target:** All-in-One AI Clone Platform (Text + Voice + Video) with Multi-Platform Deployment
**Timeline:** Aggressive 90-Day Plan to $25K MRR

---

## 📊 EXECUTIVE SUMMARY

### What You Have NOW (Current Product):
✅ **Core Identity Engine** - AI personality cloning with rules, boundaries, style anchors
✅ **Gmail Chrome Extension** - Auto-reply suggestions in Gmail
✅ **Payment System** - Razorpay integration (₹999/mo Pro, ₹4999/mo Teams)
✅ **Authentication** - Email OTP + Google OAuth
✅ **Admin Dashboard** - User management, analytics
✅ **LLM Integration** - Groq (primary) + OpenAI (fallback)
✅ **Database** - PostgreSQL with versioned identities

### What You NEED to Build (Roadmap Gap):
❌ **Voice Cloning** - Train voice from audio samples
❌ **Video Avatar** - AI video clone (talking head)
❌ **Multi-Platform Deploy** - Instagram DM, WhatsApp, Phone, Custom Website
❌ **Creator Marketplace** - Rent AI clones (network effect)
❌ **Developer API** - White-label API for B2B
❌ **Advanced Analytics** - Engagement metrics, revenue tracking
❌ **Mobile App** - iOS/Android (optional for v1)

---

## 🎯 PART 1: CURRENT STATE DEEP DIVE

### 1.1 WHAT EXISTS (Detailed Breakdown)

#### **Frontend (React 19 + TypeScript + Vite)**

**Location:** `/frontend/react-app/`

**Tech Stack:**
- React 19.2.0 + TypeScript 5.9
- Vite 7.2.4 (build tool)
- Tailwind CSS 3.4 + shadcn/ui pattern
- React Router 7.13 (routing)
- React Query 5.90 (data fetching)
- Lucide React (icons)

**Pages Built:**
```
Public:
├─ / (Landing page)
├─ /auth (Signup/Login)
├─ /pricing (₹999/mo Pro, ₹4999/mo Teams)
├─ /privacy, /terms

Auth Flow:
├─ /signup-verify (OTP verification)
├─ /login-verify (OTP verification)
├─ /profile-complete (Name, handle, bio, DOB)
├─ /forgot-password

Core Features:
├─ /identity/setup (Create AI identity)
├─ /identity/edit (Edit identity)
├─ /mirror (Generate AI replies)
├─ /history (View past mirror runs)

Admin:
├─ /admin (User lookup, stats)

Error:
├─ /404, /403
```

**Key Features:**
- JWT auth in cookies
- CSRF token auto-refresh
- Light/dark theme toggle
- Protected routes
- Razorpay payment modal
- File upload (profile images)

---

#### **Backend (Node.js + Express + TypeScript)**

**Location:** `/backend/src/`

**Tech Stack:**
- Express.js 4.18.2
- TypeScript 5.3.3
- PostgreSQL (via `pg` 8.11.3)
- JWT + Passport (Google OAuth)
- Razorpay 2.9.6 (payments)
- OpenAI 4.20.1 + Groq API
- Nodemailer + Resend (emails)
- PostHog (analytics)
- Helmet, rate limiting (security)

**Modules:**
```
/modules/
├─ auth/          (signup, login, OTP, Google OAuth, password reset)
├─ identity/      (create, edit, version history, generate replies)
├─ extension/     (Chrome extension API, bearer tokens)
├─ history/       (mirror runs, trust events)
├─ profile/       (profile update, image upload)
├─ payment/       (Razorpay orders, subscriptions, cancel)
├─ admin/         (user lookup, stats)
```

**API Endpoints (Key Routes):**
```
Auth:
POST /api/auth/signup           (email + password → send OTP)
POST /api/auth/verify-signup    (verify OTP → create account)
POST /api/auth/login            (email + password → send OTP)
POST /api/auth/verify-login     (verify OTP → JWT token)
POST /api/auth/logout
GET  /api/auth/google           (OAuth redirect)
GET  /api/auth/google/callback
POST /api/auth/forgot-password  (send OTP)
POST /api/auth/reset-password   (verify OTP + new password)

Profile:
GET  /api/profile/me
POST /api/profile/complete      (name, handle, DOB, bio)
POST /api/profile/upload-image  (multer file upload)

Identity:
POST /api/identity/create       (create identity config)
GET  /api/identity/active       (get active version)
POST /api/identity/update       (edit identity)
GET  /api/identity/history      (version history)
POST /api/identity/set-active   (switch version)

Mirror:
POST /api/identity/mirror       (generate reply from AI)
  → Body: { context, incomingMessage, platform }
  → Response: { decision, reply, rulesApplied, tokensIn, tokensOut }

History:
GET  /api/history/runs          (past mirror runs)
POST /api/history/trust-event   (confirm_yes/no, regenerate)

Extension:
POST /api/extension/tokens/create  (generate bearer token)
GET  /api/extension/tokens         (list tokens)
DELETE /api/extension/tokens/:id   (revoke token)
POST /api/extension/mirror         (extension-specific mirror endpoint)

Payment:
POST /api/payment/create-order     (tier: pro/teams → Razorpay order)
POST /api/payment/verify           (signature verification)
POST /api/payment/cancel           (cancel subscription)
GET  /api/payment/subscription     (get status)

Admin:
POST /api/admin/user-lookup        (search by email)
GET  /api/admin/user/:id/subscription
GET  /api/admin/user/:id/runs
```

---

#### **Database Schema (PostgreSQL)**

**Location:** `/backend/src/config/database.ts`

**Tables:**

1. **User** - Core user account
   ```sql
   id, email (unique), passwordHash, googleId, handle (unique),
   name, dob, phone, bio, active, profileCompleted, profileImage,
   timeZone, referralCode, onboardingCompleted, usernameChangeCount,
   createdAt, updatedAt
   ```

2. **OTP** - Email-based authentication
   ```sql
   id, email, purpose (signup/login/password_reset),
   codeHash, expiresAt, used
   ```

3. **identities** - 1 per user
   ```sql
   id, userId (unique), activeVersionId,
   status (active/paused), createdAt, updatedAt
   ```

4. **identity_versions** - Versioned identity configs
   ```sql
   id, identityId, version, status (draft/active/archived),
   identityJson (JSONB), createdFromVersionId, createdAt
   ```

   **identityJson Structure:**
   ```json
   {
     "displayName": "Professional Sarah",
     "primaryUse": "business_networking",
     "defaults": {
       "language": "en",
       "formality": "professional",
       "directness": "balanced",
       "emojiUsage": "minimal",
       "responseLength": "medium",
       "callToAction": "subtle"
     },
     "hardRules": {
       "always": ["Be respectful", "Use proper grammar"],
       "never": ["Share personal info", "Make promises"]
     },
     "boundaries": {
       "noTopics": ["politics", "religion"],
       "noCommitments": ["meetings without confirmation"],
       "escalationRules": ["urgent requests → flag for manual review"]
     },
     "decisionPolicy": {
       "ignoreConditions": ["spam", "abuse"],
       "deferConditions": ["contract discussions"],
       "replyConditions": ["general inquiries", "networking"]
     },
     "styleAnchors": {
       "greeting": "Hi there!",
       "closing": "Best regards,",
       "signaturePhrases": ["Happy to help", "Let's connect"]
     },
     "settings": {
       "autoReply": true
     }
   }
   ```

5. **mirror_runs** - Every mirror request logged
   ```sql
   id, identityVersionId, context, incomingMessage, outputReply,
   rulesApplied (JSONB), model, tokensIn, tokensOut, platform,
   decisionAction (reply/ignore/defer), decisionReason,
   validatorStatus, validatorViolations (JSONB), latencyMs, createdAt
   ```

6. **trust_events** - User feedback
   ```sql
   id, mirrorRunId, identityVersionId,
   event (confirm_yes/no, edit_rule, regenerate),
   note, createdAt
   ```

7. **extension_tokens** - Bearer tokens for Chrome extension
   ```sql
   id, userId, tokenHash, label, scopes (JSONB),
   createdAt, lastUsedAt, revokedAt
   ```

8. **subscriptions** - Payment subscriptions
   ```sql
   id, userId, tier (free/pro/teams), status (active/cancelled),
   razorpayOrderId, razorpayPaymentId, amount (paise), currency,
   billingCycle, currentPeriodStart, currentPeriodEnd,
   cancelAtPeriodEnd, cancelledAt, createdAt, updatedAt
   ```

9. **Event** - Analytics logging
   ```sql
   id, userId, type, meta (JSONB), createdAt
   ```

10. **Invite** - Referral system (unused currently)
    ```sql
    id, code (unique), inviterId, acceptedBy, createdAt
    ```

11. **session** - Express-session storage
    ```sql
    sid, sess (JSON), expire
    ```

12. **rate_limits** - Rate limiting
    ```sql
    key, count, reset_time, window_ms, updated_at
    ```

---

#### **LLM Integration (AI Engine)**

**Location:** `/backend/src/services/llmService.ts`

**Primary Provider:** Groq API
- **Models:**
  - `llama-3.1-8b-instant` (primary)
  - `llama-2-7b`
  - `llama-4-scout-17b`
  - `qwen/qwen3-32b`
  - `groq/compound-mini` (unlimited tokens)

- **Strategy:** Circular rotation through models to handle rate limits
- **Quotas:** 500K tokens/day per model, 14.4K requests/day for Llama-3.1

**Fallback Provider:** OpenAI
- **Model:** `gpt-4o-mini`
- **Usage:** Automatic fallback on Groq failures

**Features:**
- Identity-based prompt building
- Decision logic (reply/ignore/defer/escalate)
- Output validation (rule violation checks)
- Token counting (input/output per request)
- Anonymous user support (separate API key)
- Daily token limit per user: 80,000 tokens

**Mirror Workflow:**
```
1. User sends message via /api/identity/mirror
2. Fetch active identity version from DB
3. Build prompt from identityJson
4. Send to Groq API (with model rotation)
5. Parse decision (reply/ignore/defer)
6. Validate output against rules
7. Log to mirror_runs table (tokens, latency, decision)
8. Return reply to user
```

---

#### **Chrome Extension (Gmail Integration)**

**Location:** `/extension/`

**Features:**
- Detects Gmail compose/reply windows
- Shows modal with AI-generated reply suggestions
- Bearer token authentication (separate from session)
- Trust event logging (confirm yes/no)
- Settings UI for token management

**Architecture:**
- `manifest.json` (V3)
- `background/` (service worker)
- `content/` (Gmail DOM injection)
- `popup/` (settings UI)
- `utils/` (API helpers)

**API Integration:**
- `POST /api/extension/mirror` (generate reply)
- `POST /api/extension/tokens/create` (create token)
- `GET /api/extension/tokens` (list tokens)
- `DELETE /api/extension/tokens/:id` (revoke)

---

#### **Payment System (Razorpay)**

**Location:** `/backend/src/modules/payment/`

**Tiers:**
- **Pro:** ₹999/month (99,900 paise)
- **Teams:** ₹4,999/month (499,900 paise)

**Flow:**
1. Frontend: User selects tier → `POST /api/payment/create-order`
2. Backend: Create Razorpay order → return `orderId`
3. Frontend: Open Razorpay modal → user pays
4. Razorpay: Payment success → callback with `paymentId` + `signature`
5. Frontend: `POST /api/payment/verify` with signature
6. Backend: Verify HMAC-SHA256 → create subscription in DB
7. Event logged: "payment_order_created", "subscription_created"

**Subscription Management:**
- Cancel at period end: `POST /api/payment/cancel`
- Get status: `GET /api/payment/subscription`

---

#### **Deployment (Railway)**

**Current Setup:**
- Node.js runtime
- PostgreSQL database
- Static file serving for React SPA
- Environment variables via Railway console

**Build Process:**
- Backend: `tsc` (TypeScript compilation)
- Frontend: `vite build` (React SPA)
- Serve: Express serves `/frontend/react-app/dist`

---

### 1.2 WHAT'S WORKING (Feature Summary)

✅ **Authentication:**
- Email + password signup with OTP
- Email + password login with OTP
- Google OAuth login
- Forgot password with OTP reset
- Profile completion after signup
- JWT token in cookies + session

✅ **Identity System:**
- Create AI identity with personality, rules, boundaries, style
- Version history for identity configs
- Set active version
- Edit identity

✅ **Mirror (AI Replies):**
- Generate contextual replies using identity
- Decision logic (reply/ignore/defer/escalate)
- LLM-based output validation
- Token usage tracking
- Support for contexts: linkedin_dm, email, sales, intro, support, personal

✅ **Chrome Extension:**
- Gmail integration (compose/reply detection)
- Bearer token authentication
- Mirror endpoint integration
- Trust event logging (confirm yes/no)

✅ **Payment System:**
- Razorpay integration (India-based)
- Two tiers: Pro (₹999/mo), Teams (₹4999/mo)
- Order creation and payment verification
- Subscription status tracking
- Cancel at period end

✅ **Admin Features:**
- User lookup by email
- View user subscriptions
- View mirror runs history
- User statistics

✅ **Security:**
- CSRF protection
- Helmet (security headers)
- Rate limiting
- Input validation (Zod)
- Password hashing (bcrypt)

✅ **Analytics:**
- PostHog integration
- Event logging (signup, login, payment, mirror run)

---

## 🎯 PART 2: ROADMAP REQUIREMENTS (What to Build)

### 2.1 FEATURE BREAKDOWN (From Roadmap)

Based on the roadmap, here's what the **COMPLETE PLATFORM** should offer:

#### **A. Voice Cloning**
- Upload audio samples (10-30 seconds)
- Train AI voice model
- Generate voice replies (text-to-speech)
- Deploy voice clone to:
  - Phone calls (Twilio integration)
  - WhatsApp voice messages
  - Website voice chat

#### **B. Video Avatar**
- Upload video clips (talking head)
- Train AI video model (lip-sync)
- Generate video replies
- Deploy video clone to:
  - Website video chat
  - Instagram video messages
  - Custom landing pages

#### **C. Multi-Platform Deployment**
- **Instagram DM:** Auto-reply to Instagram DMs
- **WhatsApp:** Auto-reply to WhatsApp messages
- **Phone Calls:** Voice clone answers calls
- **Website Embed:** Chat widget with text/voice/video
- **Custom App:** Mobile app (iOS/Android)

#### **D. Creator Marketplace**
- Public profile for each creator
- Rent AI clone (pay-per-chat or subscription)
- Discovery feed (browse AI clones)
- Reviews and ratings
- Creator earnings dashboard

#### **E. Developer API (White-Label)**
- REST API for businesses
- Webhook support
- Custom pricing plans
- API key management
- Documentation (Swagger/OpenAPI)

#### **F. Advanced Analytics**
- Engagement metrics (messages, replies, conversions)
- Revenue tracking (per creator, per platform)
- A/B testing for identity versions
- Heatmaps (which rules trigger most)
- Export data (CSV, JSON)

#### **G. Mobile App (Optional for v1)**
- iOS/Android native apps
- Push notifications
- Manage identity on mobile
- View analytics

---

### 2.2 GAP ANALYSIS (What's Missing)

| Feature | Current State | Required | Gap |
|---------|---------------|----------|-----|
| **Text AI** | ✅ Working | Text replies | ✅ Done |
| **Voice Clone** | ❌ None | Train + Deploy | ⚠️ **CRITICAL** |
| **Video Avatar** | ❌ None | Train + Deploy | ⚠️ **CRITICAL** |
| **Gmail** | ✅ Chrome Ext | Auto-reply | ✅ Done |
| **Instagram DM** | ❌ None | Auto-reply | ⚠️ **HIGH** |
| **WhatsApp** | ❌ None | Auto-reply | ⚠️ **HIGH** |
| **Phone Calls** | ❌ None | Voice clone | ⚠️ **MEDIUM** |
| **Website Embed** | ❌ None | Chat widget | ⚠️ **HIGH** |
| **Marketplace** | ❌ None | Public profiles | ⚠️ **HIGH** |
| **Developer API** | ❌ None | REST API | ⚠️ **MEDIUM** |
| **Analytics** | ✅ Basic | Advanced | ⚠️ **MEDIUM** |
| **Mobile App** | ❌ None | iOS/Android | ⚠️ **LOW** (v2) |
| **Payments** | ✅ Razorpay | Stripe (global) | ⚠️ **MEDIUM** |

---

## 🎯 PART 3: IMPLEMENTATION PLAN (How to Build)

### 3.1 PHASED ROLLOUT (90-Day Plan)

#### **Phase 1: Foundation (Days 1-30) → Goal: $2.5K MRR**

**Week 1-2: Voice Cloning MVP**
- **Day 1-3:** Voice upload UI (React)
  - File upload (audio: mp3, wav, m4a)
  - Preview playback
  - Submit to backend

- **Day 4-7:** Voice training backend
  - **Option A (Fast):** ElevenLabs API
    - Upload audio → get voice_id
    - Generate speech: POST /v1/text-to-speech/{voice_id}
    - Cost: $11/mo (10K chars), $99/mo (100K chars)

  - **Option B (Cheaper):** PlayHT API
    - Clone voice: POST /v2/cloned-voices
    - Generate speech: POST /v2/tts/stream
    - Cost: $19/mo (2 hours), $99/mo (20 hours)

  - **Option C (Self-Hosted):** Coqui TTS
    - Open-source, free
    - Requires GPU server (Railway GPU or AWS)
    - Higher complexity, lower cost

  - **Recommendation:** Start with **ElevenLabs** (fastest), migrate to PlayHT/Coqui later

- **Day 8-10:** Voice generation API
  - New endpoint: `POST /api/identity/mirror-voice`
  - Input: `{ text, voiceId }`
  - Output: Audio file URL (S3/Cloudinary)

- **Day 11-14:** Phone integration (Twilio)
  - Twilio phone number ($1/mo)
  - Inbound call webhook → `/api/twilio/voice`
  - TwiML response with AI voice
  - Cost: $0.0085/min (inbound), $0.02/min (outbound)

**Week 3-4: Multi-Platform Deploy (Instagram + WhatsApp)**

- **Day 15-18:** Instagram DM integration
  - **Option A:** Instagram Graph API (official, but requires Business Account)
    - Webhook setup: `/api/instagram/webhook`
    - Handle `messages` event
    - Reply via API: POST /v1/{page_id}/messages
    - Rate limit: 40 requests/second

  - **Option B:** Unofficial API (faster, but risky)
    - Use `instagram-private-api` npm package
    - Login with username/password
    - Listen for DMs, auto-reply
    - Risk: Account ban

  - **Recommendation:** Start with **Option B** for speed, migrate to Graph API after validation

- **Day 19-22:** WhatsApp integration
  - **Option A:** WhatsApp Business API (official)
    - Apply for access (2-4 weeks approval)
    - Webhook: `/api/whatsapp/webhook`
    - Reply via API: POST /v1/messages
    - Cost: $0.005-0.009 per message (country-dependent)

  - **Option B:** Twilio WhatsApp (faster)
    - Twilio WhatsApp sandbox (instant)
    - Webhook: `/api/twilio/whatsapp`
    - Reply via Twilio API
    - Cost: $0.005/message

  - **Recommendation:** Start with **Twilio WhatsApp** (instant), apply for official API in parallel

- **Day 23-25:** Website embed (chat widget)
  - Create embeddable script: `<script src="https://yourclone.ai/embed.js">`
  - React widget (iframe or Web Components)
  - Configuration: `{ apiKey, theme, position }`
  - WebSocket for real-time chat

- **Day 26-30:** Testing + First Customers
  - Manual outreach to 50 creators
  - Onboard 5-10 beta users
  - Fix bugs, iterate
  - **Goal:** $500-1K MRR (5 x $99/mo)

---

#### **Phase 2: Marketplace (Days 31-60) → Goal: $10K MRR**

**Week 5-6: Public Profiles**

- **Day 31-35:** Public profile page
  - New table: `public_profiles`
    ```sql
    CREATE TABLE "public_profiles" (
      id TEXT PRIMARY KEY,
      userId TEXT UNIQUE REFERENCES "User"(id),
      slug TEXT UNIQUE, -- e.g., "sarahcoach"
      displayName TEXT,
      bio TEXT,
      avatarUrl TEXT,
      tags TEXT[], -- e.g., ["fitness", "motivation"]
      isPublic BOOLEAN DEFAULT false,
      isPremium BOOLEAN DEFAULT false,
      pricePerChat DECIMAL, -- e.g., 5.00 (USD)
      currency TEXT DEFAULT 'USD',
      totalChats INTEGER DEFAULT 0,
      rating DECIMAL, -- avg rating 1-5
      createdAt TIMESTAMPTZ
    );
    ```

  - Public URL: `https://yourclone.ai/c/sarahcoach`
  - Profile editor: `/profile/marketplace`

- **Day 36-40:** Marketplace discovery
  - Homepage: `/marketplace`
  - Filters: Category, price range, rating
  - Search by name/tags
  - Featured creators section

- **Day 41-45:** Pay-per-chat system
  - New table: `chat_sessions`
    ```sql
    CREATE TABLE "chat_sessions" (
      id TEXT PRIMARY KEY,
      userId TEXT REFERENCES "User"(id), -- buyer
      creatorId TEXT REFERENCES "User"(id), -- seller
      amount DECIMAL, -- price paid
      currency TEXT,
      messagesCount INTEGER,
      status TEXT, -- active, completed, refunded
      createdAt TIMESTAMPTZ,
      completedAt TIMESTAMPTZ
    );
    ```

  - Payment flow:
    1. User clicks "Chat with AI" → Pay $5
    2. Stripe checkout (add Stripe alongside Razorpay)
    3. Create chat session → redirect to `/chat/:sessionId`
    4. Log messages in `mirror_runs` with `sessionId`
    5. Creator earns 70%, platform takes 30%

- **Day 46-50:** Reviews and ratings
  - New table: `reviews`
    ```sql
    CREATE TABLE "reviews" (
      id TEXT PRIMARY KEY,
      sessionId TEXT REFERENCES "chat_sessions"(id),
      userId TEXT REFERENCES "User"(id),
      creatorId TEXT REFERENCES "User"(id),
      rating INTEGER, -- 1-5
      comment TEXT,
      createdAt TIMESTAMPTZ
    );
    ```

  - Show reviews on public profile
  - Average rating display

**Week 7-8: Creator Tools**

- **Day 51-55:** Creator dashboard
  - Page: `/creator/dashboard`
  - Metrics:
    - Total chats this month
    - Revenue (gross, net)
    - Average rating
    - Top platforms (Instagram, WhatsApp, Website)
  - Export data (CSV)

- **Day 56-60:** Payout system
  - New table: `payouts`
    ```sql
    CREATE TABLE "payouts" (
      id TEXT PRIMARY KEY,
      creatorId TEXT REFERENCES "User"(id),
      amount DECIMAL,
      currency TEXT,
      status TEXT, -- pending, paid, failed
      payoutMethod TEXT, -- bank_transfer, paypal, razorpay
      createdAt TIMESTAMPTZ,
      paidAt TIMESTAMPTZ
    );
    ```

  - Integration:
    - **India:** Razorpay Payouts API
    - **Global:** Stripe Connect (70/30 split)

  - Auto-payout every month (threshold: $100)

---

#### **Phase 3: Developer API (Days 61-75) → Goal: $25K MRR**

**Week 9-10: REST API**

- **Day 61-65:** API key management
  - New table: `api_keys`
    ```sql
    CREATE TABLE "api_keys" (
      id TEXT PRIMARY KEY,
      userId TEXT REFERENCES "User"(id),
      keyHash TEXT UNIQUE,
      label TEXT,
      scopes TEXT[], -- ["mirror:read", "mirror:write", "identity:read"]
      rateLimit INTEGER, -- requests/minute
      createdAt TIMESTAMPTZ,
      lastUsedAt TIMESTAMPTZ,
      revokedAt TIMESTAMPTZ
    );
    ```

  - Page: `/developer/api-keys`
  - Generate key: `sk_live_xxx` (bcrypt hash stored)

- **Day 66-70:** Public API endpoints
  - **Authentication:** Bearer token (`Authorization: Bearer sk_live_xxx`)

  - **Endpoints:**
    ```
    POST /v1/mirror
      → Generate AI reply
      → Body: { context, message, userId }
      → Response: { reply, decision, tokensUsed }

    POST /v1/mirror/voice
      → Generate voice reply
      → Body: { text, voiceId }
      → Response: { audioUrl }

    GET /v1/identity
      → Get active identity
      → Response: { identity }

    POST /v1/identity
      → Update identity
      → Body: { identityJson }

    POST /v1/webhooks
      → Register webhook URL
      → Events: mirror.generated, identity.updated
    ```

  - Rate limiting: 100 req/min (free), 1000 req/min (paid)

- **Day 71-75:** Documentation
  - Use Swagger/OpenAPI
  - Interactive docs: `/developer/docs`
  - Code examples (cURL, Python, JavaScript, Ruby)
  - Webhook testing tool

---

#### **Phase 4: Video Avatar (Days 76-90) → Goal: Unicorn Path**

**Week 11-12: Video Cloning**

- **Day 76-80:** Video upload + training
  - **Option A (Fast):** Synthesia API
    - Upload video → create avatar
    - Generate video: POST /v2/videos
    - Cost: $67/mo (120 videos), $199/mo (360 videos)

  - **Option B (Cheaper):** D-ID API
    - Upload video → create presenter
    - Generate video: POST /talks
    - Cost: $49/mo (20 mins), $199/mo (200 mins)

  - **Option C (Self-Hosted):** Wav2Lip (open-source)
    - Train on custom video
    - Requires GPU server
    - Free, but complex

  - **Recommendation:** Start with **D-ID** (balance of cost + quality)

- **Day 81-85:** Video generation API
  - New endpoint: `POST /api/identity/mirror-video`
  - Input: `{ text, avatarId }`
  - Output: Video file URL (S3/Cloudinary)

- **Day 86-90:** Video deployment
  - Website embed (video widget)
  - Instagram video DMs
  - Custom landing pages with AI video clone

---

### 3.2 TECH STACK RECOMMENDATIONS

#### **Voice Cloning:**
| Service | Pros | Cons | Cost |
|---------|------|------|------|
| ElevenLabs | Best quality, fast | Expensive at scale | $99/mo |
| PlayHT | Good quality, cheaper | Slightly slower | $19-99/mo |
| Coqui TTS | Free, self-hosted | Requires GPU, complex | GPU cost (~$50/mo) |

**Recommendation:** ElevenLabs for MVP, migrate to PlayHT at scale.

---

#### **Video Cloning:**
| Service | Pros | Cons | Cost |
|---------|------|------|------|
| Synthesia | Enterprise quality | Very expensive | $67-199/mo |
| D-ID | Good quality, affordable | Limited customization | $49-199/mo |
| Wav2Lip | Free, full control | Complex setup, GPU needed | GPU cost (~$100/mo) |

**Recommendation:** D-ID for MVP, evaluate Synthesia for enterprise.

---

#### **Instagram DM:**
| Approach | Pros | Cons | Risk |
|----------|------|------|------|
| Graph API | Official, stable | Requires Business Account | Low |
| Private API | Fast setup | Account ban risk | High |

**Recommendation:** Private API for MVP (fast validation), migrate to Graph API for scale.

---

#### **WhatsApp:**
| Approach | Pros | Cons | Cost |
|----------|------|------|------|
| Twilio WhatsApp | Instant setup | Sandbox limitations | $0.005/msg |
| WhatsApp Business API | Official, scalable | 2-4 weeks approval | $0.005-0.009/msg |

**Recommendation:** Twilio for MVP, apply for official API in parallel.

---

#### **Payments:**
| Provider | Use Case | Cost |
|----------|----------|------|
| Razorpay | India market | 2% + ₹0 |
| Stripe | Global market | 2.9% + $0.30 |

**Recommendation:** Keep Razorpay for India, add Stripe for global expansion.

---

### 3.3 DATABASE SCHEMA ADDITIONS

#### **New Tables Needed:**

```sql
-- Voice Clones
CREATE TABLE "voice_clones" (
  id TEXT PRIMARY KEY,
  userId TEXT REFERENCES "User"(id),
  voiceId TEXT, -- ElevenLabs voice_id
  label TEXT, -- "Professional", "Casual"
  sampleAudioUrl TEXT,
  provider TEXT, -- "elevenlabs", "playht", "coqui"
  status TEXT, -- "training", "ready", "failed"
  createdAt TIMESTAMPTZ
);

-- Video Avatars
CREATE TABLE "video_avatars" (
  id TEXT PRIMARY KEY,
  userId TEXT REFERENCES "User"(id),
  avatarId TEXT, -- D-ID presenter_id
  label TEXT,
  sampleVideoUrl TEXT,
  provider TEXT, -- "did", "synthesia", "wav2lip"
  status TEXT, -- "training", "ready", "failed"
  createdAt TIMESTAMPTZ
);

-- Public Profiles (Marketplace)
CREATE TABLE "public_profiles" (
  id TEXT PRIMARY KEY,
  userId TEXT UNIQUE REFERENCES "User"(id),
  slug TEXT UNIQUE,
  displayName TEXT,
  bio TEXT,
  avatarUrl TEXT,
  tags TEXT[],
  isPublic BOOLEAN DEFAULT false,
  isPremium BOOLEAN DEFAULT false,
  pricePerChat DECIMAL,
  currency TEXT DEFAULT 'USD',
  totalChats INTEGER DEFAULT 0,
  rating DECIMAL,
  createdAt TIMESTAMPTZ
);

-- Chat Sessions (Pay-per-chat)
CREATE TABLE "chat_sessions" (
  id TEXT PRIMARY KEY,
  userId TEXT REFERENCES "User"(id), -- buyer
  creatorId TEXT REFERENCES "User"(id), -- seller
  amount DECIMAL,
  currency TEXT,
  messagesCount INTEGER DEFAULT 0,
  status TEXT, -- active, completed, refunded
  createdAt TIMESTAMPTZ,
  completedAt TIMESTAMPTZ
);

-- Reviews
CREATE TABLE "reviews" (
  id TEXT PRIMARY KEY,
  sessionId TEXT REFERENCES "chat_sessions"(id),
  userId TEXT REFERENCES "User"(id),
  creatorId TEXT REFERENCES "User"(id),
  rating INTEGER, -- 1-5
  comment TEXT,
  createdAt TIMESTAMPTZ
);

-- API Keys (Developer API)
CREATE TABLE "api_keys" (
  id TEXT PRIMARY KEY,
  userId TEXT REFERENCES "User"(id),
  keyHash TEXT UNIQUE,
  label TEXT,
  scopes TEXT[],
  rateLimit INTEGER,
  createdAt TIMESTAMPTZ,
  lastUsedAt TIMESTAMPTZ,
  revokedAt TIMESTAMPTZ
);

-- Webhooks (Developer API)
CREATE TABLE "webhooks" (
  id TEXT PRIMARY KEY,
  userId TEXT REFERENCES "User"(id),
  url TEXT,
  events TEXT[], -- ["mirror.generated", "identity.updated"]
  secret TEXT, -- for signature verification
  status TEXT, -- active, paused
  createdAt TIMESTAMPTZ
);

-- Payouts (Creator earnings)
CREATE TABLE "payouts" (
  id TEXT PRIMARY KEY,
  creatorId TEXT REFERENCES "User"(id),
  amount DECIMAL,
  currency TEXT,
  status TEXT, -- pending, paid, failed
  payoutMethod TEXT,
  createdAt TIMESTAMPTZ,
  paidAt TIMESTAMPTZ
);

-- Platform Integrations (Track connected accounts)
CREATE TABLE "platform_integrations" (
  id TEXT PRIMARY KEY,
  userId TEXT REFERENCES "User"(id),
  platform TEXT, -- "instagram", "whatsapp", "phone", "website"
  status TEXT, -- active, paused, disconnected
  config JSONB, -- platform-specific config
  createdAt TIMESTAMPTZ,
  lastSyncAt TIMESTAMPTZ
);
```

---

### 3.4 API ENDPOINTS TO ADD

#### **Voice Cloning:**
```
POST /api/voice/upload        (upload audio sample)
POST /api/voice/train          (train voice model)
GET  /api/voice/list           (list voice clones)
POST /api/identity/mirror-voice (generate voice reply)
```

#### **Video Avatars:**
```
POST /api/video/upload         (upload video sample)
POST /api/video/train          (train video model)
GET  /api/video/list           (list avatars)
POST /api/identity/mirror-video (generate video reply)
```

#### **Marketplace:**
```
GET  /api/marketplace/profiles (browse public profiles)
GET  /api/marketplace/profile/:slug (get profile by slug)
POST /api/marketplace/chat/create (start paid chat session)
POST /api/marketplace/review/create (leave review)
```

#### **Multi-Platform:**
```
POST /api/instagram/webhook    (Instagram DM webhook)
POST /api/whatsapp/webhook     (WhatsApp webhook)
POST /api/twilio/voice         (Phone call webhook)
POST /api/twilio/whatsapp      (Twilio WhatsApp webhook)
GET  /api/integrations/list    (list connected platforms)
POST /api/integrations/connect (connect platform)
DELETE /api/integrations/:id   (disconnect platform)
```

#### **Developer API (Public v1):**
```
POST /v1/mirror                (generate text reply)
POST /v1/mirror/voice          (generate voice reply)
POST /v1/mirror/video          (generate video reply)
GET  /v1/identity              (get identity)
POST /v1/identity              (update identity)
POST /v1/webhooks              (register webhook)
GET  /v1/webhooks              (list webhooks)
DELETE /v1/webhooks/:id        (delete webhook)
```

#### **Creator Dashboard:**
```
GET  /api/creator/stats        (revenue, chats, ratings)
GET  /api/creator/payouts      (payout history)
POST /api/creator/payout/request (request payout)
GET  /api/creator/export       (export CSV data)
```

---

### 3.5 FRONTEND PAGES TO ADD

#### **Voice/Video Setup:**
```
/voice/setup                   (upload audio sample)
/video/setup                   (upload video sample)
/voice/manage                  (list voice clones)
/video/manage                  (list avatars)
```

#### **Marketplace:**
```
/marketplace                   (browse creators)
/marketplace/:slug             (public profile)
/marketplace/chat/:sessionId   (paid chat interface)
```

#### **Integrations:**
```
/integrations                  (connect Instagram, WhatsApp, etc.)
/integrations/instagram        (Instagram setup)
/integrations/whatsapp         (WhatsApp setup)
/integrations/phone            (Phone setup)
/integrations/website          (Website embed code)
```

#### **Creator Dashboard:**
```
/creator/dashboard             (stats, revenue)
/creator/payouts               (payout history)
/creator/profile               (marketplace profile editor)
```

#### **Developer:**
```
/developer/api-keys            (manage API keys)
/developer/docs                (API documentation)
/developer/webhooks            (webhook management)
```

---

## 🎯 PART 4: EXECUTION CHECKLIST

### 4.1 IMMEDIATE NEXT STEPS (Days 1-7)

**Day 1 (Today):**
- [ ] Read this document completely
- [ ] Choose voice provider (ElevenLabs recommended)
- [ ] Sign up for ElevenLabs API ($11/mo to start)
- [ ] Create new Git branch: `git checkout -b feature/voice-cloning`

**Day 2-3:**
- [ ] Create voice upload UI
  - [ ] File input (mp3, wav, m4a)
  - [ ] Preview playback
  - [ ] Submit button
- [ ] Create backend endpoint: `POST /api/voice/upload`
  - [ ] Multer file upload
  - [ ] Store in S3/Cloudinary
  - [ ] Save URL in database

**Day 4-5:**
- [ ] Integrate ElevenLabs API
  - [ ] Create voice clone: POST to ElevenLabs
  - [ ] Store voice_id in database
  - [ ] Update UI with training status
- [ ] Create endpoint: `POST /api/voice/train`

**Day 6-7:**
- [ ] Create voice generation endpoint
  - [ ] `POST /api/identity/mirror-voice`
  - [ ] Input: `{ text, voiceId }`
  - [ ] Call ElevenLabs TTS API
  - [ ] Return audio URL
- [ ] Test end-to-end flow

**Day 8-10:**
- [ ] Twilio phone integration
  - [ ] Buy Twilio number
  - [ ] Create webhook: `POST /api/twilio/voice`
  - [ ] Generate TwiML with AI voice
  - [ ] Test inbound call

**Day 11-14:**
- [ ] Instagram DM integration
  - [ ] Install `instagram-private-api` package
  - [ ] Create login flow
  - [ ] Listen for DMs
  - [ ] Auto-reply with AI
  - [ ] Test with personal account

**Day 15-21:**
- [ ] WhatsApp integration (Twilio)
  - [ ] Set up Twilio WhatsApp sandbox
  - [ ] Create webhook: `POST /api/twilio/whatsapp`
  - [ ] Auto-reply with AI
  - [ ] Test with test number

**Day 22-25:**
- [ ] Website embed (chat widget)
  - [ ] Create React widget component
  - [ ] Build embeddable script
  - [ ] Test on sample website

**Day 26-30:**
- [ ] Manual outreach to 50 creators (Instagram, Twitter)
- [ ] Onboard 5-10 beta users
- [ ] Fix bugs, iterate
- [ ] **GOAL:** Get first paying customer ($99)

---

### 4.2 SUCCESS METRICS (Track Weekly)

**Week 1:**
- [ ] Voice cloning working (at least 1 sample)
- [ ] Phone integration working (1 test call)

**Week 2:**
- [ ] Instagram DM working (1 account connected)
- [ ] WhatsApp working (1 test chat)

**Week 3:**
- [ ] Website embed working (1 test site)
- [ ] First beta user onboarded

**Week 4:**
- [ ] 5-10 beta users
- [ ] $500-1K MRR
- [ ] All feedback documented

---

### 4.3 REVENUE MILESTONES

| Milestone | MRR | Customers | Action |
|-----------|-----|-----------|--------|
| Launch | $0 | 0 | Manual outreach |
| Beta | $500 | 5 | Fix bugs, iterate |
| PMF | $2.5K | 25 | Scale outreach |
| Growth | $10K | 100 | Hire sales |
| Scale | $25K | 250 | Raise seed |
| Exit | $100K | 1000 | Series A |

---

## 🎯 PART 5: COMPETITIVE ANALYSIS

### 5.1 CURRENT COMPETITORS

| Competitor | Strength | Weakness | Your Edge |
|------------|----------|----------|-----------|
| **Delphi** | Established, $2.7M raised | Text only, expensive ($99/mo) | Voice + Video + cheaper |
| **Character.AI** | Huge user base (200M+) | No monetization for creators | Marketplace + payouts |
| **Replika** | Best companion experience | Not for creators | B2B focus |
| **Personal.AI** | Memory focus | Limited platforms | Multi-platform |

---

### 5.2 YOUR UNFAIR ADVANTAGES

1. **All-in-One:** Text + Voice + Video (nobody has this)
2. **Multi-Platform:** Website + Instagram + WhatsApp + Phone (nobody has this)
3. **Marketplace:** Creators can rent AI clones (Character.AI doesn't allow)
4. **Developer API:** White-label for businesses (Delphi doesn't offer)
5. **Affordable:** $99/mo vs Delphi $99/mo (but you offer more)

---

## 🎯 PART 6: FUNDING STRATEGY

### 6.1 BOOTSTRAP TO $10K MRR

**Month 1-3:** Self-funded
- Use 1 LPM job income for server costs
- Keep costs low (use free tiers)
- Manual onboarding (no ads)

**Month 4-6:** Revenue-funded growth
- Reinvest revenue into ads
- Hire part-time VA for outreach
- Scale to $25K MRR

---

### 6.2 RAISE SEED AT $25K MRR

**Target:** $500K-1M seed round
- **Valuation:** $5-10M (based on $25K MRR × 200 multiple)
- **Use of funds:**
  - Hire 3-5 engineers
  - Marketing budget ($50K/mo)
  - Scale infrastructure
  - Mobile app development

**Pitch Deck:**
- Problem: Creators get 10K+ DMs/month, can't respond
- Solution: AI clone (text + voice + video)
- Traction: $25K MRR, 250 customers, 80% retention
- Market: $100B creator economy
- Ask: $500K-1M seed

---

## 🎯 PART 7: RISKS & MITIGATION

### 7.1 TECHNICAL RISKS

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| LLM costs too high | High | High | Groq (free) + token limits |
| Voice cloning quality poor | Medium | High | Use ElevenLabs (best quality) |
| Instagram account bans | High | Medium | Use Graph API (official) |
| Video cloning too slow | Medium | Medium | Use D-ID (fast generation) |

---

### 7.2 BUSINESS RISKS

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| No creators sign up | Medium | High | Manual outreach (50/day) |
| Churn too high | Medium | High | Focus on engagement metrics |
| Competitors copy | High | Medium | Move fast, network effects |
| Payment fraud | Low | High | Stripe Radar, manual review |

---

## 🎯 PART 8: FINAL CHECKLIST

### 8.1 BEFORE YOU START CODING

- [ ] Read this document 2-3 times
- [ ] Create detailed task list in TodoWrite
- [ ] Set up development environment
- [ ] Create Git branch: `feature/voice-cloning`
- [ ] Sign up for APIs:
  - [ ] ElevenLabs ($11/mo)
  - [ ] Twilio (pay-as-go)
  - [ ] Stripe (free)
- [ ] Tell 3 friends you're building this (accountability)

---

### 8.2 WEEK 1 DELIVERABLES

- [ ] Voice upload UI
- [ ] Voice training backend
- [ ] Voice generation API
- [ ] Phone integration (Twilio)
- [ ] Test end-to-end flow

---

### 8.3 MONTH 1 DELIVERABLES

- [ ] Voice cloning working
- [ ] Instagram DM integration
- [ ] WhatsApp integration
- [ ] Website embed
- [ ] 5-10 beta customers
- [ ] $500-1K MRR

---

## 🎯 CONCLUSION

**You Have:**
- ✅ Solid MVP (identity engine + Chrome extension + payments)
- ✅ Technical skills to build
- ✅ Clear roadmap (this document)
- ✅ Financial buffer (1 LPM job)

**You Need:**
- ⚠️ Voice cloning (ElevenLabs API - 7 days)
- ⚠️ Multi-platform (Instagram, WhatsApp - 14 days)
- ⚠️ Marketplace (public profiles - 30 days)
- ⚠️ Developer API (white-label - 15 days)
- ⚠️ Video avatars (D-ID API - 14 days)

**Total Time to Complete Platform:** 90 days

**Minimum Time to First Revenue:** 30 days

**Time to $25K MRR (Seed Round):** 90-180 days

---

## 🔥 THE BRUTAL TRUTH

Bhai, you're sitting on a **potential unicorn**. But:

- 99% won't execute (they'll just read this doc)
- 1% will start but quit at first bug
- 0.1% will push through to $1K MRR
- 0.01% will reach $100K MRR

**The gap between you and $1B is NOT:**
- Intelligence (you're smart)
- Skills (you can code)
- Idea (you have this roadmap)

**It's EXECUTION.**

---

## ⏰ START NOW

**Next 60 seconds:**
1. Open terminal
2. Run: `git checkout -b feature/voice-cloning`
3. Create file: `touch backend/src/modules/voice/index.ts`

**Next 60 minutes:**
1. Sign up for ElevenLabs
2. Read their docs
3. Create upload UI

**Next 7 days:**
- Voice cloning working
- Phone integration live
- Test with 10 people

---

# 🚀 YOU GOT THIS, BHAI!

Now **CLOSE THIS DOCUMENT** and **START BUILDING**.

No more planning. Just EXECUTE.

**The timer starts... NOW.** ⏱️
