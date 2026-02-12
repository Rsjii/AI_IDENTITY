# 🎯 FINAL COMPLETE IMPLEMENTATION PLAN
**Token-Based AI Avatar Platform - A to Z**
**Date:** 2026-02-10
**Status:** ✅ Final Architecture (Extensively Researched)

---

## 📚 TABLE OF CONTENTS

1. [Research & Industry Analysis](#research--industry-analysis)
2. [Core Architecture - Token Tracking](#core-architecture---token-tracking)
3. [Creator Pricing Plans](#creator-pricing-plans)
4. [End User Pricing](#end-user-pricing)
5. [Database Schema](#database-schema)
6. [Backend Logic & Flows](#backend-logic--flows)
7. [Frontend UI/UX](#frontend-uiux)
8. [Implementation Checklist - MVP](#implementation-checklist---mvp)
9. [Post-MVP Features](#post-mvp-features)
10. [Flow Diagrams](#flow-diagrams)

---

## 1. RESEARCH & INDUSTRY ANALYSIS

### 🔍 How Major Platforms Actually Work

#### ChatGPT Plus ($20/month)
```
Backend:
- Tracks tokens per request (input + output)
- Dynamic limits based on model:
  - GPT-4: ~40 messages per 3 hours (~400K tokens)
  - GPT-3.5: Much higher limits
- Resets every 3 hours
- NO fixed "500 messages" limit

Frontend:
- "You've reached the current usage cap for GPT-4"
- Shows approximate: "You can use GPT-4 again in 2 hours"
- Graceful fallback to GPT-3.5
- NO exact token/message counter shown

Key Insights:
✅ Backend tracks tokens precisely
✅ Frontend shows soft indicators
✅ Time-based rolling limits
✅ Graceful degradation
```

#### Claude Pro ($20/month)
```
Backend:
- Token-based usage tracking
- Priority access (no hard limits advertised)
- "Fair use" policy

Frontend:
- Usage meter (visual bar, no numbers)
- "You're using Claude heavily today..."
- Suggests taking a break
- NO exact limits shown

Key Insights:
✅ Soft limits, not hard caps
✅ Visual indicators (progress bar)
✅ Priority queue access
✅ Gentle messaging
```

#### OpenAI API (Pay-per-use)
```
Backend:
- Pure token counting
- $0.01 per 1K input tokens (GPT-4o)
- $0.03 per 1K output tokens (GPT-4o)
- Prepaid balance system

Frontend (Dashboard):
- Shows: "1.2M tokens used this month"
- Real-time cost: "$18.50 spent"
- Clear pricing per model
- Usage graphs

Key Insights:
✅ Transparent token pricing
✅ Real-time usage display
✅ Prepaid credits
✅ Per-model pricing
```

#### Midjourney (Subscription)
```
Backend:
- Tracks "Fast GPU hours"
- Basic: 200 images (~3.3 hours)
- Standard: 900 images (~15 hours)
- Pro: 1800 images (~30 hours)

Frontend:
- Shows: "12.4 / 15 hours remaining"
- Visual meter
- "Relax mode" (unlimited but slower)
- Clear when to upgrade

Key Insights:
✅ Resource-based (GPU time, not images)
✅ Clear visual meters
✅ Fallback option (slow mode)
✅ Transparent limits
```

#### Cursor IDE Pro ($20/month)
```
Backend:
- Fast requests: ~500/month (premium models)
- Slow requests: Unlimited (basic models)
- Token-aware backend

Frontend:
- Shows: "342 / 500 premium requests"
- Automatic fallback to slow mode
- Clear which model is being used

Key Insights:
✅ Two-tier system (fast/slow)
✅ Clear counters for premium tier
✅ Automatic degradation
✅ Transparent model selection
```

---

### 🎯 KEY TAKEAWAYS FOR OUR PLATFORM

**What ALL platforms do:**
1. ✅ **Backend tracks actual resource usage** (tokens/GPU time)
2. ✅ **Frontend shows approximate indicators** (not exact counts)
3. ✅ **Soft limits with graceful degradation** (not hard blocks)
4. ✅ **Visual progress indicators** (bars, percentages)
5. ✅ **Clear upgrade paths** when approaching limits

**What NO platform does:**
1. ❌ Show exact token counts to end users
2. ❌ "You have 487 tokens remaining"
3. ❌ Hard blocks without warning
4. ❌ 24-hour passes with message limits
5. ❌ Confusing credit systems

**Our Approach:**
```
Backend: Track tokens precisely (this is our actual cost)
Frontend: Show usage indicators (percentage, visual bars)
Limits: Soft warnings → Hard caps only when absolutely necessary
UX: "You're at 80% usage" not "You have 1,234 tokens left"
```

---

## 2. CORE ARCHITECTURE - TOKEN TRACKING

### 🧮 Token-Based System (The Foundation)

**Why Tokens, Not Messages:**
```
Problem with message counting:
❌ "Hey" = ~10 tokens (cheap)
❌ Essay with 2000 words = ~3000 tokens (expensive)
❌ 100 short messages ≠ 10 long conversations in cost

Solution with token counting:
✅ Tracks actual API cost
✅ Fair for all usage patterns
✅ Predictable platform costs
✅ Industry standard
```

### 📊 Token Calculation

**Per Message:**
```javascript
Message tokens = Input tokens + Output tokens + System tokens

Example conversation turn:
User: "Explain quantum physics" = ~150 input tokens
System prompt: "You are an AI assistant..." = ~200 tokens
AI Response: "Quantum physics is..." (500 words) = ~750 output tokens

Total: 150 + 200 + 750 = 1,100 tokens per turn
```

**Cost Calculation (Example with GPT-4o):**
```
Input: $2.50 per 1M tokens
Output: $10 per 1M tokens
System: Counted as input

Per turn cost:
- Input: (150 + 200) * $2.50 / 1M = $0.000875
- Output: 750 * $10 / 1M = $0.0075
- Total: ~$0.0084 per turn

100 conversations = ~$0.84 cost
Your pricing: $10 subscription
Margin: ~11.9x (excellent)
```

**Token Limits Per Dollar:**
```
$1 subscription = ~30,000 tokens allocation
$10 subscription = ~300,000 tokens
$50 subscription = ~1,500,000 tokens

This equals:
- Short messages: ~1,000-1,500 turns
- Average messages: ~300-500 turns
- Long conversations: ~100-200 turns

But user NEVER sees these numbers!
```

---

## 3. CREATOR PRICING PLANS

### 💳 Platform Subscriptions (What Creators Pay Us)

**Differentiation Strategy:**
1. **Storage** (Primary, Hard Limit)
2. **Monthly Token Quota** (Across all users chatting with creator)
3. **Features** (Marketplace, Voice, API, Analytics)
4. **Support Level** (Response time)

---

### 📦 PLAN DETAILS

#### **FREE TIER - Testing Only**
```
Price: $0/month

Storage:
- 100 MB total
- For avatar files, docs, images
- Hard limit (uploads blocked when full)

Token Quota:
- 100K tokens/month (across all users)
- ~30-50 conversations total
- For testing only
- Soft limit (warns at 80%, blocks at 100%)

Features:
❌ NO marketplace listing (private avatars only)
❌ NO analytics dashboard
❌ NO voice cloning
❌ NO custom branding
❌ NO API access
✅ Basic avatar builder
✅ Private sharing (via link)
✅ Community support only

Support:
- Docs & community forum
- No direct email support

Best For:
- Testing the platform
- Building prototype avatars
- Personal use only
```

#### **STARTER - $15/month**
```
Price: $15/month (billed monthly)

Storage:
- 1 GB total
- 10x more than Free
- Hard limit with warnings at 80%

Token Quota:
- 5 Million tokens/month
- ~1,500-2,500 conversations
- Good for small audience
- Soft limit (allows 10% overage, then blocks)

Features:
✅ Marketplace listing (publish your avatar)
✅ Basic analytics:
   - Total conversations
   - Top questions asked
   - User engagement time
   - Token usage graph
✅ Custom avatar URL (yourname.platform.com)
✅ Accept subscriptions from users
✅ Accept one-time purchases
✅ Email notifications (usage warnings)
❌ NO voice cloning
❌ NO API access
❌ NO white-label

Support:
- Email support (48-hour response)
- Priority community access

Best For:
- New creators
- Small audience (100-500 users/month)
- Testing monetization
```

#### **GROWTH - $60/month**
```
Price: $60/month (billed monthly or $600/year for 2 months free)

Storage:
- 10 GB total
- For extensive content libraries
- Hard limit with warnings at 80%

Token Quota:
- 25 Million tokens/month
- ~7,500-12,500 conversations
- Handles medium audience
- Soft limit (allows 15% overage)

Features:
✅ Everything in Starter, PLUS:
✅ Voice cloning (ElevenLabs integration)
   - Up to 3 voice clones
   - Custom voice for avatar
✅ Priority marketplace listing
   - Featured on homepage
   - Better search ranking
✅ Advanced analytics:
   - Conversation sentiment analysis
   - User retention metrics
   - Revenue analytics
   - Export to CSV
✅ Multiple avatar variants
   - Create 3 different avatars
   - A/B test different personalities
✅ Custom branding
   - Logo upload
   - Custom colors
   - Branded chat widget
✅ Webhook notifications
   - Real-time event notifications
   - Integrate with Zapier/Make

Support:
- Priority email (24-hour response)
- Monthly strategy call

Best For:
- Growing creators
- Medium audience (1K-5K users/month)
- Serious about monetization
- Want voice features
```

#### **SCALE - $175/month**
```
Price: $175/month (billed monthly or $1,750/year for 2 months free)

Storage:
- 50 GB total
- Enterprise-grade storage
- Hard limit with warnings at 80%

Token Quota:
- 100 Million tokens/month
- ~30K-50K conversations
- Large audience support
- Soft limit (allows 20% overage)

Features:
✅ Everything in Growth, PLUS:
✅ Full API access
   - REST API for custom integrations
   - Embed avatar anywhere
   - Custom frontends
   - Rate limit: 1000 req/min
✅ White-label options
   - Remove platform branding
   - Custom domain (chat.yourbrand.com)
   - Custom email notifications
✅ Unlimited voice clones
✅ Team access
   - Add 5 team members
   - Role-based permissions
   - Collaboration tools
✅ Advanced integrations
   - Slack bot
   - Discord bot
   - WhatsApp (via Twilio)
   - SMS notifications
✅ Custom onboarding
   - Dedicated setup call
   - Migration assistance
✅ Usage-based alerts
   - SMS alerts at 80%/100%
   - Custom alert thresholds
✅ Priority infrastructure
   - Faster response times
   - Dedicated resources

Support:
- Dedicated support manager
- Slack/Discord direct line
- 4-hour response SLA
- Quarterly strategy review

Best For:
- Established creators
- Large audience (10K+ users/month)
- Enterprise customers
- Complex integrations
```

---

### 📊 Creator Plan Comparison Table

| Feature | Free | Starter | Growth | Scale |
|---------|------|---------|--------|-------|
| **Price** | $0 | $15/mo | $60/mo | $175/mo |
| **Storage** | 100 MB | 1 GB | 10 GB | 50 GB |
| **Token Quota** | 100K | 5M | 25M | 100M |
| **Est. Conversations** | ~50 | ~2K | ~10K | ~40K |
| **Marketplace Listing** | ❌ | ✅ | ✅ Featured | ✅ Priority |
| **Analytics** | ❌ | Basic | Advanced | Enterprise |
| **Voice Cloning** | ❌ | ❌ | ✅ (3 voices) | ✅ Unlimited |
| **Custom Branding** | ❌ | ❌ | ✅ | ✅ White-label |
| **API Access** | ❌ | ❌ | ❌ | ✅ Full |
| **Team Members** | 1 | 1 | 1 | 5 |
| **Support** | Community | Email 48h | Email 24h | Dedicated |

---

### 🎯 Token Quota Enforcement (Creator Side)

**How it works:**
```
1. Every conversation uses tokens from creator's quota
2. Backend tracks: Total tokens used across ALL users
3. At 80% usage: Email + dashboard warning
4. At 100% usage: Soft block (allow 10-20% overage)
5. At overage limit: Hard block new conversations

Example (Starter plan - 5M tokens/month):
- Week 1: 1.2M tokens used (24%) ✅ Normal
- Week 2: 3.8M tokens used (76%) ✅ Normal
- Week 3: 4.2M tokens used (84%) ⚠️ Warning shown
- Week 4: 5.0M tokens used (100%) ⚠️ Soft block (can use up to 5.5M)
- Beyond 5.5M: 🚫 Hard block - upgrade required
```

**Frontend Display (Creator Dashboard):**
```
┌─────────────────────────────────────────┐
│ Monthly Usage (Starter Plan)           │
├─────────────────────────────────────────┤
│                                         │
│  ████████████████░░░░  84%             │
│                                         │
│  4.2M / 5M tokens used                 │
│                                         │
│  ⚠️ Approaching limit                  │
│  → Upgrade to Growth for 5x more usage │
│                                         │
│  [View Details]  [Upgrade Plan]        │
└─────────────────────────────────────────┘

Click "View Details":
┌─────────────────────────────────────────┐
│ Token Usage Breakdown                   │
├─────────────────────────────────────────┤
│ This Week:     850K tokens             │
│ Last Week:     920K tokens             │
│ This Month:    4.2M tokens             │
│                                         │
│ Average per conversation: ~2,100 tokens │
│ Total conversations: ~2,000            │
│                                         │
│ Projected usage: 5.8M (overage likely) │
│ Recommended: Upgrade to Growth         │
└─────────────────────────────────────────┘
```

**Email Notification (80% threshold):**
```
Subject: ⚠️ You're at 84% of your monthly token limit

Hi [Creator],

Your avatar "[Avatar Name]" is getting popular! 🎉

You've used 4.2M out of 5M tokens this month (84%).

What happens next?
- At 100%: We'll allow up to 10% overage (5.5M total)
- Beyond that: New conversations will be paused until:
  → You upgrade your plan, OR
  → Your quota resets on Feb 28

Recommended action:
Upgrade to Growth plan for 5x more tokens (25M/month)

[Upgrade Now] [View Usage Details]

Questions? Reply to this email.

Best,
[Platform] Team
```

---

## 4. END USER PRICING

### 💰 What End Users Pay (To Chat with Creators)

**Pricing Model: Hybrid (Subscription + Token Packs)**

#### **FREE TIER**
```
What they get:
- 10,000 tokens per creator per month
- Resets monthly
- ~3-10 conversation turns (depending on length)
- No payment required

Limitations:
- Cannot save conversation history
- Lower priority in queue
- May have rate limits (1 msg per minute)

Frontend shows:
"You're on the free plan
 [Unlock unlimited access →]"

NO exact token counter shown to user
```

#### **CREATOR SUBSCRIPTION** (Primary monetization)
```
What it is:
- Monthly subscription TO a specific creator
- Creator sets the price: $5-$200/month
- Creator sets token allocation

Example creator settings:
- Basic: $10/month = 300K tokens (~150 turns)
- Premium: $30/month = 1M tokens (~500 turns)
- VIP: $100/month = 4M tokens (~2000 turns)

User sees:
┌──────────────────────────────────────┐
│  Subscribe to [Creator Name]         │
├──────────────────────────────────────┤
│  💎 VIP Access - $30/month          │
│                                      │
│  ✅ Unlimited conversations*        │
│  ✅ Save conversation history       │
│  ✅ Priority responses              │
│  ✅ Exclusive content               │
│  ✅ Cancel anytime                  │
│                                      │
│  *Fair use: ~500 conversation turns │
│   Most users never hit this limit   │
│                                      │
│  [Subscribe - $30/month]            │
└──────────────────────────────────────┘

Backend tracks:
- User subscription status
- Tokens used: 245,000 / 1,000,000
- Resets: March 1, 2026

Frontend shows during usage:
┌──────────────────────────────────────┐
│  [Avatar responds...]                │
│                                      │
│  ────────────────────────────────────│
│  VIP Subscriber                      │
│  [███████░░░] ~25% used this month  │
└──────────────────────────────────────┘

At 80%:
┌──────────────────────────────────────┐
│  ⚠️ Usage Notice                    │
│  You've used your subscription       │
│  heavily this month. You're at ~80%  │
│  of typical usage.                   │
│                                      │
│  Resets in 8 days (March 1)         │
│  [Got it]                            │
└──────────────────────────────────────┘

At 100%:
┌──────────────────────────────────────┐
│  📊 Monthly Limit Reached           │
│  You've reached your fair use limit  │
│  for this month.                     │
│                                      │
│  Options:                            │
│  1. Wait 8 days for reset (March 1)  │
│  2. Buy token pack for more access   │
│                                      │
│  [Buy Token Pack] [Wait for Reset]  │
└──────────────────────────────────────┘
```

#### **TOKEN PACKS** (One-time purchase, never expire)
```
What it is:
- One-time purchase
- Tokens never expire
- Use anytime
- Stackable (can buy multiple)

Pricing tiers (Creator sets these):
- Small: $5 = 150K tokens (~75 turns)
- Medium: $10 = 350K tokens (~175 turns)
- Large: $25 = 1M tokens (~500 turns)
- Jumbo: $50 = 2.5M tokens (~1250 turns)

User sees:
┌──────────────────────────────────────┐
│  Buy Token Pack                      │
├──────────────────────────────────────┤
│  Choose your pack:                   │
│                                      │
│  ○ Small - $5                        │
│    ~75 conversation turns            │
│                                      │
│  ◉ Medium - $10 (Popular)           │
│    ~175 conversation turns           │
│                                      │
│  ○ Large - $25 (Best value)         │
│    ~500 conversation turns           │
│                                      │
│  💡 Tokens never expire              │
│  💡 Use across multiple sessions     │
│                                      │
│  [Purchase - $10]                    │
└──────────────────────────────────────┘

After purchase:
- Tokens added to user's account
- Can be used anytime
- Tracked separately from subscription
```

---

### 🔄 Priority & Fallback Logic

**When user sends a message, system checks in order:**

```
Priority 1: Active Subscription
├─ Check: Does user have active subscription to this creator?
├─ If YES:
│  ├─ Check tokens used this period
│  ├─ If under limit (< 100%):
│  │  └─ ✅ Allow message, deduct from subscription quota
│  └─ If at/over limit (≥ 100%):
│     └─ ⚠️ Fall to Priority 2
└─ If NO: Fall to Priority 2

Priority 2: Token Packs
├─ Check: Does user have token pack balance?
├─ If YES and balance > 0:
│  ├─ Check if enough tokens for this message
│  ├─ If YES:
│  │  └─ ✅ Allow message, deduct from pack balance
│  └─ If NO:
│     └─ ⚠️ Fall to Priority 3
└─ If NO packs: Fall to Priority 3

Priority 3: Free Tier
├─ Check: Has user used free monthly quota?
├─ If under limit:
│  └─ ✅ Allow message, deduct from free quota
└─ If at limit:
   └─ 🚫 Show paywall

Paywall:
┌──────────────────────────────────────┐
│  🔒 Continue Chatting                │
├──────────────────────────────────────┤
│  You've used your free messages      │
│  this month.                         │
│                                      │
│  Choose an option:                   │
│                                      │
│  💎 Subscribe ($30/month)            │
│  Unlimited conversations + benefits  │
│  [Subscribe →]                       │
│                                      │
│  💰 Buy Token Pack ($10)            │
│  ~175 more conversations             │
│  [Buy Pack →]                        │
│                                      │
│  ⏰ Or wait until March 1 (8 days)  │
└──────────────────────────────────────┘
```

---

### 📊 User Dashboard - Token Usage Display

**Dashboard Page:**
```
┌─────────────────────────────────────────────────┐
│  Your Subscriptions                             │
├─────────────────────────────────────────────────┤
│                                                 │
│  [Avatar Icon] Tech Guru AI                    │
│  VIP Subscriber - $30/month                    │
│  [████████░░] Active usage                     │
│  Next billing: March 1, 2026                   │
│  [Manage] [Cancel]                             │
│                                                 │
│  [Avatar Icon] Fitness Coach                   │
│  VIP Subscriber - $20/month                    │
│  [██░░░░░░░░] Light usage                      │
│  Next billing: March 15, 2026                  │
│  [Manage] [Cancel]                             │
│                                                 │
├─────────────────────────────────────────────────┤
│  Your Token Packs                              │
├─────────────────────────────────────────────────┤
│                                                 │
│  💰 Available: ~250 conversation turns         │
│  Can be used with any creator                  │
│  [Buy More]                                    │
│                                                 │
└─────────────────────────────────────────────────┘

Note: User sees "conversation turns" not "tokens"
Backend tracks tokens, frontend translates to turns
```

---

## 5. DATABASE SCHEMA

### 📦 New/Updated Tables

#### **1. Token Usage Tracking**
```sql
-- Main table for tracking all token usage
CREATE TABLE token_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Who used tokens
    user_id UUID REFERENCES "User"(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES "User"(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,

    -- Token breakdown
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    system_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens + system_tokens) STORED,

    -- Which model was used
    model_used VARCHAR(100), -- 'gpt-4o', 'gpt-4o-mini', 'claude-3-opus', etc.

    -- What type of access was used
    access_type VARCHAR(50), -- 'subscription', 'token_pack', 'free'

    -- Cost tracking (for internal analytics)
    estimated_cost_usd DECIMAL(10, 6), -- Actual API cost

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),

    -- Indexes for fast queries
    INDEX idx_token_usage_user (user_id, created_at),
    INDEX idx_token_usage_creator (creator_id, created_at),
    INDEX idx_token_usage_session (session_id),
    INDEX idx_token_usage_access_type (access_type)
);

-- Aggregated token usage per creator (for fast dashboard queries)
CREATE TABLE creator_token_aggregates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID REFERENCES "User"(id) ON DELETE CASCADE UNIQUE,

    -- Current period (resets monthly)
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    tokens_used_this_period BIGINT DEFAULT 0,

    -- All-time stats
    total_tokens_all_time BIGINT DEFAULT 0,
    total_conversations_all_time INTEGER DEFAULT 0,

    -- Last updated
    updated_at TIMESTAMP DEFAULT NOW(),

    INDEX idx_creator_token_agg (creator_id)
);

-- Aggregated token usage per end-user per creator (for subscription limits)
CREATE TABLE user_creator_token_aggregates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES "User"(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES "User"(id) ON DELETE CASCADE,

    -- Current period (resets monthly for subscriptions)
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    tokens_used_this_period BIGINT DEFAULT 0,

    -- All-time with this creator
    total_tokens_all_time BIGINT DEFAULT 0,

    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(user_id, creator_id),
    INDEX idx_user_creator_agg (user_id, creator_id)
);
```

#### **2. Token Packs (One-time purchases)**
```sql
CREATE TABLE token_packs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES "User"(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES "User"(id) ON DELETE CASCADE,

    -- Pack details
    tokens_purchased BIGINT NOT NULL,
    tokens_remaining BIGINT NOT NULL,
    amount_paid_cents INTEGER NOT NULL, -- Stored in cents for precision
    currency VARCHAR(3) DEFAULT 'USD',

    -- Payment info
    stripe_payment_intent_id VARCHAR(255),

    -- Timestamps
    purchased_at TIMESTAMP DEFAULT NOW(),

    INDEX idx_token_packs_user (user_id),
    INDEX idx_token_packs_creator (creator_id)
);
```

#### **3. Updated: marketplace_subscriptions**
```sql
-- Add token tracking to existing subscription table
ALTER TABLE marketplace_subscriptions
ADD COLUMN IF NOT EXISTS token_limit BIGINT, -- Total tokens allowed per period
ADD COLUMN IF NOT EXISTS tokens_used_this_period BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS period_start TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS period_end TIMESTAMP;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_subs_user_creator
ON marketplace_subscriptions(user_id, creator_id, status);
```

#### **4. Updated: User (Creator Plans)**
```sql
-- Add token quota tracking for creators
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(50) DEFAULT 'free', -- 'free', 'starter', 'growth', 'scale'
ADD COLUMN IF NOT EXISTS plan_token_quota BIGINT DEFAULT 100000, -- Monthly token quota
ADD COLUMN IF NOT EXISTS plan_storage_mb INTEGER DEFAULT 100, -- Storage limit in MB
ADD COLUMN IF NOT EXISTS storage_used_mb INTEGER DEFAULT 0, -- Current storage usage
ADD COLUMN IF NOT EXISTS plan_period_start TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS plan_period_end TIMESTAMP,
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255), -- For creator plan payments
ADD COLUMN IF NOT EXISTS plan_status VARCHAR(50) DEFAULT 'active'; -- 'active', 'cancelled', 'past_due'

CREATE INDEX IF NOT EXISTS idx_user_plan ON "User"(plan_tier, plan_status);
```

#### **5. Rate Limiting Table**
```sql
CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES "User"(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES "User"(id) ON DELETE CASCADE,

    -- Tracking
    last_message_at TIMESTAMP NOT NULL,
    message_count_in_window INTEGER DEFAULT 1,
    window_start TIMESTAMP DEFAULT NOW(),

    -- Updated on each message
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(user_id, creator_id),
    INDEX idx_rate_limits (user_id, creator_id, last_message_at)
);
```

---

## 6. BACKEND LOGIC & FLOWS

### 🔐 Core Middleware: `checkTokenAccess()`

**Primary function that runs before EVERY chat message:**

```typescript
// backend/src/middleware/checkTokenAccess.ts

interface TokenAccessResult {
  allowed: boolean;
  reason?: string;
  accessType?: 'subscription' | 'token_pack' | 'free';
  tokensAvailable?: number;
  rateLimitHit?: boolean;
  needsPayment?: boolean;
  estimatedTokensNeeded?: number; // Based on message length
}

export async function checkTokenAccess(
  userId: string,
  creatorId: string,
  sessionId: string,
  messageLength: number // To estimate tokens needed
): Promise<TokenAccessResult> {

  // Step 0: Estimate tokens needed for this message
  const estimatedTokens = estimateTokens(messageLength);
  // Rough formula: messageLength * 1.3 + 500 (for completion)
  // e.g., 100 char message = ~130 input + ~500 output = ~630 tokens

  // Step 1: Check rate limiting first (security)
  const rateLimitOk = await checkRateLimit(userId, creatorId);
  if (!rateLimitOk) {
    return {
      allowed: false,
      reason: 'Rate limit exceeded. Please slow down.',
      rateLimitHit: true
    };
  }

  // Step 2: Check creator's quota (platform-level check)
  const creatorQuota = await checkCreatorQuota(creatorId);
  if (!creatorQuota.allowed) {
    return {
      allowed: false,
      reason: 'Creator has reached their monthly limit. Please try again later.',
      accessType: undefined
    };
  }

  // Step 3: Priority 1 - Check for active subscription
  const subscription = await getActiveSubscription(userId, creatorId);
  if (subscription) {
    const tokensUsed = subscription.tokens_used_this_period || 0;
    const tokenLimit = subscription.token_limit || 0;
    const tokensRemaining = tokenLimit - tokensUsed;

    if (tokensRemaining >= estimatedTokens) {
      // Has enough tokens in subscription
      return {
        allowed: true,
        accessType: 'subscription',
        tokensAvailable: tokensRemaining,
        estimatedTokensNeeded: estimatedTokens
      };
    }

    // Subscription exists but exhausted, fall through to token packs
  }

  // Step 4: Priority 2 - Check for token packs
  const tokenPack = await getTokenPackBalance(userId, creatorId);
  if (tokenPack && tokenPack.tokens_remaining >= estimatedTokens) {
    return {
      allowed: true,
      accessType: 'token_pack',
      tokensAvailable: tokenPack.tokens_remaining,
      estimatedTokensNeeded: estimatedTokens
    };
  }

  // Step 5: Priority 3 - Check free tier
  const freeUsage = await getFreeUsageThisPeriod(userId, creatorId);
  const FREE_TIER_LIMIT = 10000; // 10K tokens per month
  const freeRemaining = FREE_TIER_LIMIT - freeUsage;

  if (freeRemaining >= estimatedTokens) {
    return {
      allowed: true,
      accessType: 'free',
      tokensAvailable: freeRemaining,
      estimatedTokensNeeded: estimatedTokens
    };
  }

  // Step 6: No access available - needs payment
  return {
    allowed: false,
    reason: 'No active subscription or token packs available',
    needsPayment: true,
    accessType: undefined
  };
}

// Helper: Estimate tokens from message length
function estimateTokens(messageLength: number): number {
  // Conservative estimate:
  // - Input: message length / 4 * 1.3 (accounting for tokenization)
  // - Output: Assume average 500 tokens response
  // - System: ~200 tokens

  const inputTokens = Math.ceil(messageLength / 4 * 1.3);
  const outputTokens = 500; // Average
  const systemTokens = 200;

  return inputTokens + outputTokens + systemTokens;
}

// Helper: Check rate limiting
async function checkRateLimit(userId: string, creatorId: string): Promise<boolean> {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60000);

  // Get user's access level
  const hasSubscription = await getActiveSubscription(userId, creatorId);
  const hasPack = await getTokenPackBalance(userId, creatorId);

  // Different rate limits based on access
  let messagesPerMinute: number;
  if (hasSubscription) {
    messagesPerMinute = 10; // Subscribers: 10 per minute
  } else if (hasPack) {
    messagesPerMinute = 5; // Token pack users: 5 per minute
  } else {
    messagesPerMinute = 1; // Free tier: 1 per minute
  }

  // Check recent messages
  const recentCount = await db.query(
    `SELECT COUNT(*) as count FROM rate_limits
     WHERE user_id = $1 AND creator_id = $2
     AND last_message_at > $3`,
    [userId, creatorId, oneMinuteAgo]
  );

  const count = parseInt(recentCount.rows[0]?.count || '0');

  if (count >= messagesPerMinute) {
    return false; // Rate limit hit
  }

  // Update rate limit tracker
  await db.query(
    `INSERT INTO rate_limits (user_id, creator_id, last_message_at, message_count_in_window)
     VALUES ($1, $2, NOW(), 1)
     ON CONFLICT (user_id, creator_id)
     DO UPDATE SET
       last_message_at = NOW(),
       message_count_in_window = CASE
         WHEN rate_limits.window_start < $3 THEN 1
         ELSE rate_limits.message_count_in_window + 1
       END,
       window_start = CASE
         WHEN rate_limits.window_start < $3 THEN NOW()
         ELSE rate_limits.window_start
       END`,
    [userId, creatorId, oneMinuteAgo]
  );

  return true;
}

// Helper: Check creator's platform quota
async function checkCreatorQuota(creatorId: string): Promise<{ allowed: boolean; reason?: string }> {
  const creator = await db.query(
    `SELECT plan_tier, plan_token_quota, plan_period_start, plan_period_end
     FROM "User" WHERE id = $1`,
    [creatorId]
  );

  if (!creator.rows[0]) {
    return { allowed: false, reason: 'Creator not found' };
  }

  const { plan_tier, plan_token_quota, plan_period_start, plan_period_end } = creator.rows[0];

  // Get current period usage
  const usage = await db.query(
    `SELECT tokens_used_this_period FROM creator_token_aggregates
     WHERE creator_id = $1
     AND current_period_start = $2`,
    [creatorId, plan_period_start]
  );

  const tokensUsed = parseInt(usage.rows[0]?.tokens_used_this_period || '0');
  const quota = plan_token_quota || 100000;

  // Allow 20% overage for all plans
  const maxAllowed = quota * 1.2;

  if (tokensUsed >= maxAllowed) {
    return {
      allowed: false,
      reason: 'Creator has exceeded their monthly token quota'
    };
  }

  return { allowed: true };
}
```

---

### 💾 Token Deduction Logic

**After message is sent and AI responds:**

```typescript
// backend/src/services/tokenService.ts

interface TokenUsageRecord {
  userId: string;
  creatorId: string;
  sessionId: string;
  messageId: string;
  inputTokens: number;
  outputTokens: number;
  systemTokens: number;
  modelUsed: string;
  accessType: 'subscription' | 'token_pack' | 'free';
}

export async function recordTokenUsage(record: TokenUsageRecord) {
  const {
    userId,
    creatorId,
    sessionId,
    messageId,
    inputTokens,
    outputTokens,
    systemTokens,
    modelUsed,
    accessType
  } = record;

  const totalTokens = inputTokens + outputTokens + systemTokens;

  // Calculate cost (example for GPT-4o)
  const inputCost = inputTokens * 2.5 / 1000000; // $2.50 per 1M tokens
  const outputCost = outputTokens * 10 / 1000000; // $10 per 1M tokens
  const estimatedCost = inputCost + outputCost;

  // Start transaction
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert detailed usage record
    await client.query(
      `INSERT INTO token_usage
       (user_id, creator_id, session_id, message_id, input_tokens, output_tokens,
        system_tokens, model_used, access_type, estimated_cost_usd)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [userId, creatorId, sessionId, messageId, inputTokens, outputTokens,
       systemTokens, modelUsed, accessType, estimatedCost]
    );

    // 2. Update creator's aggregate (platform quota)
    await client.query(
      `INSERT INTO creator_token_aggregates
       (creator_id, current_period_start, current_period_end,
        tokens_used_this_period, total_tokens_all_time, total_conversations_all_time, updated_at)
       VALUES ($1, date_trunc('month', NOW()),
               date_trunc('month', NOW()) + INTERVAL '1 month',
               $2, $2, 1, NOW())
       ON CONFLICT (creator_id) DO UPDATE SET
         tokens_used_this_period = CASE
           WHEN creator_token_aggregates.current_period_start = date_trunc('month', NOW())
           THEN creator_token_aggregates.tokens_used_this_period + $2
           ELSE $2
         END,
         current_period_start = date_trunc('month', NOW()),
         current_period_end = date_trunc('month', NOW()) + INTERVAL '1 month',
         total_tokens_all_time = creator_token_aggregates.total_tokens_all_time + $2,
         total_conversations_all_time = creator_token_aggregates.total_conversations_all_time + 1,
         updated_at = NOW()`,
      [creatorId, totalTokens]
    );

    // 3. Deduct from user's access method
    if (accessType === 'subscription') {
      // Deduct from subscription quota
      await client.query(
        `UPDATE marketplace_subscriptions
         SET tokens_used_this_period = tokens_used_this_period + $1
         WHERE user_id = $2 AND status = 'active'
         AND EXISTS (
           SELECT 1 FROM marketplace_listings
           WHERE marketplace_listings.id = marketplace_subscriptions.listing_id
           AND marketplace_listings.creator_id = $3
         )`,
        [totalTokens, userId, creatorId]
      );

    } else if (accessType === 'token_pack') {
      // Deduct from token pack (FIFO - oldest pack first)
      await client.query(
        `UPDATE token_packs
         SET tokens_remaining = tokens_remaining - $1
         WHERE id = (
           SELECT id FROM token_packs
           WHERE user_id = $2 AND creator_id = $3 AND tokens_remaining > 0
           ORDER BY purchased_at ASC
           LIMIT 1
         )`,
        [totalTokens, userId, creatorId]
      );

    } else if (accessType === 'free') {
      // Update user-creator aggregate for free tier tracking
      await client.query(
        `INSERT INTO user_creator_token_aggregates
         (user_id, creator_id, current_period_start, current_period_end,
          tokens_used_this_period, total_tokens_all_time, updated_at)
         VALUES ($1, $2, date_trunc('month', NOW()),
                 date_trunc('month', NOW()) + INTERVAL '1 month',
                 $3, $3, NOW())
         ON CONFLICT (user_id, creator_id) DO UPDATE SET
           tokens_used_this_period = CASE
             WHEN user_creator_token_aggregates.current_period_start = date_trunc('month', NOW())
             THEN user_creator_token_aggregates.tokens_used_this_period + $3
             ELSE $3
           END,
           current_period_start = date_trunc('month', NOW()),
           current_period_end = date_trunc('month', NOW()) + INTERVAL '1 month',
           total_tokens_all_time = user_creator_token_aggregates.total_tokens_all_time + $3,
           updated_at = NOW()`,
        [userId, creatorId, totalTokens]
      );
    }

    // 4. Check for warnings (80%, 90% usage)
    await checkAndTriggerWarnings(userId, creatorId, accessType, client);

    await client.query('COMMIT');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Token deduction error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Helper: Check if warnings need to be triggered
async function checkAndTriggerWarnings(
  userId: string,
  creatorId: string,
  accessType: string,
  client: any
) {
  if (accessType === 'subscription') {
    // Check subscription usage
    const sub = await client.query(
      `SELECT token_limit, tokens_used_this_period
       FROM marketplace_subscriptions
       WHERE user_id = $1 AND status = 'active'
       AND EXISTS (
         SELECT 1 FROM marketplace_listings
         WHERE marketplace_listings.id = marketplace_subscriptions.listing_id
         AND marketplace_listings.creator_id = $2
       )`,
      [userId, creatorId]
    );

    if (sub.rows[0]) {
      const { token_limit, tokens_used_this_period } = sub.rows[0];
      const percentage = (tokens_used_this_period / token_limit) * 100;

      if (percentage >= 80 && percentage < 90) {
        // Trigger 80% warning (only once)
        await queueWarningNotification(userId, 'subscription_80', {
          percentage: 80,
          tokensUsed: tokens_used_this_period,
          tokenLimit: token_limit
        });
      } else if (percentage >= 90) {
        // Trigger 90% warning
        await queueWarningNotification(userId, 'subscription_90', {
          percentage: 90,
          tokensUsed: tokens_used_this_period,
          tokenLimit: token_limit
        });
      }
    }
  }

  // Similar checks for creator quotas
  const creatorUsage = await client.query(
    `SELECT u.plan_token_quota, c.tokens_used_this_period
     FROM "User" u
     LEFT JOIN creator_token_aggregates c ON c.creator_id = u.id
     WHERE u.id = $1`,
    [creatorId]
  );

  if (creatorUsage.rows[0]) {
    const { plan_token_quota, tokens_used_this_period } = creatorUsage.rows[0];
    const percentage = (tokens_used_this_period / plan_token_quota) * 100;

    if (percentage >= 80) {
      await queueCreatorWarning(creatorId, percentage);
    }
  }
}
```

---

### 📤 Updated Chat Controller

```typescript
// backend/src/modules/public/publicController.ts

export async function sendMessage(req: Request, res: Response) {
  const { username } = req.params;
  const { message, sessionId } = req.body;
  const userId = (req as any).user?.id || 'anonymous';

  try {
    // 1. Get creator
    const creator = await db.query(
      `SELECT id, username FROM "User" WHERE username = $1`,
      [username]
    );

    if (!creator.rows[0]) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const creatorId = creator.rows[0].id;

    // 2. Check token access
    const access = await checkTokenAccess(
      userId,
      creatorId,
      sessionId,
      message.length
    );

    if (!access.allowed) {
      if (access.rateLimitHit) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: access.reason,
          retryAfter: 60 // seconds
        });
      }

      if (access.needsPayment) {
        return res.status(402).json({
          error: 'Payment required',
          message: access.reason,
          showPaywall: true
        });
      }

      return res.status(403).json({
        error: 'Access denied',
        message: access.reason
      });
    }

    // 3. Call AI API (OpenAI, Claude, etc.)
    const aiResponse = await callAIAPI({
      message,
      sessionId,
      creatorId,
      // ... other params
    });

    // 4. Save message to database
    const savedMessage = await db.query(
      `INSERT INTO messages (session_id, sender, content, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id`,
      [sessionId, 'user', message]
    );

    const savedAIMessage = await db.query(
      `INSERT INTO messages (session_id, sender, content, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id`,
      [sessionId, 'ai', aiResponse.content]
    );

    // 5. Record token usage (from AI API response)
    await recordTokenUsage({
      userId,
      creatorId,
      sessionId,
      messageId: savedAIMessage.rows[0].id,
      inputTokens: aiResponse.usage.prompt_tokens,
      outputTokens: aiResponse.usage.completion_tokens,
      systemTokens: aiResponse.usage.system_tokens || 0,
      modelUsed: aiResponse.model,
      accessType: access.accessType!
    });

    // 6. Get updated usage stats for response
    const usage = await getUserUsageStats(userId, creatorId, access.accessType!);

    // 7. Return response
    return res.json({
      message: aiResponse.content,
      messageId: savedAIMessage.rows[0].id,
      usage: {
        type: access.accessType,
        percentageUsed: usage.percentageUsed,
        showWarning: usage.percentageUsed >= 80
      }
    });

  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper: Get user's usage stats for display
async function getUserUsageStats(
  userId: string,
  creatorId: string,
  accessType: string
): Promise<{ percentageUsed: number }> {

  if (accessType === 'subscription') {
    const sub = await db.query(
      `SELECT token_limit, tokens_used_this_period
       FROM marketplace_subscriptions
       WHERE user_id = $1 AND status = 'active'
       AND EXISTS (
         SELECT 1 FROM marketplace_listings
         WHERE marketplace_listings.id = marketplace_subscriptions.listing_id
         AND marketplace_listings.creator_id = $2
       )`,
      [userId, creatorId]
    );

    if (sub.rows[0]) {
      const { token_limit, tokens_used_this_period } = sub.rows[0];
      return {
        percentageUsed: Math.round((tokens_used_this_period / token_limit) * 100)
      };
    }
  }

  if (accessType === 'token_pack') {
    // For token packs, show percentage of current pack
    const pack = await db.query(
      `SELECT tokens_purchased, tokens_remaining
       FROM token_packs
       WHERE user_id = $1 AND creator_id = $2 AND tokens_remaining > 0
       ORDER BY purchased_at ASC
       LIMIT 1`,
      [userId, creatorId]
    );

    if (pack.rows[0]) {
      const { tokens_purchased, tokens_remaining } = pack.rows[0];
      const tokensUsed = tokens_purchased - tokens_remaining;
      return {
        percentageUsed: Math.round((tokensUsed / tokens_purchased) * 100)
      };
    }
  }

  if (accessType === 'free') {
    const FREE_LIMIT = 10000;
    const usage = await db.query(
      `SELECT tokens_used_this_period
       FROM user_creator_token_aggregates
       WHERE user_id = $1 AND creator_id = $2
       AND current_period_start = date_trunc('month', NOW())`,
      [userId, creatorId]
    );

    const tokensUsed = parseInt(usage.rows[0]?.tokens_used_this_period || '0');
    return {
      percentageUsed: Math.round((tokensUsed / FREE_LIMIT) * 100)
    };
  }

  return { percentageUsed: 0 };
}
```

---

## 7. FRONTEND UI/UX

### 🎨 User-Facing Displays (CRITICAL: Never show exact tokens)

#### **Chat Interface - Usage Indicator**

```tsx
// frontend/src/components/ChatInterface.tsx

interface UsageIndicator {
  type: 'subscription' | 'token_pack' | 'free';
  percentageUsed: number;
  showWarning: boolean;
}

function ChatUsageBar({ usage }: { usage: UsageIndicator }) {
  // Don't show anything if usage < 50%
  if (usage.percentageUsed < 50) {
    return null;
  }

  // 50-79%: Subtle indicator
  if (usage.percentageUsed < 80) {
    return (
      <div className="text-xs text-gray-500 mt-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${usage.percentageUsed}%` }}
            />
          </div>
          <span>{usage.type === 'subscription' ? 'VIP' : 'Active'}</span>
        </div>
      </div>
    );
  }

  // 80-89%: Yellow warning
  if (usage.percentageUsed < 90) {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mt-3 rounded">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-yellow-800 font-medium">
              You've used most of your {usage.type === 'subscription' ? 'monthly' : 'available'} access
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              {usage.type === 'subscription'
                ? 'Resets next month. Consider upgrading for more access.'
                : 'Buy more tokens to continue chatting.'
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 90%+: Red warning
  return (
    <div className="bg-red-50 border-l-4 border-red-400 p-3 mt-3 rounded">
      <div className="flex items-start gap-2">
        <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-red-800 font-medium">
            Approaching limit
          </p>
          <p className="text-xs text-red-700 mt-1">
            {usage.type === 'subscription'
              ? 'You may lose access until next month. Upgrade to continue.'
              : 'Your token pack is almost empty. Buy more to keep chatting.'
            }
          </p>
          <button className="mt-2 text-xs font-semibold text-red-700 hover:text-red-800">
            {usage.type === 'subscription' ? 'Upgrade Plan →' : 'Buy Tokens →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// In main chat component
function ChatInterface({ creatorUsername }: { creatorUsername: string }) {
  const [messages, setMessages] = useState([]);
  const [usage, setUsage] = useState<UsageIndicator | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  async function sendMessage(content: string) {
    try {
      const response = await fetch(`/api/public/${creatorUsername}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, sessionId })
      });

      if (response.status === 402) {
        // Payment required
        setShowPaywall(true);
        return;
      }

      if (response.status === 429) {
        // Rate limited
        toast.error('Please slow down. Try again in a moment.');
        return;
      }

      const data = await response.json();

      // Update messages
      setMessages([...messages,
        { role: 'user', content },
        { role: 'assistant', content: data.message }
      ]);

      // Update usage indicator
      if (data.usage) {
        setUsage(data.usage);
      }

    } catch (error) {
      console.error('Send error:', error);
      toast.error('Failed to send message');
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {/* Usage indicator - shown after messages */}
        {usage && <ChatUsageBar usage={usage} />}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <MessageInput onSend={sendMessage} />
      </div>

      {/* Paywall modal */}
      {showPaywall && (
        <PaywallModal
          creatorUsername={creatorUsername}
          onClose={() => setShowPaywall(false)}
        />
      )}
    </div>
  );
}
```

#### **Paywall Modal**

```tsx
// frontend/src/components/PaywallModal.tsx

function PaywallModal({ creatorUsername, onClose }: Props) {
  const [tab, setTab] = useState<'subscribe' | 'packs'>('subscribe');

  return (
    <Dialog open onClose={onClose}>
      <div className="max-w-lg mx-auto bg-white rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">
          Continue Chatting with {creatorUsername}
        </h2>

        <p className="text-gray-600 mb-6">
          You've used your free messages this month. Choose an option to continue:
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            className={`flex-1 py-2 px-4 rounded ${
              tab === 'subscribe'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
            onClick={() => setTab('subscribe')}
          >
            💎 Subscribe (Best Value)
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded ${
              tab === 'packs'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
            onClick={() => setTab('packs')}
          >
            💰 Buy Tokens
          </button>
        </div>

        {/* Subscription tab */}
        {tab === 'subscribe' && (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 hover:border-blue-500 cursor-pointer">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg">VIP Access</h3>
                <span className="text-2xl font-bold">$30<span className="text-sm text-gray-500">/mo</span></span>
              </div>

              <ul className="space-y-2 text-sm text-gray-600 mb-4">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Unlimited conversations*
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Save conversation history
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Priority responses
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Cancel anytime
                </li>
              </ul>

              <p className="text-xs text-gray-500 mb-4">
                *Fair use: ~500 conversation turns/month. Most users never reach this.
              </p>

              <button className="w-full bg-blue-500 text-white py-2 rounded font-semibold hover:bg-blue-600">
                Subscribe - $30/month
              </button>
            </div>

            <p className="text-center text-xs text-gray-500">
              Billed monthly. Cancel anytime from your dashboard.
            </p>
          </div>
        )}

        {/* Token packs tab */}
        {tab === 'packs' && (
          <div className="space-y-3">
            <TokenPackOption
              title="Small"
              price={5}
              conversations="~75 conversation turns"
              popular={false}
            />
            <TokenPackOption
              title="Medium"
              price={10}
              conversations="~175 conversation turns"
              popular={true}
            />
            <TokenPackOption
              title="Large"
              price={25}
              conversations="~500 conversation turns"
              popular={false}
              badge="Best Value"
            />

            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
              <p className="text-blue-900">
                <strong>💡 Token packs never expire</strong><br/>
                Use them anytime, across multiple sessions.
              </p>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function TokenPackOption({ title, price, conversations, popular, badge }: Props) {
  return (
    <div className={`border rounded-lg p-4 hover:border-blue-500 cursor-pointer relative ${
      popular ? 'border-blue-500 bg-blue-50' : ''
    }`}>
      {badge && (
        <span className="absolute -top-2 right-4 bg-green-500 text-white text-xs px-2 py-1 rounded">
          {badge}
        </span>
      )}
      {popular && (
        <span className="absolute -top-2 right-4 bg-blue-500 text-white text-xs px-2 py-1 rounded">
          Popular
        </span>
      )}

      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">{title} Pack</h3>
        <span className="text-xl font-bold">${price}</span>
      </div>

      <p className="text-sm text-gray-600 mb-3">{conversations}</p>

      <button className={`w-full py-2 rounded font-semibold ${
        popular
          ? 'bg-blue-500 text-white hover:bg-blue-600'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}>
        Buy ${price} Pack
      </button>
    </div>
  );
}
```

---

#### **Creator Dashboard - Usage Display**

```tsx
// frontend/src/pages/CreatorDashboard.tsx

function CreatorDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchUsageStats();
  }, []);

  async function fetchUsageStats() {
    const response = await fetch('/api/creator/stats');
    const data = await response.json();
    setStats(data);
  }

  if (!stats) return <div>Loading...</div>;

  const { plan, tokenUsage, storageUsage, revenue } = stats;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan: {plan.tier}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            ${plan.price}/month • Renews {plan.renewsAt}
          </p>
          {plan.tier !== 'scale' && (
            <button className="text-blue-500 hover:underline text-sm">
              Upgrade Plan →
            </button>
          )}
        </CardContent>
      </Card>

      {/* Token Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Visual bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Token Usage</span>
                <span className="text-sm font-semibold">
                  {tokenUsage.percentageUsed}%
                </span>
              </div>
              <div className="bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    tokenUsage.percentageUsed >= 90
                      ? 'bg-red-500'
                      : tokenUsage.percentageUsed >= 80
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${tokenUsage.percentageUsed}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{tokenUsage.tokensUsedFormatted}</p>
                <p className="text-xs text-gray-500">Tokens Used</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{tokenUsage.tokensRemainingFormatted}</p>
                <p className="text-xs text-gray-500">Remaining</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{tokenUsage.conversations}</p>
                <p className="text-xs text-gray-500">Conversations</p>
              </div>
            </div>

            {/* Warning */}
            {tokenUsage.percentageUsed >= 80 && (
              <div className={`border-l-4 p-3 rounded ${
                tokenUsage.percentageUsed >= 90
                  ? 'bg-red-50 border-red-400'
                  : 'bg-yellow-50 border-yellow-400'
              }`}>
                <p className={`text-sm font-medium ${
                  tokenUsage.percentageUsed >= 90 ? 'text-red-800' : 'text-yellow-800'
                }`}>
                  {tokenUsage.percentageUsed >= 90
                    ? '⚠️ Critical: Approaching monthly limit'
                    : '⚠️ Warning: High usage this month'
                  }
                </p>
                <p className={`text-xs mt-1 ${
                  tokenUsage.percentageUsed >= 90 ? 'text-red-700' : 'text-yellow-700'
                }`}>
                  {tokenUsage.percentageUsed >= 90
                    ? 'New conversations will be blocked soon. Upgrade now to avoid downtime.'
                    : 'Consider upgrading to the next tier for more capacity.'
                  }
                </p>
                <button className="mt-2 text-sm font-semibold text-blue-600 hover:underline">
                  Upgrade Plan →
                </button>
              </div>
            )}

            <button className="text-sm text-gray-600 hover:underline">
              View detailed usage →
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Storage Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Storage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Visual bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Files & Documents</span>
                <span className="text-sm font-semibold">
                  {storageUsage.usedMB} / {storageUsage.quotaMB} MB
                </span>
              </div>
              <div className="bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    storageUsage.percentageUsed >= 90
                      ? 'bg-red-500'
                      : storageUsage.percentageUsed >= 80
                      ? 'bg-yellow-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${storageUsage.percentageUsed}%` }}
                />
              </div>
            </div>

            {/* Warning */}
            {storageUsage.percentageUsed >= 80 && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                <p className="text-sm font-medium text-yellow-800">
                  ⚠️ Storage running low
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Delete unused files or upgrade your plan.
                </p>
              </div>
            )}

            <button className="text-sm text-blue-600 hover:underline">
              Manage files →
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Revenue (if applicable) */}
      {revenue && (
        <Card>
          <CardHeader>
            <CardTitle>Revenue This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold mb-2">${revenue.total}</p>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <p className="font-semibold">${revenue.subscriptions}</p>
                <p>From subscriptions</p>
              </div>
              <div>
                <p className="font-semibold">${revenue.tokenPacks}</p>
                <p>From token packs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

---

#### **File Management Page**

```tsx
// frontend/src/pages/FileManagement.tsx

function FileManagementPage() {
  const [files, setFiles] = useState([]);
  const [storageUsage, setStorageUsage] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchFiles();
    fetchStorageUsage();
  }, []);

  async function fetchFiles() {
    const response = await fetch('/api/creator/files');
    const data = await response.json();
    setFiles(data.files);
  }

  async function fetchStorageUsage() {
    const response = await fetch('/api/creator/storage');
    const data = await response.json();
    setStorageUsage(data);
  }

  async function handleUpload(file: File) {
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/creator/upload', {
        method: 'POST',
        body: formData
      });

      if (response.status === 413) {
        const data = await response.json();
        toast.error(data.message);
        return;
      }

      await fetchFiles();
      await fetchStorageUsage();
      toast.success('File uploaded');

    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(fileId: string) {
    if (!confirm('Delete this file? This cannot be undone.')) return;

    await fetch(`/api/creator/files/${fileId}`, { method: 'DELETE' });
    await fetchFiles();
    await fetchStorageUsage();
    toast.success('File deleted');
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">File Management</h1>

      {/* Storage overview */}
      {storageUsage && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Storage Usage</h3>
              <span className="text-sm text-gray-600">
                {storageUsage.usedMB} / {storageUsage.quotaMB} MB
              </span>
            </div>
            <div className="bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${storageUsage.percentageUsed}%` }}
              />
            </div>
            {storageUsage.percentageUsed >= 90 && (
              <p className="text-sm text-red-600 mt-2">
                ⚠️ Storage almost full. Delete files or upgrade plan.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <FileUpload
            onUpload={handleUpload}
            disabled={uploading || storageUsage?.percentageUsed >= 100}
          />
          {storageUsage?.percentageUsed >= 100 && (
            <p className="text-sm text-red-600 mt-2">
              Storage full. Delete files before uploading.
            </p>
          )}
        </CardContent>
      </Card>

      {/* File list */}
      <Card>
        <CardHeader>
          <CardTitle>Your Files ({files.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No files uploaded yet
            </p>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <FileIcon type={file.type} />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {file.sizeMB} MB • {file.uploadedAt}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(file.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 8. IMPLEMENTATION CHECKLIST - MVP

### ✅ PHASE 1: Database & Core Logic (Week 1 - 8 hours)

**Day 1-2: Database Setup (3 hours)**
- [ ] Create `token_usage` table
- [ ] Create `creator_token_aggregates` table
- [ ] Create `user_creator_token_aggregates` table
- [ ] Create `token_packs` table
- [ ] Create `rate_limits` table
- [ ] Add token tracking columns to `marketplace_subscriptions`
- [ ] Add creator plan columns to `User` table
- [ ] Run migrations and test

**Day 2-3: Backend Core (5 hours)**
- [ ] Implement `checkTokenAccess()` middleware
- [ ] Implement `recordTokenUsage()` service
- [ ] Implement rate limiting logic
- [ ] Implement creator quota checking
- [ ] Update chat controller to use token system
- [ ] Test token deduction flow
- [ ] Test priority system (subscription → pack → free)

---

### ✅ PHASE 2: Payment & Purchase Flows (Week 1 - 6 hours)

**Day 3-4: Stripe Integration (3 hours)**
- [ ] Create Stripe products for creator plans
- [ ] Implement subscription purchase endpoint (end user → creator)
- [ ] Implement token pack purchase endpoint
- [ ] Handle Stripe webhooks for renewals
- [ ] Test payment flows

**Day 4: Creator Plan Management (3 hours)**
- [ ] Implement creator plan selection/upgrade
- [ ] Create endpoint for plan changes
- [ ] Handle pro-rating for upgrades
- [ ] Test creator subscription flow

---

### ✅ PHASE 3: Frontend - User Facing (Week 2 - 8 hours)

**Day 5: Chat Interface (3 hours)**
- [ ] Add usage indicator component
- [ ] Implement warning banners (80%, 90%)
- [ ] Show graceful degradation messages
- [ ] Test different access types

**Day 6: Paywall Modal (3 hours)**
- [ ] Build subscription tab
- [ ] Build token packs tab
- [ ] Integrate with Stripe checkout
- [ ] Test purchase flows

**Day 7: User Dashboard (2 hours)**
- [ ] Show active subscriptions
- [ ] Show token pack balances
- [ ] Display usage meters (visual, not exact)
- [ ] Test user experience

---

### ✅ PHASE 4: Frontend - Creator Facing (Week 2 - 6 hours)

**Day 7-8: Creator Dashboard (3 hours)**
- [ ] Token usage card with visual meter
- [ ] Storage usage card
- [ ] Warning banners for limits
- [ ] Upgrade prompts
- [ ] Test creator experience

**Day 8: File Management (3 hours)**
- [ ] Build file list page
- [ ] Implement file upload with storage check
- [ ] Implement file deletion
- [ ] Update storage usage after operations
- [ ] Test storage limits

---

### ✅ PHASE 5: Automation & Polish (Week 2-3 - 4 hours)

**Day 9: Cron Jobs (2 hours)**
- [ ] Daily cron: Reset monthly quotas
- [ ] Daily cron: Send usage warning emails (80%+)
- [ ] Test cron execution

**Day 10: Testing & Bug Fixes (2 hours)**
- [ ] End-to-end testing of all flows
- [ ] Fix any bugs found
- [ ] Performance testing (token queries)
- [ ] Security audit (rate limiting, quotas)

---

**TOTAL MVP TIME: ~32 hours (4 work days or 1.5 weeks)**

---

## 9. POST-MVP FEATURES (Month 2-6)

### 🔮 PHASE 6: Advanced Features (Add Later)

#### **Month 2: Analytics & Insights**
```
When to add: When you have 50+ active creators

Features:
- Token usage graphs (daily/weekly/monthly)
- Conversation sentiment analysis
- User retention metrics
- Revenue forecasting
- Export data to CSV

Why later: MVP analytics (basic counts) are enough initially
```

#### **Month 2-3: Email Notifications**
```
When to add: When users request it or miss in-app warnings

Features:
- Email at 80% token usage (user & creator)
- Email at 90% token usage
- Email when quota exhausted
- Weekly usage summary
- Invoice emails

Why later: In-app warnings work fine for MVP
```

#### **Month 3: Advanced Token Management**
```
When to add: When users want more control

Features:
- Token pack gifting (buy for someone else)
- Token pack transfers
- Refund handling
- Usage alerts (custom thresholds)
- Token expiry (if needed)

Why later: Basic token packs sufficient for MVP
```

#### **Month 3-4: Multiple Creator Subscription Tiers**
```
When to add: When 20+ creators request it

Features:
- Creator can offer 3 subscription tiers:
  - Basic: $10/mo, 300K tokens
  - Premium: $30/mo, 1M tokens
  - VIP: $100/mo, 5M tokens
- Custom naming (creator chooses tier names)
- Custom benefits per tier
- Migration between tiers

Why later: One tier is simpler for MVP
```

#### **Month 4: Overage Options**
```
When to add: When users hit limits regularly

Features:
- Auto-purchase additional tokens when limit hit
- "Buy 100 more messages for $5" option
- Soft overage (allow 20% over, bill next month)
- Usage-based pricing tier

Why later: Hard limits + upgrade is simpler
```

#### **Month 4-5: Advanced Integrations**
```
When to add: When Scale tier customers request

Features:
- Webhooks (conversation.created, limit.reached)
- Zapier integration
- Make.com integration
- Slack bot
- Discord bot
- WhatsApp via Twilio
- SMS notifications

Why later: Most creators don't need integrations initially
```

#### **Month 6+: Enterprise Features**
```
When to add: When you have enterprise customers

Features:
- Custom pricing per creator
- Volume discounts
- Annual contracts
- SLA guarantees
- White-label (remove all branding)
- Custom domain
- Dedicated infrastructure
- SSO (Single Sign-On)
- Team collaboration (multiple admins)
- Advanced security (IP whitelisting)

Why later: Small creators don't need enterprise features
```

---

## 10. FLOW DIAGRAMS

### 🔄 Flow 1: User Sends Message (Main Flow)

```
┌─────────────────────────────────────────┐
│  User types message in chat             │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  Frontend sends POST to API             │
│  /api/public/:username/chat             │
│  Body: { message, sessionId }           │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  Backend: checkTokenAccess()            │
│  1. Check rate limiting                 │
│  2. Check creator quota (platform)      │
│  3. Check user access (priority order)  │
└───────────────┬─────────────────────────┘
                │
                ├─────────────────┐
                │                 │
        ❌ NOT ALLOWED    ✅ ALLOWED
                │                 │
                ▼                 ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│  Return error:          │  │  Call AI API            │
│  - 429 (rate limit)     │  │  (OpenAI, Claude, etc)  │
│  - 402 (payment needed) │  └───────────┬─────────────┘
│  - 403 (creator limit)  │              │
└─────────────────────────┘              ▼
                          ┌──────────────────────────────┐
                          │  AI responds with:           │
                          │  - Message content           │
                          │  - Token usage:              │
                          │    • input_tokens: 150       │
                          │    • output_tokens: 500      │
                          │    • total: 650              │
                          └──────────────┬───────────────┘
                                         │
                                         ▼
                          ┌──────────────────────────────┐
                          │  Save messages to DB         │
                          │  - User message              │
                          │  - AI response               │
                          └──────────────┬───────────────┘
                                         │
                                         ▼
                          ┌──────────────────────────────┐
                          │  recordTokenUsage()          │
                          │  1. Insert into token_usage  │
                          │  2. Update creator aggregate │
                          │  3. Deduct from user access: │
                          │     - Subscription, OR       │
                          │     - Token pack, OR         │
                          │     - Free tier              │
                          │  4. Check for warnings       │
                          └──────────────┬───────────────┘
                                         │
                                         ▼
                          ┌──────────────────────────────┐
                          │  Return response:            │
                          │  {                           │
                          │    message: "...",           │
                          │    usage: {                  │
                          │      type: 'subscription',   │
                          │      percentageUsed: 65,     │
                          │      showWarning: false      │
                          │    }                         │
                          │  }                           │
                          └──────────────┬───────────────┘
                                         │
                                         ▼
                          ┌──────────────────────────────┐
                          │  Frontend displays:          │
                          │  - AI message                │
                          │  - Usage indicator (if >50%) │
                          │  - Warning banner (if >80%)  │
                          └──────────────────────────────┘
```

---

### 🔄 Flow 2: User Hits Free Tier Limit

```
User (free tier) sends message
         │
         ▼
checkTokenAccess()
         │
         ├─── Check subscription: ❌ None
         │
         ├─── Check token packs: ❌ None
         │
         └─── Check free tier:
              Current usage: 9,800 tokens
              Limit: 10,000 tokens
              Message needs: ~700 tokens
              Remaining: 200 tokens
              ❌ NOT ENOUGH
         │
         ▼
Return 402 Payment Required
{
  error: "Payment required",
  message: "You've used your free messages this month",
  needsPayment: true
}
         │
         ▼
Frontend shows PaywallModal
┌─────────────────────────────────────────┐
│  🔒 Continue Chatting                   │
├─────────────────────────────────────────┤
│  You've used your free messages         │
│  this month.                            │
│                                         │
│  [ Subscribe ]  [ Buy Token Pack ]     │
│                                         │
│  💎 Subscribe ($30/mo)                  │
│  Unlimited conversations + benefits     │
│  [Subscribe →]                          │
│                                         │
│  💰 Buy Token Pack ($10)                │
│  ~175 more conversations                │
│  [Buy Pack →]                           │
└─────────────────────────────────────────┘
         │
         ├────────┬────────┐
         │        │        │
      Subscribe  Buy Pack Wait
         │        │        │
         ▼        ▼        ▼
    Stripe    Stripe   Next month
   (recurring) (one-time)  reset
```

---

### 🔄 Flow 3: User with Subscription Hits Limit

```
User (VIP subscriber) sends message
Current usage: 990,000 / 1,000,000 tokens
Message needs: ~700 tokens
         │
         ▼
checkTokenAccess()
         │
         └─── Check subscription:
              Status: active ✅
              Tokens used: 990,000
              Token limit: 1,000,000
              Remaining: 10,000
              Message needs: 700
              ✅ ENOUGH (but warning threshold)
         │
         ▼
Allow message + return warning
{
  allowed: true,
  accessType: 'subscription',
  tokensAvailable: 10,000,
  showWarning: true
}
         │
         ▼
Frontend shows warning banner
┌─────────────────────────────────────────┐
│  ⚠️ Usage Notice                        │
│  You've used your subscription heavily  │
│  this month (~99% used).                │
│                                         │
│  Resets in 5 days (March 1)             │
│  [Got it]                               │
└─────────────────────────────────────────┘
         │
         │ (User continues chatting)
         │
         ▼
User sends another message (usage now: 990,700)
         │
         ▼
[Several more messages...]
         │
         ▼
Usage reaches: 1,000,700 / 1,000,000 (100%)
         │
         ▼
checkTokenAccess()
         │
         └─── Check subscription:
              Tokens used: 1,000,700
              Token limit: 1,000,000
              ❌ EXHAUSTED
         │
         ├─── Check token packs:
         │    ✅ Found! 50,000 tokens remaining
         │
         └─── Use token pack instead
              {
                allowed: true,
                accessType: 'token_pack',
                tokensAvailable: 50,000
              }
         │
         ▼
Frontend shows notification
┌─────────────────────────────────────────┐
│  ℹ️ Switched to Token Pack              │
│  You've reached your monthly limit.     │
│  Now using your token pack (50K tokens) │
│  [Got it]                               │
└─────────────────────────────────────────┘
```

---

### 🔄 Flow 4: Creator Hits Platform Quota

```
Creator (Starter plan) has busy month
Current usage: 4.9M / 5M tokens
         │
         ▼
Any user sends message to this creator
         │
         ▼
checkTokenAccess()
         │
         └─── Check creator quota:
              Plan: Starter
              Quota: 5,000,000 tokens
              Used: 4,900,000 tokens
              Remaining: 100,000
              Message needs: ~700 tokens
              ✅ OK (but at 98% - warning sent)
         │
         ▼
[Email sent to creator]
Subject: ⚠️ You're at 98% of monthly limit
         │
         │ (Creator continues, few more messages)
         │
         ▼
Usage reaches: 5,000,000 / 5,000,000 (100%)
         │
         ▼
Soft overage: Allow up to 20% = 6,000,000 tokens
         │
         │ (20,000 more tokens used)
         │
         ▼
Usage reaches: 5,200,000 / 5,000,000 (104%)
Still within overage, allow
         │
         ▼
[Email sent to creator]
Subject: 🚨 You've exceeded your monthly limit
Body: You're at 104% usage. Please upgrade.
         │
         │ (More usage...)
         │
         ▼
Usage reaches: 6,000,000 / 5,000,000 (120%)
Hard limit reached
         │
         ▼
checkCreatorQuota()
         │
         └─── Used: 6,000,000
              Max allowed (with overage): 6,000,000
              ❌ LIMIT REACHED
         │
         ▼
Return 403 Forbidden
{
  allowed: false,
  reason: "Creator has exceeded their monthly token quota"
}
         │
         ▼
Frontend shows to end user:
┌─────────────────────────────────────────┐
│  🚫 Temporarily Unavailable             │
│                                         │
│  This creator has reached their         │
│  monthly limit. Please try again later. │
│                                         │
│  [Got it]                               │
└─────────────────────────────────────────┘
         │
         │
Frontend shows to creator in dashboard:
┌─────────────────────────────────────────┐
│  🚨 CRITICAL: Monthly Limit Exceeded    │
│                                         │
│  Your avatar is currently unavailable.  │
│  You've used 6M / 5M tokens (120%).     │
│                                         │
│  New conversations are blocked.         │
│                                         │
│  Options:                               │
│  1. Upgrade to Growth (25M tokens)      │
│  2. Wait until March 1 for reset        │
│                                         │
│  [Upgrade Now]  [Contact Support]       │
└─────────────────────────────────────────┘
```

---

### 🔄 Flow 5: User Purchases Token Pack

```
User clicks "Buy Token Pack" in paywall
         │
         ▼
Select pack size:
[ ] Small ($5 - ~75 turns)
[✓] Medium ($10 - ~175 turns)  ← Selected
[ ] Large ($25 - ~500 turns)
         │
         ▼
Click "Buy $10 Pack"
         │
         ▼
Frontend → POST /api/token-packs/purchase
{
  creatorId: "...",
  packSize: "medium",
  amount: 1000 // cents
}
         │
         ▼
Backend creates Stripe Checkout Session
         │
         ▼
User redirected to Stripe payment page
         │
         │ (User completes payment)
         │
         ▼
Stripe sends webhook: checkout.session.completed
         │
         ▼
Backend webhook handler:
1. Verify webhook signature
2. Extract session data
3. Insert into token_packs table:
   {
     user_id: "...",
     creator_id: "...",
     tokens_purchased: 350,000,
     tokens_remaining: 350,000,
     amount_paid_cents: 1000,
     stripe_payment_intent_id: "..."
   }
         │
         ▼
User redirected back to chat
         │
         ▼
Modal shows success:
┌─────────────────────────────────────────┐
│  ✅ Token Pack Purchased!               │
│                                         │
│  You now have ~175 conversation turns   │
│  available. Continue chatting!          │
│                                         │
│  [Start Chatting →]                     │
└─────────────────────────────────────────┘
         │
         ▼
User sends message
         │
         ▼
checkTokenAccess()
         │
         └─── Check subscription: ❌ None
         └─── Check token packs: ✅ Found!
              tokens_remaining: 350,000
              Message needs: ~700
              ✅ ENOUGH
         │
         ▼
Allow message, deduct from token pack
tokens_remaining: 350,000 - 700 = 349,300
         │
         ▼
User continues chatting...
(each message deducts from pack)
         │
         │ (After many conversations)
         │
         ▼
tokens_remaining: 10,500
         │
         ▼
User sends message
         │
         ▼
Frontend shows warning:
┌─────────────────────────────────────────┐
│  ⚠️ Token pack running low              │
│  You have ~15 conversation turns left.  │
│  Buy another pack to keep chatting.     │
│                                         │
│  [Buy More]  [Later]                    │
└─────────────────────────────────────────┘
```

---

### 🔄 Flow 6: Creator Upgrades Plan

```
Creator (on Starter) views dashboard
Current usage: 4.2M / 5M tokens (84%)
         │
         ▼
Sees warning:
┌─────────────────────────────────────────┐
│  ⚠️ Approaching limit (84% used)        │
│  Upgrade to Growth for 5x more tokens   │
│  [Upgrade Plan →]                       │
└─────────────────────────────────────────┘
         │
         ▼
Clicks "Upgrade Plan"
         │
         ▼
Redirected to /settings/billing
         │
         ▼
Shows current plan + upgrade options:
┌─────────────────────────────────────────┐
│  Current: Starter ($15/mo)              │
│  • 5M tokens/month                      │
│  • 1 GB storage                         │
│  • Basic features                       │
│                                         │
│  ─────────────────────                  │
│                                         │
│  ⬆️ Upgrade to Growth ($60/mo)          │
│  • 25M tokens/month (5x more)           │
│  • 10 GB storage (10x more)             │
│  • Voice cloning                        │
│  • Advanced analytics                   │
│  • Priority listing                     │
│                                         │
│  [Upgrade to Growth →]                  │
└─────────────────────────────────────────┘
         │
         ▼
Clicks "Upgrade to Growth"
         │
         ▼
Backend:
1. Calculate prorated amount
   - Current period: Feb 10 - Mar 10
   - Days remaining: 18 days
   - Prorated Starter refund: ($15 / 30) * 18 = $9
   - Prorated Growth charge: ($60 / 30) * 18 = $36
   - Net charge today: $36 - $9 = $27
         │
         ▼
Show confirmation:
┌─────────────────────────────────────────┐
│  Confirm Upgrade                        │
│                                         │
│  Plan: Starter → Growth                 │
│  New price: $60/month                   │
│  Charge today: $27 (prorated)           │
│  Next billing: March 10 ($60)           │
│                                         │
│  Benefits:                              │
│  ✅ Immediate access to 25M tokens      │
│  ✅ Storage increased to 10 GB          │
│  ✅ Voice cloning unlocked              │
│                                         │
│  [Confirm Upgrade] [Cancel]             │
└─────────────────────────────────────────┘
         │
         ▼
User confirms
         │
         ▼
Backend:
1. Charge $27 via Stripe
2. Update Stripe subscription to Growth plan
3. Update database:
   UPDATE "User"
   SET plan_tier = 'growth',
       plan_token_quota = 25000000,
       plan_storage_mb = 10240
   WHERE id = creator_id
         │
         ▼
Show success:
┌─────────────────────────────────────────┐
│  ✅ Upgraded to Growth!                 │
│                                         │
│  Your new limits are now active:        │
│  • 25M tokens/month                     │
│  • 10 GB storage                        │
│  • Voice cloning enabled                │
│                                         │
│  [Go to Dashboard]                      │
└─────────────────────────────────────────┘
         │
         ▼
Dashboard now shows:
┌─────────────────────────────────────────┐
│  Current Plan: Growth                   │
│  $60/month • Renews March 10            │
│                                         │
│  Token Usage:                           │
│  ████░░░░░░ 17% (4.2M / 25M)           │
│  ✅ Plenty of capacity!                 │
│                                         │
│  Storage:                               │
│  ██░░░░░░░░ 10% (1GB / 10GB)           │
└─────────────────────────────────────────┘
```

---

## 🎯 FINAL SUMMARY

### ✅ WHAT WE'RE DOING (MVP)

**Core Token System:**
- Backend tracks actual token usage (input + output + system)
- Frontend shows usage as percentage/visual bars (NOT exact tokens)
- Three-tier access: Subscription → Token Pack → Free
- Clear priority: Better access always used first

**Creator Plans:**
- 4 tiers: Free, Starter ($15), Growth ($60), Scale ($175)
- Differentiated by: Storage (hard limit) + Token quota (soft limit) + Features + Support
- Simple upgrade path

**End User Pricing:**
- Free: 10K tokens/month (~3-10 turns)
- Subscription: $X/month, Y tokens (creator sets)
- Token Packs: One-time purchase, never expire
- No confusing credits or 24h limits

**Security & Limits:**
- Rate limiting (prevents spam)
- Creator quotas (platform level)
- User quotas (per subscription/pack)
- Graceful warnings at 80%/90%
- Soft blocks with overage allowance

**Essential Features:**
- File management (upload + delete)
- Storage quota enforcement
- Token usage tracking
- Payment flows (Stripe)
- Basic analytics (usage percentages)

---

### ❌ WHAT WE'RE SKIPPING (Post-MVP)

**Phase 2+ (Month 2-6):**
- Advanced analytics dashboard
- Email notifications (in-app warnings enough)
- Token-based refunds/transfers
- Multiple creator subscription tiers
- Overage billing
- Advanced integrations (webhooks, Zapier)
- Auto-cleanup jobs
- Enterprise features (SSO, white-label)

---

### 🚀 IMPLEMENTATION ORDER

**Week 1:** Database + Backend Core (14 hours)
- Tables, middleware, token logic, payments

**Week 2:** Frontend (14 hours)
- Chat UI, paywall, dashboards, file management

**Week 3:** Polish (4 hours)
- Cron jobs, testing, bug fixes

**Total: ~32 hours (4 work days or 1.5 weeks)**

---

### 📊 KEY METRICS TO TRACK

**For Platform:**
- Total tokens consumed (cost monitoring)
- Average tokens per conversation
- Creator plan distribution
- Revenue per plan tier
- Upgrade rate (Free → Paid)

**For Creators:**
- Token usage % (warn at 80%)
- Storage usage % (warn at 80%)
- Total conversations
- Revenue (subscriptions + packs)

**For End Users:**
- Subscription status
- Token pack balance
- Usage percentage (visual only)
- Days until renewal

---

### 💡 CRITICAL DESIGN PRINCIPLES

1. **Backend = Precise, Frontend = Approximate**
   - Backend tracks exact tokens
   - Frontend shows "~75 conversation turns" not "350,000 tokens"

2. **Soft Limits > Hard Blocks**
   - Warn at 80%, 90%
   - Allow 10-20% overage
   - Only hard block when absolutely necessary

3. **Graceful Degradation**
   - Subscription exhausted? → Fall back to token packs
   - Token packs empty? → Fall back to free tier
   - Free tier exhausted? → Show paywall (not error)

4. **Never Surprise Users**
   - Always show warnings before blocking
   - Clear upgrade paths
   - No hidden fees or sudden charges

5. **Optimize for Creator Success**
   - Don't block their avatars unnecessarily
   - Give ample warning before limits
   - Make upgrades easy and beneficial

---

**Last Updated:** 2026-02-10
**Status:** ✅ FINAL - Ready for Implementation
**Next Step:** Start with Phase 1 (Database + Backend Core)

---

**Go ship it! 🚀**
