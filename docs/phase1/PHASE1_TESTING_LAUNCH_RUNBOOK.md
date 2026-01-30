# Phase 1 — Complete Testing + Launch Runbook (Production Ready)

> **Single Source of Truth** for Phase-1 end-to-end testing and production launch.  
> Follow this document step-by-step to test and launch Phase-1 safely.

---

## 📋 Table of Contents

1. [Pre-Launch Setup](#1-pre-launch-setup)
2. [Local Testing (Complete Flow)](#2-local-testing-complete-flow)
3. [Production Deployment](#3-production-deployment)
4. [Post-Deployment Verification](#4-post-deployment-verification)
5. [Rollback Plan](#5-rollback-plan)
6. [Monitoring & Support](#6-monitoring--support)

---

## 1) Pre-Launch Setup

### 1.1 Environment Variables (Backend)

**Step 1:** Copy env template
```bash
cd backend
cp env.example .env
```

**Step 2:** Set minimum required variables in `backend/.env`:

```env
# Environment
NODE_ENV=development  # Change to 'production' for prod
APP_ENV=local         # Change to 'prod' for prod
PORT=3000

# Database (REQUIRED)
DATABASE_URL=postgresql://user:password@localhost:5432/ai_identity

# Security Secrets (REQUIRED - generate strong random strings)
SESSION_SECRET=<generate-random-32-char-string>
JWT_SECRET=<generate-random-32-char-string>
JWT_REFRESH_SECRET=<generate-random-32-char-string>
ID_TOKEN_SECRET=<generate-random-32-char-string>
IP_HASH_SECRET=<generate-random-32-char-string>

# Frontend URLs (REQUIRED)
FRONTEND_URL=http://localhost:5173  # Change to https://yourdomain.com for prod
APP_URL=http://localhost:5173       # Change to https://yourdomain.com for prod

# Admin Access
ADMIN_EMAILS=admin@yourdomain.com

# LLM APIs (REQUIRED)
OPENAI_API_KEY=sk-your-key
GROQ_API_KEY=your-groq-key
GROQ_API_KEY_ANONYMOUS=your-groq-key-anonymous

# Phase 1 Feature Flags (IMPORTANT - set these for Phase 1 launch)
ENABLE_WIDGET=true
ENABLE_PAY_PER_CHAT=true
ENABLE_PAYMENTS=true
ENABLE_AI_GENERATION=true
ENABLE_EMAIL_NOTIFICATIONS=true

# Phase 2/3 Flags (KEEP OFF for Phase 1 launch)
ENABLE_MARKETPLACE=false
ENABLE_VOICE=false
ENABLE_VIDEO=false
ENABLE_PHONE=false
ENABLE_WHATSAPP=false
ENABLE_INSTAGRAM=false

# Stripe (REQUIRED if ENABLE_PAY_PER_CHAT=true)
STRIPE_SECRET_KEY=sk_test_xxx  # Use sk_live_xxx in production
STRIPE_WEBHOOK_SECRET=whsec_xxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx  # In frontend/.env

# Storage (S3/R2 for file uploads)
S3_BUCKET=your-bucket
S3_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_PUBLIC_BASE_URL=https://your-public-domain

# Email (Optional but recommended)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
MAIL_FROM=noreply@yourdomain.com

# CORS for Widget (optional - leave empty to allow all origins)
CORS_ALLOWED_ORIGINS=
CORS_ALLOW_CREDENTIALS=false

# Error Monitoring (Optional but recommended)
SENTRY_DSN=your-sentry-dsn
```

**Step 3:** Generate secure secrets (run these commands):
```bash
# Generate random secrets (use any one method)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# OR
openssl rand -hex 32
```

### 1.2 Environment Variables (Frontend)

**Step 1:** Copy env template
```bash
cd frontend/react-app
cp env.example .env
```

**Step 2:** Set in `frontend/react-app/.env`:
```env
# Backend API URL (leave empty if same origin)
VITE_API_BASE_URL=

# Stripe Publishable Key (REQUIRED for payments)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx  # Use pk_live_xxx in production

# Error Monitoring (Optional)
VITE_SENTRY_DSN=your-sentry-dsn
```

### 1.3 Database Setup

**Step 1:** Ensure PostgreSQL is running
```bash
# Check if PostgreSQL is running
psql --version
# OR on Windows
pg_isready
```

**Step 2:** Create database (if not exists)
```bash
psql -U postgres -c "CREATE DATABASE ai_identity;"
```

**Step 3:** Database tables auto-create on server start (via `backend/src/config/database.ts`)

**If DB connection timeout issues:**
- Reference: `docs/phase1/DATABASE_TIMEOUT_FIX.md`
- Check: `DATABASE_URL` format, firewall rules, connection pool settings

### 1.4 Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend/react-app
npm install
```

---

## 2) Local Testing (Complete Flow)

### 2.1 Start Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
✅ **Check:** Server starts on `http://localhost:3000`, no errors in console

**Terminal 2 - Frontend:**
```bash
cd frontend/react-app
npm run dev
```
✅ **Check:** Frontend starts on `http://localhost:5173`, no build errors

**Terminal 3 - Stripe Webhook (if testing payments):**
```bash
stripe listen --forward-to localhost:3000/api/billing/stripe/webhook
```
✅ **Check:** Copy the `whsec_...` value and add to `backend/.env` as `STRIPE_WEBHOOK_SECRET`

### 2.2 Automated Tests

**Step 1: Backend Unit Tests**
```bash
cd backend
npm test
```
✅ **Expected:** All tests pass (or at least critical auth/payment tests pass)

**Step 2: Backend Integration Tests**
```bash
# Ensure backend is running first
cd backend
npm test -- tests/integration
```
✅ **Expected:** Integration tests pass (hits real HTTP endpoints)

**Step 3: Smoke Tests (API Health Check)**
```bash
cd backend
npx tsx src/scripts/smokeTests.ts
```
✅ **Expected:** All API endpoints return 200/expected status codes

---

### 2.3 Manual E2E Testing (Phase-1 Full Flow)

> **Best Practice:** Maintain a test log (Google Sheet/Notion) with: Date, Build/Commit, Test Case, Pass/Fail, Notes

#### **A) Auth & Session Flow**

**A1. Email Signup**
- [ ] Go to `/signup`
- [ ] Enter email → click "Send OTP"
- [ ] Check email inbox → copy OTP
- [ ] Enter OTP → verify
- [ ] ✅ **Expected:** Redirected to dashboard, session cookie set

**A2. Login**
- [ ] Go to `/login`
- [ ] Enter correct email + password → login
- [ ] ✅ **Expected:** Redirected to dashboard
- [ ] Logout → try wrong password
- [ ] ✅ **Expected:** Error message, rate limit warning if too many attempts

**A3. Remember Me**
- [ ] Login with "Remember me" checked
- [ ] Close browser → reopen → go to dashboard
- [ ] ✅ **Expected:** Still logged in (longer session duration)

**A4. Google OAuth** (if `GOOGLE_CLIENT_ID` is set)
- [ ] Click "Sign in with Google"
- [ ] Complete OAuth flow
- [ ] ✅ **Expected:** Redirected to dashboard, account created/linked

**A5. Account Linking**
- [ ] Signup with email → verify
- [ ] Logout → login with Google (same email)
- [ ] ✅ **Expected:** Accounts linked, can access same dashboard
- [ ] OR: Google signup → later set email/password
- [ ] ✅ **Expected:** Accounts linked

**A6. Session Refresh** (if enabled)
- [ ] Stay logged in for extended period
- [ ] ✅ **Expected:** No random logout, token auto-refreshes

**A7. Logout**
- [ ] Click logout
- [ ] Try accessing `/dashboard`
- [ ] ✅ **Expected:** Redirected to login, cookies cleared

---

#### **B) Creator Onboarding Flow**

**B1. Quiz (10 Questions)**
- [ ] After signup/login, start onboarding
- [ ] Answer quiz questions (can skip/back)
- [ ] ✅ **Expected:** Autosave works, can navigate back/forward
- [ ] Complete quiz
- [ ] ✅ **Expected:** Confetti/celebration (if implemented), proceed to content upload

**B2. Content Upload**
- [ ] Upload 3+ files (PDF/DOCX/TXT/CSV)
- [ ] ✅ **Expected:** Files upload, progress indicator works
- [ ] Try paste text flow
- [ ] ✅ **Expected:** Text saved as content item
- [ ] Try URL import (YouTube) - if `YOUTUBE_API_KEY` is set
- [ ] ✅ **Expected:** URL processed, content extracted
- [ ] Check backend logs
- [ ] ✅ **Expected:** No crashes, chunks stored, embeddings generation starts

**B3. Training Status**
- [ ] After upload, go to training status page
- [ ] ✅ **Expected:** Status page loads, shows "Processing" or "Training"
- [ ] Wait for processing (polling should auto-refresh)
- [ ] ✅ **Expected:** Status updates, eventually shows "AI Ready"
- [ ] Check email (if `ENABLE_EMAIL_NOTIFICATIONS=true`)
- [ ] ✅ **Expected:** "AI Ready" email sent once (not duplicate)

**B4. Deploy**
- [ ] After "AI Ready", proceed to deploy
- [ ] ✅ **Expected:** Standalone link generated: `/chat/:slug`
- [ ] ✅ **Expected:** Embed snippet generated (copy button works)
- [ ] Copy embed snippet → test on external HTML page
- [ ] ✅ **Expected:** Widget loads and works

---

#### **C) Public Chat (End User) Flow**

**C1. Page Load**
- [ ] Open `/chat/:slug` (from your deployed identity)
- [ ] ✅ **Expected:** Creator profile loads (avatar, name, welcome message, popular Qs)

**C2. Send Message**
- [ ] Type a message → send
- [ ] ✅ **Expected:** Typing indicator shows, response renders, markdown formatting works

**C3. History Persistence (30 Days)**
- [ ] Send 2-3 messages
- [ ] Refresh page (F5)
- [ ] ✅ **Expected:** Previous messages still visible (sessionId persisted)
- [ ] Check browser DevTools → Application → Cookies
- [ ] ✅ **Expected:** Session cookie exists with reasonable expiry
- [ ] Check backend: older messages (>30 days) should not load
- [ ] ✅ **Expected:** Backend enforces 30-day cutoff (see `backend/src/modules/public/publicController.ts`)

**C4. Feedback**
- [ ] Click thumbs up/down on a message
- [ ] ✅ **Expected:** Feedback stored, UI updates
- [ ] Check backend logs/DB
- [ ] ✅ **Expected:** Feedback record persisted

**C5. Plan Gate (Free Limit)**
- [ ] Send messages until free limit reached
- [ ] ✅ **Expected:** Warning header shows (if implemented)
- [ ] After limit: send another message
- [ ] ✅ **Expected:** Returns 402 or payment prompt modal

---

#### **D) Pay-Per-Chat (Critical Money Path)**

**D1. Payment Trigger**
- [ ] In public chat, reach free message limit
- [ ] ✅ **Expected:** Payment prompt modal appears (or teaser shown)

**D2. Payment Intent**
- [ ] Click "Pay to Unlock" or similar
- [ ] Open browser DevTools → Network tab
- [ ] ✅ **Expected:** `POST /api/payments/pay-per-chat/intent` returns `clientSecret`

**D3. Stripe Checkout**
- [ ] Complete Stripe payment form (use test card: `4242 4242 4242 4242`)
- [ ] ✅ **Expected:** Payment succeeds, redirects back

**D4. Payment Confirmation**
- [ ] After payment, check network tab
- [ ] ✅ **Expected:** `POST /api/payments/pay-per-chat/confirm` called
- [ ] ✅ **Expected:** Full answer unlocks, no duplicate assistant messages
- [ ] Check backend DB (payments table)
- [ ] ✅ **Expected:** Payment record created (status, amount, split)

**D5. Email Receipt**
- [ ] Check email inbox
- [ ] ✅ **Expected:** Receipt email delivered with full answer
- [ ] Open email on Gmail + Outlook mobile
- [ ] ✅ **Expected:** HTML renders correctly, answer is readable

**D6. Webhook Verification** (if Stripe CLI running)
- [ ] Check Stripe CLI terminal
- [ ] ✅ **Expected:** `payment_intent.succeeded` event received
- [ ] Check backend logs
- [ ] ✅ **Expected:** Webhook handler processed event, DB updated

---

#### **E) Widget (Cross-Origin Embed)**

**E1. External Domain Test**
- [ ] Create a simple HTML file on different origin (or use `file://` protocol)
- [ ] Add embed script:
```html
<script src="http://localhost:5173/embed.js"></script>
<link rel="stylesheet" href="http://localhost:5173/embed.css">
<script>
  window.AIIdentityWidget.init({
    slug: 'your-slug-here',
    apiUrl: 'http://localhost:3000'
  });
</script>
```
- [ ] Open HTML file in browser
- [ ] ✅ **Expected:** Widget bubble appears, can open/close, messages send, replies show

**E2. CORS Verification**
- [ ] Open browser DevTools → Network tab
- [ ] Send message from widget
- [ ] ✅ **Expected:** OPTIONS preflight passes (200 status)
- [ ] ✅ **Expected:** POST request succeeds
- [ ] If `CORS_ALLOWED_ORIGINS` is set: verify your test origin is in the list

**E3. Payment in Widget** (if supported)
- [ ] Trigger payment prompt from widget
- [ ] ✅ **Expected:** Payment modal/redirect works, unlocks answer

---

#### **F) Dashboard & Settings**

**F1. Dashboard Load**
- [ ] Go to `/dashboard`
- [ ] ✅ **Expected:** Metrics load, charts render, tabs work, polling stable (no infinite loops)

**F2. Test AI Tab**
- [ ] Go to "Test AI" tab in dashboard
- [ ] Send test messages
- [ ] ✅ **Expected:** Test chats work, don't affect plan limits (expected behavior)

**F3. Settings**
- [ ] Go to `/settings`
- [ ] Update profile (name, avatar)
- [ ] ✅ **Expected:** Profile saves, changes reflect
- [ ] Go to Pay-Per-Chat settings
- [ ] Enable pay-per-chat, set tiers/prices, trigger rules
- [ ] ✅ **Expected:** Settings save, apply in public chat
- [ ] Test security: change password, set password (OAuth-only), forgot password
- [ ] ✅ **Expected:** All security flows work

**F4. Export/Deletion** (if included)
- [ ] Try export chats/profile (CSV/ZIP)
- [ ] ✅ **Expected:** Export works, file downloads
- [ ] Try account deletion (if enabled)
- [ ] ✅ **Expected:** OTP required, grace period logic works

---

### 2.4 Stripe Webhook Testing (Local)

**Step 1: Start Stripe CLI**
```bash
stripe listen --forward-to localhost:3000/api/billing/stripe/webhook
```

**Step 2: Copy Webhook Secret**
- Copy the `whsec_...` value from terminal
- Add to `backend/.env`: `STRIPE_WEBHOOK_SECRET=whsec_...`
- Restart backend server

**Step 3: Trigger Test Events**
```bash
# In another terminal
stripe trigger payment_intent.succeeded
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
```

**Step 4: Verify**
- [ ] Check backend logs
- [ ] ✅ **Expected:** Events received, handlers executed, DB updated (if metadata present)

---

## 3) Production Deployment

### 3.1 Pre-Deployment Checklist

**Infrastructure:**
- [ ] Database provisioned (PostgreSQL managed service recommended)
- [ ] Backend hosting ready (Railway/Render/Heroku/AWS/etc.)
- [ ] Frontend hosting ready (Vercel/Netlify/Cloudflare Pages/etc.)
- [ ] SSL certificates valid (HTTPS required)
- [ ] CDN configured (if using)
- [ ] Monitoring/alerting set up (Sentry, logs, metrics)

**Security:**
- [ ] All API keys in environment variables (not in code)
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Input validation verified
- [ ] SQL injection protection verified
- [ ] XSS protection verified
- [ ] CSRF protection enabled

**Payment & Billing:**
- [ ] Stripe **LIVE** keys configured (not test keys)
- [ ] Webhook endpoints configured in Stripe dashboard
- [ ] Payment flows tested end-to-end
- [ ] Refund process documented

**Feature Flags (CRITICAL for Phase 1):**
- [ ] Set in production environment:
```env
# Phase 1 ON
ENABLE_WIDGET=true
ENABLE_PAY_PER_CHAT=true
ENABLE_PAYMENTS=true
ENABLE_AI_GENERATION=true
ENABLE_EMAIL_NOTIFICATIONS=true

# Phase 2/3 OFF (keep disabled)
ENABLE_MARKETPLACE=false
ENABLE_VOICE=false
ENABLE_VIDEO=false
ENABLE_PHONE=false
ENABLE_WHATSAPP=false
ENABLE_INSTAGRAM=false
```

### 3.2 Production Environment Variables

**Backend Production `.env`:**
```env
NODE_ENV=production
APP_ENV=prod
PORT=3000

# Database (production URL)
DATABASE_URL=postgresql://user:pass@prod-db-host:5432/ai_identity

# Security (use strong random secrets - different from dev)
SESSION_SECRET=<prod-secret-32-chars>
JWT_SECRET=<prod-secret-32-chars>
JWT_REFRESH_SECRET=<prod-secret-32-chars>
ID_TOKEN_SECRET=<prod-secret-32-chars>
IP_HASH_SECRET=<prod-secret-32-chars>

# Frontend URLs (production)
FRONTEND_URL=https://yourdomain.com
APP_URL=https://yourdomain.com

# Stripe LIVE keys
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx  # From Stripe dashboard
STRIPE_PRICE_STARTER=price_xxx    # From Stripe dashboard
STRIPE_PRICE_GROWTH=price_xxx
STRIPE_PRICE_SCALE=price_xxx

# Feature Flags (Phase 1 only)
ENABLE_WIDGET=true
ENABLE_PAY_PER_CHAT=true
ENABLE_PAYMENTS=true
ENABLE_MARKETPLACE=false
ENABLE_VOICE=false
ENABLE_VIDEO=false
ENABLE_PHONE=false
ENABLE_WHATSAPP=false
ENABLE_INSTAGRAM=false

# Storage (S3/R2 production)
S3_BUCKET=prod-bucket
S3_REGION=ap-south-1
AWS_ACCESS_KEY_ID=prod-key
AWS_SECRET_ACCESS_KEY=prod-secret
S3_PUBLIC_BASE_URL=https://cdn.yourdomain.com

# Email (production SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=app-password
MAIL_FROM=noreply@yourdomain.com

# CORS (restrict if needed)
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://widget.yourdomain.com
CORS_ALLOW_CREDENTIALS=false

# Error Monitoring
SENTRY_DSN=your-prod-sentry-dsn
```

**Frontend Production `.env`:**
```env
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
VITE_SENTRY_DSN=your-prod-sentry-dsn
```

### 3.3 Deployment Steps

**Step 1: Deploy Backend**
```bash
# Example for Railway/Render (adjust for your platform)
cd backend
# Push to git, platform auto-deploys
# OR manual:
npm install
npm run build  # If you have build step
# Set env vars in platform dashboard
# Start server: npm start (or platform auto-starts)
```

✅ **Verify:** `GET https://api.yourdomain.com/health` returns 200

**Step 2: Configure Stripe Webhook**
- Go to Stripe Dashboard → Developers → Webhooks
- Add endpoint: `https://api.yourdomain.com/api/billing/stripe/webhook`
- Select events:
  - `payment_intent.succeeded`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
  - `invoice.payment_succeeded`
- Copy webhook signing secret → add to `STRIPE_WEBHOOK_SECRET` in backend env
- Restart backend

**Step 3: Deploy Frontend**
```bash
cd frontend/react-app
# Set VITE_* env vars in build platform
npm install
npm run build
# Deploy dist/ folder to hosting (Vercel/Netlify/etc.)
```

✅ **Verify:** Frontend loads at `https://yourdomain.com`

**Step 4: Feature Flags Verification**
- Check backend logs on startup
- ✅ **Expected:** Only Phase-1 routes mounted (widget, pay-per-chat)
- ✅ **Expected:** Phase-2/3 routes NOT mounted (marketplace, voice, etc.)

---

## 4) Post-Deployment Verification

### 4.1 Launch Day "Golden Path" Re-Test (15 minutes)

**Test 1: Signup → OTP → Dashboard**
- [ ] Go to `https://yourdomain.com/signup`
- [ ] Signup with real email → verify OTP
- [ ] ✅ **Expected:** Redirected to dashboard, session works

**Test 2: Onboarding → Deploy → Public Chat**
- [ ] Complete quiz → upload 3+ content items
- [ ] Wait for "AI Ready" (or manually trigger if testing)
- [ ] Deploy → get `/chat/:slug` link
- [ ] Open link in incognito window
- [ ] ✅ **Expected:** Public chat loads, can send messages

**Test 3: Payment Flow**
- [ ] In public chat, trigger payment prompt
- [ ] Complete payment with test card (or real card for small amount)
- [ ] ✅ **Expected:** Payment succeeds, answer unlocks, receipt email sent

**Test 4: Widget on External Page**
- [ ] Create test HTML page on different domain
- [ ] Embed widget script
- [ ] ✅ **Expected:** Widget loads, messages work, CORS passes

### 4.2 Monitoring Checklist

**First 24 Hours:**
- [ ] Monitor error rates (Sentry/error logs)
- [ ] Monitor performance metrics (p50, p95, p99 latency)
- [ ] Check user signups
- [ ] Verify payment processing (Stripe dashboard)
- [ ] Monitor server resources (CPU, memory, disk)
- [ ] Check database connection pool usage
- [ ] Review support requests/feedback

**First Week:**
- [ ] Daily error log review
- [ ] Performance trend analysis
- [ ] User feedback review
- [ ] Payment success/failure rates
- [ ] Feature usage analytics

---

## 5) Rollback Plan

### 5.1 When to Rollback

Rollback immediately if:
- Critical security vulnerability discovered
- Payment processing fails (Stripe webhooks not working, payments not recording)
- Database corruption or data loss
- System-wide outage (API down, frontend not loading)
- LLM API failures causing 100% chat failures
- Authentication system broken (users can't login)
- Critical feature broken (onboarding, AI training, deployment)

**Rollback within 1 hour if:**
- Error rate > 10% of requests
- Payment success rate drops below 80%
- Response time p95 > 5 seconds
- Database connection pool exhausted
- Memory leaks causing server crashes

**Monitor but don't rollback:**
- Minor UI bugs (cosmetic only)
- Non-critical feature issues
- Performance degradation < 20%
- Single user reports (not widespread)

### 5.2 Rollback Procedures

#### **5.2.1 Backend Rollback**

**Option A: Git-based Rollback (Recommended)**
```bash
# 1. Identify last known good commit
git log --oneline
# Find commit hash before problematic deployment

# 2. Rollback to previous version
cd backend
git checkout <last-good-commit-hash>

# 3. Redeploy (platform-specific)
# Railway/Render: Push to trigger redeploy
git push origin main --force  # Only if necessary

# OR manual redeploy:
npm install
npm run build  # If applicable
# Restart service via platform dashboard
```

**Option B: Environment Variable Rollback**
```bash
# If issue is feature flag related:
# 1. Access hosting platform dashboard
# 2. Update environment variables:
ENABLE_PAY_PER_CHAT=false  # Disable problematic feature
ENABLE_WIDGET=false        # Disable if widget causing issues

# 3. Restart service
```

**Option C: Database Migration Rollback**
```bash
# If database migration caused issues:
# 1. Connect to production database
psql $DATABASE_URL

# 2. Check migration history
SELECT * FROM migrations ORDER BY created_at DESC LIMIT 5;

# 3. Rollback last migration (if migration system supports it)
# OR manually revert schema changes
# Example:
ALTER TABLE users DROP COLUMN IF EXISTS problematic_column;
```

#### **5.2.2 Frontend Rollback**

**Option A: Git-based Rollback**
```bash
cd frontend/react-app
git checkout <last-good-commit-hash>
npm install
npm run build
# Redeploy to Vercel/Netlify/etc.
```

**Option B: Platform-specific Rollback**
- **Vercel:** Dashboard → Deployments → Select previous deployment → "Promote to Production"
- **Netlify:** Dashboard → Deploys → Select previous deploy → "Publish deploy"
- **Cloudflare Pages:** Dashboard → Deployments → Rollback

#### **5.2.3 Database Rollback**

**⚠️ CRITICAL: Only rollback database if absolutely necessary (data loss risk)**

```bash
# 1. Create backup before rollback
pg_dump $DATABASE_URL > backup_before_rollback_$(date +%Y%m%d_%H%M%S).sql

# 2. If using managed database (Supabase/RDS):
# - Use point-in-time recovery (if available)
# - OR restore from automated backup

# 3. If manual rollback needed:
# - Restore from backup
# - OR manually revert schema changes
```

### 5.3 Rollback Communication

**Immediate Actions:**
1. [ ] Post status update on status page (if available)
2. [ ] Notify team via Slack/email
3. [ ] Update users if widespread issue (email/twitter)

**Post-Rollback:**
1. [ ] Document what went wrong
2. [ ] Create incident report
3. [ ] Schedule post-mortem meeting
4. [ ] Update runbook with lessons learned

### 5.4 Rollback Verification

After rollback, verify:
- [ ] Health check endpoint returns 200
- [ ] Signup/login works
- [ ] Public chat loads and responds
- [ ] Payment flow works (test with small amount)
- [ ] Dashboard loads
- [ ] No new errors in logs
- [ ] Database queries succeed

**Time to verify:** 5-10 minutes

---

## 6) Monitoring & Support

### 6.1 Monitoring Setup

#### **6.1.1 Application Monitoring**

**Sentry (Error Tracking)**
- [ ] Backend Sentry DSN configured
- [ ] Frontend Sentry DSN configured
- [ ] Alerts set up for:
  - Error rate > 5% in 5 minutes
  - Critical errors (payment 