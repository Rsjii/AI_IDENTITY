# 🎯 Identity Mirror - Complete System Flow

**Version:** Production Ready  
**Date:** 2026-01-26  
**Status:** ✅ All Systems Operational

---

## 📐 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Web App    │  │ Chrome Ext   │  │  Mobile Web  │         │
│  │  (React SPA) │  │  (Gmail)     │  │  (Future)    │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
└─────────┼──────────────────┼──────────────────┼────────────────┘
          │                  │                  │
          │ HTTPS/REST API  │ Bearer Token     │
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼────────────────┐
│                    BACKEND API LAYER                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Express.js Server (Node.js + TypeScript)                │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐        │  │
│  │  │  Auth      │  │  Identity  │  │  Mirror    │        │  │
│  │  │  Module    │  │  Module   │  │  Engine    │        │  │
│  │  └────────────┘  └────────────┘  └────────────┘        │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐        │  │
│  │  │  Payment   │  │  Extension │  │  Admin     │        │  │
│  │  │  Module    │  │  Module    │  │  Module    │        │  │
│  │  └────────────┘  └────────────┘  └────────────┘        │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Middleware Stack:                                       │  │
│  │  • Rate Limiting (PostgreSQL-backed)                    │  │
│  │  • JWT Authentication                                    │  │
│  │  • CSRF Protection                                        │  │
│  │  • Error Handling                                        │  │
│  │  • Security Headers (Helmet)                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────┬──────────────────┬──────────────────┬───────────────┘
          │                  │                  │
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼────────────────┐
│                    DATA & EXTERNAL LAYER                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  PostgreSQL  │  │  Groq API    │  │  Razorpay    │         │
│  │  Database    │  │  (LLM)       │  │  (Payments)  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐                           │
│  │  Resend      │  │  PostHog     │                           │
│  │  (Email)     │  │  (Analytics) │                           │
│  └──────────────┘  └──────────────┘                           │
└────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Complete User Journey Flow

### 1. **Signup & Authentication**

```
┌──────────┐
│   User   │
└────┬─────┘
     │
     │ 1. Visit /auth
     ▼
┌─────────────────┐
│  AuthPage.tsx   │
│  (Frontend)     │
└────┬────────────┘
     │
     │ 2. Enter Email
     │    POST /api/auth/signup
     ▼
┌─────────────────┐
│ authController  │
│ .signup()       │
└────┬────────────┘
     │
     │ 3. Generate OTP
     │    Store in DB
     │    Send Email (Resend)
     ▼
┌─────────────────┐
│  User enters    │
│  OTP code       │
└────┬────────────┘
     │
     │ 4. POST /api/auth/verify-otp
     ▼
┌─────────────────┐
│ authController  │
│ .verifyOtp()    │
└────┬────────────┘
     │
     │ 5. Create User
     │    Generate JWT
     │    Set Cookie
     ▼
┌─────────────────┐
│  Redirect to    │
│  /identity/setup│
└─────────────────┘
```

### 2. **Identity Creation Flow**

```
┌──────────┐
│   User   │
└────┬─────┘
     │
     │ 1. Visit /identity/setup
     ▼
┌─────────────────┐
│ IdentitySetup   │
│ Page.tsx         │
└────┬────────────┘
     │
     │ 2. Fill Form:
     │    - Communication Rules
     │    - Style Preferences
     │    - Boundaries
     │    - Auto-reply Settings
     │    - Max Lines
     ▼
┌─────────────────┐
│ POST /api/      │
│ identity/create │
└────┬────────────┘
     │
     │ 3. identityController.create()
     ▼
┌─────────────────┐
│ identityService │
│ .createIdentity()│
└────┬────────────┘
     │
     │ 4. Create Identity Record
     │    Create Identity Version
     │    Set as Active
     ▼
┌─────────────────┐
│  Show Tutorial  │
│  Overlay        │
└────┬────────────┘
     │
     │ 5. Redirect to /mirror
     ▼
┌─────────────────┐
│  Ready to Use!  │
└─────────────────┘
```

### 3. **Mirror (Reply Generation) Flow**

```
┌──────────┐
│   User   │
└────┬─────┘
     │
     │ 1. Visit /mirror
     │    Enter incoming message
     ▼
┌─────────────────┐
│  MirrorPage.tsx │
│  (Frontend)     │
└────┬────────────┘
     │
     │ 2. POST /api/identity/mirror
     │    { context, incomingMessage }
     ▼
┌─────────────────┐
│ identityController│
│ .mirror()        │
└────┬────────────┘
     │
     │ 3. Get Active Identity
     │    Load Identity JSON
     ▼
┌─────────────────┐
│ identityService │
│ .computeDecision()│
│ (Decision Gate) │
└────┬────────────┘
     │
     │ 4. Pre-LLM Checks:
     │    • Auto-reply enabled?
     │    • Ignore rules match?
     │    • Defer rules match?
     │    • Escalation detected?
     │    • Message length OK?
     ▼
     ├─→ DECISION: IGNORE → Return { action: 'ignore' }
     ├─→ DECISION: DEFER → Return { action: 'defer' }
     └─→ DECISION: REPLY → Continue
          │
          │ 5. Check maxLines (pre-LLM)
          │    If exceeds → Return error
          │
          │ 6. Call LLM (Groq/OpenAI)
          │    Generate reply
          ▼
┌─────────────────┐
│ identityService │
│ .validateMirror │
│ Output()        │
│ (Output Validator)│
└────┬────────────┘
     │
     │ 7. Post-LLM Validation:
     │    • Check maxLines
     │    • Validate style
     │    • Retry if needed (max 2)
     ▼
┌─────────────────┐
│  Save to DB:    │
│  • mirror_runs  │
│  • Log metadata │
└────┬────────────┘
     │
     │ 8. Return Response:
     │    { decision, reply, reason }
     ▼
┌─────────────────┐
│  Frontend Shows:│
│  • Decision Preview│
│  • Suggested Reply│
│  • Trust Buttons │
└─────────────────┘
```

### 4. **Payment Flow (When Enabled)**

```
┌──────────┐
│   User   │
└────┬─────┘
     │
     │ 1. Visit /pricing
     │    Click "Upgrade to Pro"
     ▼
┌─────────────────┐
│  PricingPage.tsx│
└────┬────────────┘
     │
     │ 2. POST /api/payment/create-order
     │    { tier: 'pro' }
     ▼
┌─────────────────┐
│ paymentController│
│ .createPaymentOrder()│
└────┬────────────┘
     │
     │ 3. Check existing subscription
     │    Create Razorpay order
     │    Return order ID
     ▼
┌─────────────────┐
│  Load Razorpay  │
│  Checkout Script│
└────┬────────────┘
     │
     │ 4. Open Razorpay Modal
     │    User completes payment
     ▼
┌─────────────────┐
│  Payment Success│
│  Callback       │
└────┬────────────┘
     │
     │ 5. POST /api/payment/verify
     │    { orderId, paymentId, signature }
     ▼
┌─────────────────┐
│ paymentController│
│ .verifyPayment()│
└────┬────────────┘
     │
     │ 6. Verify signature (HMAC)
     │    Create subscription record
     │    Log event
     ▼
┌─────────────────┐
│  Subscription   │
│  Active!        │
│  Rate limits    │
│  updated        │
└─────────────────┘
```

### 5. **Extension Flow (Gmail)**

```
┌──────────┐
│   User   │
│ (Gmail)  │
└────┬─────┘
     │
     │ 1. Opens Gmail compose
     ▼
┌─────────────────┐
│ gmail-inject.js │
│ (Content Script)│
└────┬────────────┘
     │
     │ 2. Inject "Mirror" button
     │    Listen for click
     ▼
┌─────────────────┐
│  User clicks    │
│  "Mirror"       │
└────┬────────────┘
     │
     │ 3. Get compose text
     │    Get extension token
     │    POST /api/ext/mirror
     │    (Bearer token auth)
     ▼
┌─────────────────┐
│ extensionController│
│ .mirror()       │
└────┬────────────┘
     │
     │ 4. Validate token
     │    Get user identity
     │    Run mirror engine
     ▼
┌─────────────────┐
│  Return reply   │
│  Show in modal  │
└────┬────────────┘
     │
     │ 5. User confirms
     │    Insert into compose
     ▼
┌─────────────────┐
│  Reply inserted │
│  Ready to send  │
└─────────────────┘
```

---

## 🗄️ Database Schema Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                           │
│                                                              │
│  ┌──────────────┐                                           │
│  │    User      │  (1 user)                                 │
│  │  - id        │                                           │
│  │  - email     │                                           │
│  │  - profile   │                                           │
│  └──────┬───────┘                                           │
│         │ 1:1                                               │
│         │                                                    │
│  ┌──────▼───────┐                                           │
│  │  identities  │  (1 identity per user)                  │
│  │  - id        │                                           │
│  │  - userId    │                                           │
│  │  - activeVersionId │                                     │
│  └──────┬───────┘                                           │
│         │ 1:N                                               │
│         │                                                    │
│  ┌──────▼───────┐                                           │
│  │identity_     │  (Versioned, immutable)                  │
│  │versions      │                                           │
│  │  - id        │                                           │
│  │  - identityId│                                          │
│  │  - version   │                                           │
│  │  - identityJson (JSONB) │                                │
│  │  - status    │                                           │
│  └──────┬───────┘                                           │
│         │ 1:N                                               │
│         │                                                    │
│  ┌──────▼───────┐                                           │
│  │ mirror_runs  │  (Audit trail)                           │
│  │  - id        │                                           │
│  │  - identityVersionId │                                   │
│  │  - incomingMessage │                                     │
│  │  - outputReply │                                         │
│  │  - decisionAction │                                      │
│  │  - tokensIn/Out │                                        │
│  │  - latencyMs │                                           │
│  └──────┬───────┘                                           │
│         │ 1:N                                               │
│         │                                                    │
│  ┌──────▼───────┐                                           │
│  │trust_events  │  (User feedback)                          │
│  │  - id        │                                           │
│  │  - mirrorRunId │                                         │
│  │  - event     │ (confirm_yes/no/regenerate)               │
│  └──────────────┘                                           │
│                                                              │
│  ┌──────────────┐                                           │
│  │subscriptions │  (Payment integration)                    │
│  │  - id        │                                           │
│  │  - userId    │                                           │
│  │  - tier      │ (free/pro/teams)                          │
│  │  - status    │ (active/cancelled)                        │
│  │  - razorpayOrderId │                                     │
│  │  - currentPeriodEnd │                                    │
│  └──────────────┘                                           │
│                                                              │
│  ┌──────────────┐                                           │
│  │extension_    │  (Extension tokens)                       │
│  │tokens        │                                           │
│  │  - id        │                                           │
│  │  - userId    │                                           │
│  │  - tokenHash │                                           │
│  │  - scopes    │                                           │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security & Rate Limiting Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    REQUEST FLOW                              │
│                                                              │
│  Request → Global Rate Limit (500/15min)                    │
│           ↓                                                  │
│           CORS Check                                         │
│           ↓                                                  │
│           Helmet Security Headers                            │
│           ↓                                                  │
│           Body Parser                                        │
│           ↓                                                  │
│           Cookie Parser                                      │
│           ↓                                                  │
│           Session (PostgreSQL)                               │
│           ↓                                                  │
│           JWT Extraction (from cookie)                       │
│           ↓                                                  │
│           Route-Specific Rate Limit:                         │
│           • Login: 5/15min                                   │
│           • OTP: 5/15min                                     │
│           • Mirror: 10/30days (free) or unlimited (paid)     │
│           • Identity Create: 3/hour                          │
│           ↓                                                  │
│           CSRF Token Check (for state-changing ops)         │
│           ↓                                                  │
│           Profile Completion Guard                           │
│           ↓                                                  │
│           Route Handler                                      │
│           ↓                                                  │
│           Error Handler (if error)                           │
│           ↓                                                  │
│           Response                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 💳 Subscription & Rate Limit Integration

```
┌─────────────────────────────────────────────────────────────┐
│              SUBSCRIPTION-AWARE RATE LIMITING                │
│                                                              │
│  Mirror Request                                              │
│           ↓                                                  │
│  Check User Authentication                                   │
│           ↓                                                  │
│  getUserSubscriptionTier(userId)                             │
│           ↓                                                  │
│  Query: SELECT tier FROM subscriptions                       │
│         WHERE userId=$1 AND status='active'                  │
│           ↓                                                  │
│  ┌─────────────────┐                                         │
│  │ tier = 'free'   │ → Limit: 10 mirrors/30days            │
│  │ tier = 'pro'    │ → Limit: 1,000,000 (unlimited)        │
│  │ tier = 'teams'  │ → Limit: 1,000,000 (unlimited)        │
│  └─────────────────┘                                         │
│           ↓                                                  │
│  Check Rate Limit Store (PostgreSQL)                         │
│           ↓                                                  │
│  ┌─────────────────┐                                         │
│  │ Within Limit?   │ → Allow request                        │
│  │ Exceeded?       │ → Return 429 + upgrade message         │
│  └─────────────────┘                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION SETUP                          │
│                                                              │
│  ┌──────────────────┐      ┌──────────────────┐           │
│  │   Railway        │      │   Railway        │           │
│  │   (Backend)      │      │   (Frontend)     │           │
│  │                  │      │                  │           │
│  │  Node.js Server  │◄────►│  React SPA       │           │
│  │  Port: 3000      │ HTTPS│  Port: 5173      │           │
│  │                  │      │                  │           │
│  │  Environment:    │      │  Environment:    │           │
│  │  • DATABASE_URL  │      │  • VITE_API_URL  │           │
│  │  • JWT_SECRET    │      │  • VITE_RAZORPAY_ │           │
│  │  • ENABLE_PAYMENTS│     │    KEY_ID        │           │
│  └────────┬─────────┘      └──────────────────┘           │
│           │                                                 │
│           │ PostgreSQL Connection                           │
│           ▼                                                 │
│  ┌──────────────────┐                                      │
│  │   Supabase       │                                      │
│  │   PostgreSQL     │                                      │
│  │   Database       │                                      │
│  └──────────────────┘                                      │
│                                                              │
│  External Services:                                         │
│  • Groq API (LLM)                                           │
│  • Razorpay (Payments - disabled by default)               │
│  • Resend (Email)                                           │
│  • PostHog (Analytics - optional)                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Key Metrics & Monitoring

```
┌─────────────────────────────────────────────────────────────┐
│                    MONITORING DASHBOARD                      │
│                                                              │
│  Admin Dashboard (/admin):                                   │
│  • Total Users                                               │
│  • New Users (7d/30d)                                        │
│  • Mirror Runs                                               │
│  • Token Usage                                               │
│  • Trust Events (Yes/No ratio)                               │
│  • Events by Type                                            │
│                                                              │
│  Database Metrics:                                           │
│  • Connection pool usage                                     │
│  • Query performance                                         │
│  • Table sizes                                               │
│                                                              │
│  Application Metrics:                                        │
│  • Rate limit violations                                     │
│  • Error rates                                               │
│  • API response times                                        │
│  • LLM latency                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Production Readiness Checklist

- [x] ✅ Database schema complete and optimized
- [x] ✅ Security measures implemented (JWT, CSRF, Rate Limiting)
- [x] ✅ Error handling comprehensive
- [x] ✅ Payment integration (disabled by default)
- [x] ✅ Logging and monitoring ready
- [x] ✅ Frontend/backend integration complete
- [x] ✅ Environment validation in place
- [x] ✅ Graceful shutdown implemented
- [x] ✅ Rate limiting correctly configured (30-day window)
- [x] ✅ All code changes verified

---

## 🎯 Quick Reference

### **API Endpoints:**
- `/api/auth/*` - Authentication
- `/api/identity/*` - Identity management
- `/api/identity/mirror` - Generate reply
- `/api/payment/*` - Payment integration
- `/api/ext/*` - Extension endpoints (Bearer auth)
- `/api/admin/*` - Admin dashboard

### **Frontend Routes:**
- `/` - Landing page
- `/auth` - Login/Signup
- `/pricing` - Pricing page
- `/identity/setup` - Create identity
- `/mirror` - Generate reply
- `/history` - Mirror history
- `/account` - Account settings
- `/admin` - Admin dashboard

### **Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - JWT signing key
- `ENABLE_PAYMENTS` - Payment feature flag (false in prod)
- `RAZORPAY_KEY_ID` - Razorpay key (optional)
- `GROQ_API_KEY` - LLM API key

---

**Status:** ✅ **PRODUCTION READY**  
**Last Updated:** 2026-01-26




