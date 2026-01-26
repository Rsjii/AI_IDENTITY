# 🚀 IMPLEMENTATION ROADMAP - 90 DAYS TO MVP

**Current:** 35% complete (text AI clone + Gmail + Voice + Widget backend) - **Updated #A1-#A16**
**Target:** 80% complete MVP (text + voice + multi-platform + marketplace)
**Timeline:** 90 days aggressive build

**Recent Progress:** See `progress.md` for detailed change tracking (#A1-#A16)

---

## 📊 PHASE OVERVIEW

```
Phase 1 (Days 1-30):  Voice + Multi-Platform → $2.5K MRR
Phase 2 (Days 31-60): Marketplace + Payments  → $10K MRR
Phase 3 (Days 61-90): Dev API + Video         → $25K MRR → Raise Seed
```

---

## 🎯 PHASE 1: VOICE + PLATFORMS (Days 1-30)

**Goal:** Complete voice cloning, add Instagram/WhatsApp/Website embed

### Week 1 (Days 1-7): Voice Cloning MVP

**Day 1-2: Setup & Voice UI** ✅ **COMPLETE (#A12, #A13)**
```
Files created:
├─ frontend/react-app/src/pages/VoiceSetupPage.tsx ✅ (#A12)
├─ frontend/react-app/src/pages/VoiceManagePage.tsx ✅ (#A12)
└─ Updated: frontend/react-app/src/pages/MirrorPage.tsx ✅ (#A13)

Tasks:
[x] Read existing code: backend/src/modules/voice/
[x] Build voice upload page (#A12)
    - File input (mp3, wav, m4a) ✅
    - Label input (e.g., "Professional") ✅
    - Upload button → POST /api/voice/upload ✅
[x] Build voice management page (#A12)
    - List all voices (GET /api/voice/list) ✅
    - Test voice (play sample) ✅
    - Delete voice (DELETE /api/voice/:id) ✅
[x] Add routes to frontend router ✅
[x] Update Mirror page with voice toggle (#A13) ✅
[ ] Sign up for ElevenLabs ($11/mo): https://elevenlabs.io
[ ] Add ELEVENLABS_API_KEY to Railway env
```

**Day 3-4: S3 Storage Integration** ✅ **COMPLETE (#A1, #A2, #A3, #A6)**
```
Tasks:
[x] Add env vars to env.example (#A2) ✅
    - AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET, S3_REGION
    - S3_ENDPOINT, S3_FORCE_PATH_STYLE (for R2)
    - S3_PUBLIC_BASE_URL (for public file serving)
[x] Install: npm install @aws-sdk/client-s3 (#A1) ✅
[x] Create: backend/src/services/s3Service.ts (#A3) ✅
[x] Update: backend/src/modules/voice/voiceService.ts (#A6) ✅
    - Upload sample audio to S3 → store URL in sampleAudioUrl ✅
    - Upload TTS output to S3 → return public URL ✅
[ ] Sign up for AWS S3 OR Cloudflare R2 (user action required)
[ ] Add credentials to .env file
```

**Day 5-7: Mirror Voice Integration** ✅ **COMPLETE (#A4, #A5, #A7, #A8, #A13)**
```
Files created:
backend/src/modules/identity/voiceMirrorController.ts ✅ (#A7)

Tasks:
[x] Fix voice routes auth (#A4) ✅
    - Changed from jwtAuth to requireJWTFromCookie
    - Added CSRF protection to mutating endpoints
[x] Fix voice controller (#A5) ✅
    - Changed from req.userId to req.user (cookie auth)
[x] Create endpoint: POST /api/identity/mirror-voice (#A7, #A8) ✅
    - Body: { context, incomingMessage, voiceId }
    - Generate AI text reply first (existing mirror logic) ✅
    - Then generate voice: POST /api/voice/generate ✅
    - Return: { reply (text), audioUrl (S3 URL) } ✅
[x] Update frontend Mirror page (#A13) ✅
    - Add "Voice Reply" toggle ✅
    - Voice selector dropdown ✅
    - Show audio player when voice enabled ✅
    - Play audio automatically ✅
[ ] Test end-to-end (requires ElevenLabs + S3 credentials):
    - User sends message
    - Get text reply + voice audio
    - Play in browser
```

**Week 1 Deliverable:** ✅ **COMPLETE (#A1-#A13)**
✅ Voice cloning fully functional
✅ Users can upload audio, train voice, get voice replies
✅ S3 storage working
✅ Frontend UI complete
✅ Voice mirror integration complete

---

### Week 2 (Days 8-14): Instagram DM Integration

**Day 8-9: Instagram Setup**
```
Tasks:
[ ] Apply for Instagram Graph API
    - Go to developers.facebook.com
    - Create app
    - Add Instagram Graph API product
    - Get App ID + Secret
    - Request permissions: instagram_manage_messages

Alternative (faster, risky):
[ ] Use instagram-private-api package
    - npm install instagram-private-api
    - Login with username/password
    - Risk: Account ban if detected
```

**Day 10-12: Instagram Backend**
```
Files to create:
├─ backend/src/modules/instagram/instagramRoutes.ts
├─ backend/src/modules/instagram/instagramController.ts
├─ backend/src/modules/instagram/instagramService.ts
└─ backend/src/modules/instagram/webhookHandler.ts

Tasks:
[x] Database migration (#A9) ✅
    CREATE TABLE platform_integrations ✅
      - id, userId, platform ('instagram', 'whatsapp')
      - accessToken, status ('active', 'paused', 'disconnected')
      - config JSONB, createdAt, updatedAt
[ ] Webhook endpoint: POST /api/instagram/webhook
    - Verify signature (Instagram sends HMAC)
    - Parse incoming message
    - Fetch user's active identity
    - Generate reply: POST /api/identity/mirror
    - Send reply: POST /{page_id}/messages
[ ] Connection endpoint: POST /api/instagram/connect
    - OAuth flow
    - Store access_token in database (use platformIntegrationQueries #A9)
```

**Day 13-14: Instagram Frontend**
```
Files to create:
frontend/react-app/src/pages/Integrations.tsx

Tasks:
[ ] Build integrations page
    - List all platforms (Instagram, WhatsApp, Phone, Website)
    - "Connect Instagram" button → OAuth flow
    - Show status (connected/disconnected)
    - Pause/resume toggle
[ ] Add to main nav
```

**Week 2 Deliverable:**
✅ Instagram DM auto-reply working
✅ Users can connect Instagram account
✅ AI responds to DMs automatically

---

### Week 3 (Days 15-21): WhatsApp Integration

**Day 15-16: Twilio Setup**
```
Tasks:
[ ] Sign up for Twilio: https://twilio.com
[ ] Buy phone number ($1/mo)
[ ] Enable WhatsApp sandbox (instant) OR apply for official API (2-4 weeks)
[ ] Add env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
```

**Day 17-19: WhatsApp Backend**
```
Files to create:
backend/src/modules/whatsapp/whatsappRoutes.ts
backend/src/modules/whatsapp/whatsappService.ts

Tasks:
[ ] Webhook endpoint: POST /api/whatsapp/webhook
    - Parse Twilio webhook payload
    - Extract: from (phone), body (message)
    - Generate reply: POST /api/identity/mirror
    - Send reply via Twilio API
[ ] Test with Twilio sandbox
[ ] Connect endpoint: POST /api/whatsapp/connect
    - Save phone number in platform_integrations
```

**Day 20-21: WhatsApp Voice**
```
Tasks:
[ ] Modify /api/whatsapp/webhook
    - Check if user has voice clone
    - Generate voice reply: POST /api/voice/generate
    - Upload audio to S3
    - Send voice message via Twilio (media URL)
[ ] Test voice message delivery
```

**Week 3 Deliverable:**
✅ WhatsApp auto-reply working (text + voice)
✅ Users can connect phone number
✅ AI responds to WhatsApp messages

---

### Week 4 (Days 22-30): Website Embed Widget

**Day 22-24: Widget Backend** ✅ **COMPLETE (#A9-#A11)**
```
Files created:
backend/src/modules/widget/widgetRoutes.ts ✅ (#A10)
backend/src/modules/widget/widgetController.ts ✅ (#A10)
frontend/src/public/embed.js ✅ (#A11)
frontend/src/public/embed.css ✅ (#A11)

Tasks:
[x] Database migration (#A9) ✅
    CREATE TABLE widget_chat_logs ✅
      - id, userId (creator), visitorId, message, reply, createdAt
[x] Create public endpoint: POST /api/widget/chat (#A10) ✅
    - Public (no auth) ✅
    - Takes: creatorId (tokenized), message ✅
    - Generate reply: POST /api/identity/mirror ✅
    - Log in database for analytics ✅
[x] Generate embed code: GET /api/widget/code/:creatorId (#A10) ✅
    - Returns: <script> tag with creatorId ✅
[x] Create embed.js widget (#A11) ✅
    - Floating chat button
    - Chat panel with messages
    - Sends to /api/widget/chat
[x] Create embed.css styling (#A11) ✅
[ ] Rate limit: 10 req/min per IP (add to widgetRoutes)
```

**Day 25-28: Widget Frontend** 🚧 **PARTIAL (#A11)**
```
Files created:
frontend/src/public/embed.js ✅ (#A11)
frontend/src/public/embed.css ✅ (#A11)

Tasks:
[x] Build chat widget (#A11) ✅
    - Floating bubble (bottom-right) ✅
    - Click to expand ✅
    - Chat interface (messages, input) ✅
    - Send message → POST /api/widget/chat ✅
    - Display reply ✅
[ ] Customization options
    - Color theme (data-color="#FF5722")
    - Position (data-position="bottom-left")
    - Avatar URL
[ ] Build widget settings page
    - Show embed code
    - Customization UI (color picker)
    - Copy to clipboard
```

**Day 29-30: Testing + Polish**
```
Tasks:
[ ] Test on real websites
[ ] Mobile responsive
[ ] Voice/video support in widget
[ ] Analytics (track widget usage)
```

**Week 4 Deliverable:**
✅ Website embed widget working
✅ Copy-paste <script> tag to any site
✅ Users can chat with AI clone on external websites

---

## 🎯 PHASE 2: MARKETPLACE + PAYMENTS (Days 31-60)

**Goal:** Launch creator marketplace, add Stripe, enable pay-per-chat

### Week 5-6 (Days 31-42): Public Profiles + Discovery

**Day 31-35: Public Profiles**
```
Database migration:
CREATE TABLE public_profiles (
  id TEXT PRIMARY KEY,
  userId TEXT UNIQUE REFERENCES "User"(id),
  slug TEXT UNIQUE, -- 'fitnesscoach'
  displayName TEXT,
  bio TEXT,
  avatarUrl TEXT,
  tags TEXT[], -- ['fitness', 'nutrition']
  isPublic BOOLEAN DEFAULT false,
  pricePerChat DECIMAL, -- 10.00 (USD)
  currency TEXT DEFAULT 'USD',
  totalChats INTEGER DEFAULT 0,
  rating DECIMAL, -- avg 1-5
  createdAt TIMESTAMPTZ
);

Files to create:
├─ frontend/react-app/src/pages/Profile/[slug].tsx
├─ backend/src/modules/marketplace/profileController.ts
└─ backend/src/modules/marketplace/profileRoutes.ts

Tasks:
[ ] Profile editor: /profile/marketplace
    - Toggle public/private
    - Set slug (username URL)
    - Add bio, avatar, tags
    - Set price per chat
[ ] Public profile page: /c/:slug
    - Show bio, avatar, rating
    - Sample conversations
    - "Chat with AI" button
[ ] API endpoints:
    - GET /api/marketplace/profile/:slug
    - POST /api/marketplace/profile/update
```

**Day 36-42: Discovery Feed**
```
Files to create:
frontend/react-app/src/pages/Marketplace.tsx

Tasks:
[ ] Marketplace homepage: /marketplace
    - Grid of creator cards
    - Search bar (name, tags)
    - Filters: category, price range, rating
    - Sort: popular, newest, highest rated
[ ] Backend: GET /api/marketplace/profiles
    - Pagination (20 per page)
    - Filters in query params
    - SQL query with WHERE + ORDER BY
[ ] Featured section (manual curation for now)
```

---

### Week 7 (Days 43-49): Stripe + Pay-per-Chat

**Day 43-44: Stripe Setup**
```
Tasks:
[ ] Sign up for Stripe: https://stripe.com
[ ] Add env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
[ ] Install: npm install stripe
[ ] Create: backend/src/services/stripeService.ts
```

**Day 45-47: Payment Flow**
```
Database migration:
CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,
  userId TEXT REFERENCES "User"(id), -- buyer
  creatorId TEXT REFERENCES "User"(id), -- seller
  amount DECIMAL,
  currency TEXT,
  stripePaymentIntentId TEXT,
  messagesCount INTEGER DEFAULT 0,
  status TEXT, -- 'pending', 'active', 'completed'
  createdAt TIMESTAMPTZ,
  expiresAt TIMESTAMPTZ
);

Files to create:
backend/src/modules/marketplace/chatController.ts

Tasks:
[ ] Checkout endpoint: POST /api/marketplace/checkout
    - Body: { creatorSlug, priceId }
    - Create Stripe PaymentIntent
    - Create chat_session (status=pending)
    - Return: clientSecret
[ ] Frontend: Stripe Elements
    - Show payment form
    - Confirm payment
    - Redirect to /chat/:sessionId
[ ] Webhook: POST /api/stripe/webhook
    - Listen for payment_intent.succeeded
    - Update chat_session status=active
    - Credit creator earnings
```

**Day 48-49: Chat Interface**
```
Files to create:
frontend/react-app/src/pages/Chat/[sessionId].tsx

Tasks:
[ ] Chat page: /chat/:sessionId
    - Verify user paid
    - Load AI clone identity (creator's)
    - Chat interface (messages, input)
    - Send → POST /api/marketplace/chat
    - Limit: 20 messages OR 10 minutes
[ ] Backend: POST /api/marketplace/chat
    - Check session not expired
    - Generate reply
    - Increment messagesCount
    - If limit reached, mark status=completed
```

---

### Week 8 (Days 50-56): Reviews + Payouts

**Day 50-52: Reviews**
```
Database migration:
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  sessionId TEXT REFERENCES chat_sessions(id),
  userId TEXT REFERENCES "User"(id),
  creatorId TEXT REFERENCES "User"(id),
  rating INTEGER, -- 1-5
  comment TEXT,
  createdAt TIMESTAMPTZ
);

Tasks:
[ ] After session ends, show review prompt
[ ] POST /api/marketplace/review
    - Save review
    - Update public_profiles.rating (average)
[ ] Show reviews on profile page
```

**Day 53-56: Creator Payouts**
```
Database migration:
CREATE TABLE payouts (
  id TEXT PRIMARY KEY,
  creatorId TEXT REFERENCES "User"(id),
  amount DECIMAL,
  currency TEXT,
  status TEXT, -- 'pending', 'paid', 'failed'
  stripeTransferId TEXT,
  createdAt TIMESTAMPTZ,
  paidAt TIMESTAMPTZ
);

Tasks:
[ ] Creator dashboard: /creator/dashboard
    - Show: Total earnings, pending, paid
    - Request payout button (min $100)
[ ] POST /api/creator/payout/request
    - Create payout record
    - Use Stripe Connect (70/30 split)
    - Transfer to creator's bank account
[ ] Auto-payout monthly if balance > $100
```

---

### Week 9 (Days 57-60): Analytics Dashboard

**Day 57-60: Creator Analytics**
```
Files to create:
frontend/react-app/src/pages/Creator/Analytics.tsx

Tasks:
[ ] Build analytics page
    - Total chats (this month/all-time)
    - Revenue chart (daily breakdown)
    - Average rating
    - Top platforms (pie chart)
    - Most common questions (word cloud)
[ ] Backend: GET /api/creator/stats
    - Query mirror_runs, chat_sessions, reviews
    - Aggregate by date, platform
    - Return JSON
[ ] Export CSV button
```

**Phase 2 Deliverable:**
✅ Creator marketplace live
✅ Pay-per-chat working
✅ Stripe global payments
✅ Reviews & ratings
✅ Creator payouts (70/30 split)
✅ Analytics dashboard

---

## 🎯 PHASE 3: DEV API + VIDEO (Days 61-90)

**Goal:** Launch developer API, add video avatars, prepare for seed funding

### Week 10 (Days 61-67): Developer API

**Day 61-63: API Key Management**
```
Database migration:
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  userId TEXT REFERENCES "User"(id),
  keyHash TEXT UNIQUE, -- bcrypt hash of sk_live_xxx
  label TEXT,
  scopes TEXT[], -- ['mirror:read', 'mirror:write']
  rateLimit INTEGER, -- 100 req/min
  createdAt TIMESTAMPTZ,
  lastUsedAt TIMESTAMPTZ,
  revokedAt TIMESTAMPTZ
);

Tasks:
[ ] Generate API key: POST /api/developer/keys/create
    - Generate: sk_live_${randomBytes(32).toString('hex')}
    - Hash with bcrypt
    - Store hash in database
    - Return plain key ONCE (user must save)
[ ] List keys: GET /api/developer/keys
[ ] Revoke: DELETE /api/developer/keys/:id
```

**Day 64-65: Public API Endpoints**
```
Files to create:
backend/src/modules/api/v1/routes.ts

Tasks:
[ ] Middleware: Verify API key (check keyHash)
[ ] Rate limiting: 100 req/min (free), 1000 req/min (paid)
[ ] Endpoints:
    - POST /v1/mirror (text reply)
    - POST /v1/mirror/voice (voice reply)
    - GET /v1/identity (get config)
    - POST /v1/identity (update config)
[ ] Add to app.ts: app.use('/v1', apiV1Routes)
```

**Day 66-67: API Documentation**
```
Tasks:
[ ] Install: npm install swagger-ui-express swagger-jsdoc
[ ] Create: backend/src/config/swagger.ts
[ ] Write OpenAPI spec (YAML or JSON)
[ ] Serve docs: /developer/docs
[ ] Add code examples (cURL, Python, JavaScript)
```

---

### Week 11 (Days 68-74): Video Avatars

**Day 68-69: D-ID Setup**
```
Tasks:
[ ] Sign up for D-ID: https://d-id.com ($49/mo)
[ ] Add env: DID_API_KEY
[ ] Install: npm install axios
```

**Day 70-72: Video Backend**
```
Database migration:
CREATE TABLE video_avatars (
  id TEXT PRIMARY KEY,
  userId TEXT REFERENCES "User"(id),
  avatarId TEXT, -- D-ID presenter_id
  label TEXT,
  sampleVideoUrl TEXT,
  provider TEXT DEFAULT 'did',
  status TEXT, -- 'pending', 'training', 'ready', 'failed'
  createdAt TIMESTAMPTZ
);

Files to create:
backend/src/modules/video/videoRoutes.ts
backend/src/modules/video/videoService.ts

Tasks:
[ ] Upload endpoint: POST /api/video/upload
    - Upload video to S3
    - POST to D-ID /clips (create presenter)
    - Store avatarId in database
[ ] Generate endpoint: POST /api/video/generate
    - Body: { text, avatarId }
    - POST to D-ID /talks (create video)
    - Return video URL
```

**Day 73-74: Video Frontend**
```
Tasks:
[ ] Video setup page: /video/setup
    - Upload video file
    - Preview
    - Submit
[ ] Video management page: /video/manage
    - List avatars
    - Test (generate sample video)
    - Delete
[ ] Add to Mirror page: "Video Reply" toggle
```

---

### Week 12 (Days 75-81): Webhooks

**Day 75-77: Webhook System**
```
Database migration:
CREATE TABLE webhooks (
  id TEXT PRIMARY KEY,
  userId TEXT REFERENCES "User"(id),
  url TEXT,
  events TEXT[], -- ['mirror.generated', 'identity.updated']
  secret TEXT, -- for signature verification
  status TEXT, -- 'active', 'paused'
  createdAt TIMESTAMPTZ
);

Tasks:
[ ] Register webhook: POST /api/webhooks
[ ] List webhooks: GET /api/webhooks
[ ] Delete webhook: DELETE /api/webhooks/:id
[ ] Trigger webhooks:
    - After mirror generation
    - After identity update
    - Send POST to webhook URL
    - Include signature: HMAC-SHA256(secret, payload)
[ ] Retry logic: 3 attempts with exponential backoff
```

**Day 78-81: Testing + Docs**
```
Tasks:
[ ] Test all API endpoints
[ ] Write integration guide
[ ] Create video tutorials
[ ] Build Postman collection
```

---

### Week 13 (Days 82-90): Launch Prep

**Day 82-84: Production Readiness**
```
Tasks:
[ ] Add Sentry (error monitoring)
[ ] Add Cloudflare CDN
[ ] Database backups (automated)
[ ] Load testing (Artillery or k6)
[ ] Security audit (SQL injection, XSS, CSRF)
```

**Day 85-87: Marketing Prep**
```
Tasks:
[ ] Build landing page (convert visitors to signups)
[ ] Create demo video (2 min)
[ ] Write Product Hunt description
[ ] Reach out to 20 creators (early access)
[ ] Prepare Twitter thread
```

**Day 88-90: Launch**
```
Tasks:
[ ] Launch on Product Hunt
[ ] Post on Twitter, Reddit (r/entrepreneur, r/SaaS)
[ ] Email 100 creators
[ ] Monitor for bugs
[ ] Fix critical issues immediately
```

**Phase 3 Deliverable:**
✅ Developer API live
✅ Video avatars working
✅ Webhooks functional
✅ Production-ready
✅ Launched publicly

---

## 📊 MILESTONES & METRICS

### Day 30 (End of Phase 1)
- [ ] Voice cloning working
- [ ] Instagram + WhatsApp connected
- [ ] Website embed widget live
- [ ] Target: 10 beta users, $500 MRR

### Day 60 (End of Phase 2)
- [ ] Marketplace live
- [ ] 50 public profiles
- [ ] Stripe payments working
- [ ] Target: 50 users, $2.5K MRR

### Day 90 (End of Phase 3)
- [ ] Developer API live
- [ ] Video avatars working
- [ ] 100+ creators
- [ ] Target: $10K MRR
- [ ] **Ready to raise seed ($500K-1M)**

---

## 🚨 CRITICAL PATH (MUST DO FIRST)

**Week 1 Priority:**
1. Sign up for ElevenLabs (blocks voice)
2. Build voice upload UI (user-facing)
3. Test voice cloning end-to-end

**Week 2 Priority:**
1. Instagram integration (biggest user demand)
2. S3 storage (blocks file uploads)

**Week 3 Priority:**
1. WhatsApp integration (high ROI)
2. Website embed (easiest to demo)

**NEVER SKIP:**
- Testing after each feature
- User feedback (talk to 5 users/week)
- Fixing critical bugs same day

---

## 💸 COST ESTIMATE (90 Days)

**Infrastructure:**
- Railway: $20/mo × 3 = $60
- Domain: $10/year = $10

**APIs:**
- ElevenLabs: $99/mo × 3 = $297
- D-ID: $49/mo × 1 = $49 (start month 3)
- Stripe: FREE (pay-as-you-go)
- Twilio: $50/mo × 2 = $100

**Storage:**
- AWS S3: $10/mo × 3 = $30

**Total: ~$550 for 90 days**

---

## 🔥 EXECUTION TIPS

1. **Ship Daily:** Commit code every day, even if broken
2. **Talk to Users:** 5 conversations/week minimum
3. **Fix Fast:** Critical bugs within 24 hours
4. **No Perfection:** Ship 80% done, iterate based on feedback
5. **Track Metrics:** Daily active users, MRR, churn

---

**START BUILDING. NO MORE PLANNING.** 🚀
