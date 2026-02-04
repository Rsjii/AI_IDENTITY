# SELFLYX — MASTER PLATFORM PLAN

## Complete Architecture, Flow & Execution Guide

**Reference docs:** ALL_ACTUAL_PHASE_1.md (requirements), CHAT_FINAL_FLOW_IMPLEMENT.md (chat UI specifics)
**This document supersedes** the planning/architecture sections of both above docs.
**What this does NOT change:** The chat UI layout fixes described in CHAT_FINAL_FLOW_IMPLEMENT.md (scrolling, share buttons, guest panel, suggested Q chips, etc.) still apply as-is.

---

## 0. THE 8 ISSUES — SUMMARY

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | Any `/@xyz` or `/chat/xyz` opens even if creator doesn't exist | Frontend fetches creator data but never checks for null — uses slug as fallback name forever | Handle 404 response → show "Creator not found" page |
| 2 | Payment flow unclear — subscription vs pay-per-chat? | Only pay-per-chat exists. No subscription option. PaymentPrompt is email+tier only. | Add subscription as second option in same paywall. Hybrid model. |
| 3 | Chat is disconnected from the rest of the website. End users forced through creator onboarding | ProfileCompletionGuard blocks all routes until `onboardingStep = done`. End users have no separate path. | Introduce `userType`. Visitors skip onboarding entirely. |
| 4 | Can't click creator name to see their profile | Creator name in chat header is a plain `<div>`, not a link | Make it clickable → opens creator profile as a modal |
| 5 | No way for end users to discover creators on the website | No page exists for this | Add `/explore` page (directory, not marketplace) + "Meet the AIs" section on landing page |
| 6 | End user can't see all their conversation history | `/conversations` route is creator-facing (shows chats WITH your AI). No end-user facing history page. | New `/my-chats` page showing all user's conversations across all creators |
| 7 | What should creator see — full chats or just stats? | Not decided | Phase 1: full conversations visible to creator + transparency notice to end users. Phase 2: privacy toggle. |
| 8 | What else to add? | — | End user profile page, explore page, subscription management, notification basics, daily free limit reset |

---

## 1. THE CORE FIX: TWO USER TYPES

### Why everything breaks right now

The single biggest architectural problem: **the platform treats every logged-in user as a creator.** The signup flow is:

```
signup → verify OTP → profile → onboarding (quiz → content → voice → plan → deploy) → dashboard
```

This is correct for someone who wants to BUILD an AI. It is completely wrong for someone who just wants to CHAT with an AI.

When a visitor hits the paywall on `/chat/john-doe` and decides to login to save their history, they get forced through the entire creator onboarding. They don't want to upload content or pick a $49/month plan. They just want to get back to chatting.

### The fix: `userType`

Add a single field to the User table: `userType` — either `'creator'` or `'visitor'`.

```
┌───────────────────────────────────────────────────────┐
│                 SELFLYX USERS                          │
│                                                       │
│   CREATOR                          VISITOR            │
│   (builds an AI)                   (uses AIs)         │
│                                                       │
│   Signup → Profile →               Signup →           │
│   Onboarding (5 steps) →           Quick Profile →    │
│   Dashboard                        Done               │
│                                                       │
│   Pays Selflyx: $49-99/mo          Pays creators:     │
│   (platform subscription)          $5-25 per chat     │
│                                    or $9.99/mo sub    │
│                                                       │
│   Gets: dashboard, AI training,    Gets: chat access, │
│   analytics, embed widget,         saved history,     │
│   revenue payouts                  subscription mgmt  │
│                                                       │
│   Can ALSO chat with other         Can UPGRADE to     │
│   creators' AIs (as visitor)       creator later      │
└───────────────────────────────────────────────────────┘
```

**Both types can coexist.** A creator can also chat with other AIs (visitor behavior). A visitor can upgrade to creator later if they want to build their own AI. The system just needs to know which onboarding path to show.

---

## 2. BUG: INVALID ROUTE → 404

### Current broken behavior (confirmed in code)

```javascript
// PublicChatPage.tsx — current code
useEffect(() => {
  fetch(`/api/public/creator/${encodeURIComponent(slug)}`)
    .then((r) => r.json())
    .then((d) => setCreator(d.creator || null))  // ← sets null if not found
    .catch(() => setCreator(null));              // ← also sets null on error
}, [slug]);

// Later in render:
<div>{creator?.displayName || slug}</div>  // ← just shows the slug text, no 404
```

If you visit `/chat/nonexistent-person` the page renders with "nonexistent-person" as the creator name. No error. No redirect. Looks broken.

Same issue with `/@random-handle` — CreatorPublicProfile has the same pattern.

### How it should work

```
User visits /chat/xyz or /@xyz
        ↓
Frontend: GET /api/public/creator/:slug
        ↓                           ↓
   200 → creator data           404 → null
        ↓                           ↓
  Show chat page            Show "Not Found" screen:
                            ┌──────────────────────┐
                            │  Creator not found   │
                            │                      │
                            │  The AI you're       │
                            │  looking for doesn't │
                            │  exist or has been   │
                            │  removed.            │
                            │                      │
                            │  [Explore AIs →]     │
                            │  [Go Home]           │
                            └──────────────────────┘
```

### Implementation detail

- Add a `loading` state: while fetching, show a skeleton/spinner (not the full chat UI)
- Add a `notFound` state: if response is 404 OR `creator === null` after fetch → render NotFound component
- The NotFound component: simple message + two buttons → `/explore` and `/`
- Same logic applies to `/@:handle` on CreatorPublicProfile

---

## 3. AUTH FLOW: THE FORK (Creator vs Visitor)

### Current flow (broken for visitors)

```
Any signup → verify OTP → /signup/profile
        ↓
ProfileCompletionGuard checks: profileCompleted === false
        ↓
Redirects to /auth (which redirects to /signup/profile)
        ↓
Profile done → onboardingStep = 'quiz' (not 'done')
        ↓
ProfileCompletionGuard still blocks → forces /onboarding
        ↓
quiz → content → voice → plan → deploy → done
        ↓
FINALLY gets access to the rest of the app
```

A visitor who just wanted to save their chat has to go through all 5 onboarding steps. There's no way out.

### Fixed flow: The Fork Screen

After email verify + basic profile (name only), show ONE screen:

```
┌────────────────────────────────────────┐
│                                        │
│   Welcome to Selflyx!                  │
│   What would you like to do?           │
│                                        │
│   ┌─── Option A ──────────────────┐    │
│   │  🤖  Create my own AI         │    │  → Creator path
│   │                               │    │
│   │  Build an AI version of       │    │
│   │  yourself. Earn money while   │    │
│   │  you sleep.                   │    │
│   └───────────────────────────────┘    │
│                                        │
│   ┌─── Option B ──────────────────┐    │
│   │  💬  Chat with AI             │    │  → Visitor path
│   │                               │    │
│   │  Chat with creators and       │    │
│   │  save your conversations.     │    │
│   └───────────────────────────────┘    │
│                                        │
│   (You can always do both later)       │
│                                        │
└────────────────────────────────────────┘
```

### Smart auto-selection

If the user came from `/chat/:slug` (they were chatting and clicked "Login to save"), the `next` URL param is preserved. In this case:
- **Auto-select Option B** (Visitor). Don't even show the fork screen.
- After quick profile → redirect BACK to `/chat/:slug`
- Auto-claim the session (link it to the new account)

Detection: check `next` param or `localStorage.getItem('pending_chat_slug')` set before redirect to `/auth`.

### Creator path (unchanged)

```
Profile (name, handle, bio, avatar)
  → /onboarding/quiz (what do you do?)
  → /onboarding/content (upload knowledge base)
  → /onboarding/voice (optional, skip for now)
  → /onboarding/plan (pick $49 Starter or $99 Pro)
  → /onboarding/deploy (get embed code, test)
  → /dashboard
```

### Visitor path (NEW — very short)

```
Quick profile (just name + avatar upload)
  → Done. Redirect to next param OR /explore
  → If came from /chat/:slug → auto-claim session → back to chatting
```

That's it. 30 seconds. No quiz. No content upload. No plan selection.

### ProfileCompletionGuard changes

The guard needs to know user type:

```
IF user has no userType set → redirect to fork screen (/choose-type)
IF userType = 'creator' AND onboardingStep ≠ 'done' → redirect to /onboarding
IF userType = 'visitor' AND basic profile done → ALLOW everything
IF userType = 'creator' AND onboardingStep = 'done' → ALLOW everything
```

### Visitor → Creator upgrade

At any point, a visitor can click "Create my own AI" (on /explore page, in their profile, etc.). This triggers:
- Set userType = 'creator'
- Start onboarding from quiz step
- After onboarding done, they have BOTH: their own dashboard AND their chat history

---

## 4. PAYMENT FLOW: COMPLETE ARCHITECTURE

### 4.1 The two models side by side

| | Pay-Per-Chat | Subscription |
|---|---|---|
| **What it is** | One-time payment for 24h unlimited access | Monthly recurring payment for permanent unlimited access |
| **Requires login?** | NO (just email for receipt) | YES (account needed to track subscription) |
| **Price** | $5 / $10 / $25 (creator sets tiers) | $9.99/month (or whatever creator sets) |
| **Duration** | 24 hours from payment | Forever (until cancelled) |
| **Best for** | New visitors, casual one-time chatters | People who like a creator and chat regularly |
| **Already exists?** | YES — fully built | NO — needs to be built |

**Recommendation: Show BOTH options in the paywall.** Let the end user choose. This is the "hybrid model" — proven to maximize conversion (more options = someone finds one they like).

The creator controls which options appear: pay-per-chat only, subscription only, or both (default recommendation).

### 4.2 Creator configures monetization

In Dashboard → Settings → Monetization:

```
┌──────────────────────────────────────────────┐
│  💰  Monetization                            │
│                                              │
│  Free messages before paywall:  [ 3  ▼ ]     │
│  (Resets every 24 hours)                     │
│                                              │
│  ── Pay-Per-Chat ──────────────────────────  │
│  [✓] Show pay-per-chat option                │
│  Tiers:  [ $5 ]  [ $10 ]  [ $25 ]           │
│  Unlock window: 24 hours                     │
│                                              │
│  ── Monthly Subscription ──────────────────  │
│  [✓] Show subscription option                │
│  Price: [ $9.99 ] per month                  │
│  (Visitors pay this for unlimited access)    │
│                                              │
│  ── Revenue ─────────────────────────────    │
│  Your take: 75%  |  Platform fee: 25%        │
│  Active subscribers: 12                      │
│  This month's revenue: $119.88               │
└──────────────────────────────────────────────┘
```

This is stored in the existing `priceConfig` JSONB column on the User table. Current structure already has `payPerChatTiers`. Add:
```
priceConfig: {
  payPerChatTiers: [500, 1000, 2500],     // existing
  freeMessageLimit: 3,                     // existing (or default)
  subscriptionEnabled: true,               // NEW
  subscriptionPriceCents: 999,             // NEW
  payPerChatEnabled: true,                 // NEW (default true)
}
```

### 4.3 The end user paywall — what they see

When free messages run out:

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  [AI] Great question! The key to getting         │
│       started is first understanding your        │
│       ████████████████████████████████           │ ← blurred/masked
│       ██████████████████████                     │
│                                                  │
│  ─────────────────────────────────────────────   │
│  🔒  Your 3 free messages are used up            │
│                                                  │
│  ┌── Quick Access ─────────────────────────┐     │
│  │  💳  $5  →  Chat for 24 hours          │     │  ← pay-per-chat (existing)
│  │  💳  $10 →  Chat for 24 hours          │     │
│  │  💳  $25 →  Chat for 24 hours          │     │
│  └─────────────────────────────────────────┘     │
│                                                  │
│  ┌── Better Value ─────────────────────────┐     │
│  │  ⭐  $9.99 / month                      │     │  ← subscription (NEW)
│  │      Unlimited chats, forever           │     │
│  │      Cancel anytime                     │     │
│  │      ⚠ Requires account                 │     │
│  └─────────────────────────────────────────┘     │
│                                                  │
│  Already have an account?                        │
│  [Login to check your subscription]              │
│                                                  │
└──────────────────────────────────────────────────┘
```

If creator enabled ONLY pay-per-chat → show only "Quick Access" section.
If creator enabled ONLY subscription → show only "Better Value" section.
If both enabled → show both (recommended default).

### 4.4 Pay-per-chat flow (enhancement to existing)

Current flow works. Two small additions needed:
1. The free limit should reset every 24 hours (the `freeResetAt` column on `chat_sessions` already exists — just needs to be used)
2. After 24h premium window expires, free limit resets again (so user gets 3 free messages next day, not immediate paywall)

```
Day 1:
  Messages 1-3: Free ✓
  Message 4: Paywall → User pays $5
  Messages 4-N: Unlimited for 24h ✓

Day 2 (after 24h):
  Free limit resets (freeResetAt updated)
  Messages 1-3: Free again ✓
  Message 4: Paywall again
  → Pay again OR subscribe this time
```

This is better UX than "paywall forever after 3 messages." Casual users get to try again each day.

### 4.5 Subscription flow (NEW — complete sequence)

```
END USER clicks "$9.99/month — Unlimited"
        ↓
┌── Is user logged in? ──┐
│                         │
NO                       YES
│                         │
↓                         ↓
Show modal:              Continue to payment
"Subscription needs       ↓
 an account"             POST /api/payments/subscription/create
[Login] [Sign Up]        { creatorId, userId, priceCents: 999 }
  ↓                       ↓
  After login:           Backend:
  come back here         - Get/create Stripe Customer for this user
  ↓                      - Get/create Stripe Price for this creator
                         - Create Stripe Subscription (recurring monthly)
                         - Return clientSecret for first payment
                           ↓
                         Stripe.js Payment Element renders
                           ↓
                         User enters card
                           ↓
                         Payment succeeds
                           ↓
                         Backend:
                         - Save to end_user_subscriptions table
                         - Unlock current teaser message
                         - Return success
                           ↓
                         Frontend:
                         - Shows "🎉 You're subscribed!"
                         - Unlocks the blurred message
                         - Shows "⭐ Subscribed" badge in header
                           ↓
                         From now on:
                         - Every visit to this creator's chat
                         - Backend checks: active subscription?
                         - YES → no paywall, ever
```

### 4.6 Subscription management (end user side)

From `/my-profile` → Subscriptions tab:

```
┌────────────────────────────────────────┐
│  ⭐  My Subscriptions                  │
│                                        │
│  ┌── John Doe's AI ──────────────┐     │
│  │  Status:  ✅ Active           │     │
│  │  Price:   $9.99 / month       │     │
│  │  Started: Jan 15, 2026       │     │
│  │  Renews:  Feb 15, 2026       │     │
│  │  [Cancel]                     │     │
│  └───────────────────────────────┘     │
│                                        │
│  ┌── Yoga with Sarah ────────────┐     │
│  │  Status:  ✅ Active           │     │
│  │  Price:   $14.99 / month      │     │
│  │  Started: Jan 20, 2026       │     │
│  │  Renews:  Feb 20, 2026       │     │
│  │  [Cancel]                     │     │
│  └───────────────────────────────┘     │
│                                        │
│  Total monthly: $24.98                 │
└────────────────────────────────────────┘
```

Cancel = sets `cancelAtPeriodEnd = true` on Stripe subscription. Access continues until period ends, then subscription status → 'cancelled'.

### 4.7 Payout to creators (Stripe Connect)

```
End user pays $10 (any method)
        ↓
Selflyx collects via Stripe on platform account
        ↓
Split:
  ├── 25% platform fee ($2.50) → Selflyx
  └── 75% creator earning ($7.50) → Creator's Stripe Connect account
        ↓
Weekly automatic transfer to creator's bank account
```

Creator connects Stripe in Dashboard → Settings → Payouts:
```
┌────────────────────────────────────────┐
│  💳  Payout Settings                   │
│                                        │
│  Status: ❌ Not connected              │
│  [Connect Stripe Account →]            │
│                                        │
│  Once connected:                       │
│  - Earnings transfer every Monday      │
│  - You keep 75% of all payments        │
│  - Track payouts in Revenue tab        │
│                                        │
│  Note: Stripe Connect setup takes      │
│  about 2 minutes.                      │
└────────────────────────────────────────┘
```

Use Stripe Connect "Express Accounts" — simplest setup. Stripe handles onboarding the creator (identity verification, bank account).

### 4.8 Razorpay (India)

For users in India, show Razorpay instead of Stripe:
- Supports UPI, Cards, NetBanking, Wallets
- Same flow structure: create order → pay → verify webhook
- Auto-detect by user IP/location: India → Razorpay, rest of world → Stripe
- Creator connects Razorpay account separately for Indian payouts
- For MVP Phase 1: just use Stripe globally. Add Razorpay in Phase 2 when targeting Indian market specifically.

---

## 5. END USER COMPLETE JOURNEY

This is the full story, start to finish, from a visitor's perspective:

```
PHASE A: DISCOVERY
═══════════════════

1. A creator (John Doe) shares their link on Twitter:
   "Chat with my AI → selflyx.com/chat/john-doe"

2. A random person (Priya) clicks the link.

3. Lands on /chat/john-doe
   Sees immediately (no login needed):
   - John's avatar + name + short bio
   - A welcome message: "Hey! I'm John's AI. Ask me anything about business."
   - 3 suggested question chips:
     • "How do I start a business?"
     • "What's the best marketing strategy?"
     • "Can you help with my pitch?"

PHASE B: FIRST CHAT (Free)
═══════════════════════════

4. Priya clicks "How do I start a business?"
   - Input auto-fills with the question
   - She hits send

5. Typing indicator shows (bouncing dots, 1-3 seconds)

6. AI reply appears:
   "Great question! Starting a business requires..."
   - Hover actions: [Copy] [👍] [👎] [Regenerate]

7. After the AI reply, 2 suggested follow-ups appear below:
   • "What about funding?"
   • "How long does it take?"
   (Disappear the moment Priya starts typing)

8. This repeats for messages 2 and 3. Free. No friction.

PHASE C: THE PAYWALL
═════════════════════

9. Priya types message #4.

10. AI generates a full answer, but returns a TEASER:
    - First 30% of the answer is visible
    - Rest is blurred/masked
    - Paywall options appear (see Section 4.3 above)

PHASE D: PAYMENT DECISION
══════════════════════════

Priya has 3 choices:

  Choice 1: Pay $5 for 24h access
    → Enters email (for receipt)
    → Enters card (Stripe, embedded — no redirect)
    → Payment succeeds
    → Full answer appears
    → "Premium active — expires in 24h" banner
    → Can chat unlimited for 24 hours
    → No account needed

  Choice 2: Subscribe for $9.99/month
    → System says "Subscription needs an account"
    → Priya creates an account (email + password + name)
    → Account created → session auto-claimed
    → Stripe subscription created → first month charged
    → Full answer appears
    → "⭐ Subscribed to John's AI" badge
    → Unlimited chats forever (until cancel)

  Choice 3: Close tab / come back later
    → Conversation saved by visitorId (cookie, 30 days)
    → If she returns within 30 days: previous messages still there
    → Free limit resets after 24h (can try 3 more free messages)

PHASE E: RETURNING
═══════════════════

Scenario A: Priya paid $5 (no account)
  → Returns next day: free limit reset, gets 3 free messages again
  → If she wants more: paywall shows again
  → Eventually she might subscribe for convenience

Scenario B: Priya subscribed (has account)
  → Returns anytime: logs in, goes to /chat/john-doe
  → No paywall. Unlimited messages. "⭐ Subscribed" badge.
  → Can also visit her other conversations in /my-chats

Scenario C: Priya just wants to browse
  → Goes to /explore
  → Sees other creators
  → Starts new chats with them
  → Each creator has their own free limit and pricing
```

---

## 6. CREATOR COMPLETE JOURNEY

```
PHASE A: SIGNUP & SETUP
════════════════════════

1. Creator visits selflyx.com → sees landing page

2. Clicks "Create your AI" → /auth (signup)

3. Email + password + verify OTP

4. Fork screen: chooses "Create my own AI"
   → userType = 'creator'

5. Profile: name, handle (@johndoe), bio, avatar
   → handle becomes their public URL: /chat/johndoe and /@johndoe

6. Onboarding:
   a. Quiz: "What do you do? / Topics? / Audience?"
   b. Content: Upload PDF or paste text (knowledge base)
      → System chunks + indexes for RAG
   c. Voice: Skip for now (Phase 2)
   d. Plan: Choose Starter ($49/mo) or Pro ($99/mo)
   e. Deploy: See their public URL + embed code + test chat
      → Can test the AI right here before going live

7. → Dashboard (command center)

PHASE B: GOING LIVE
════════════════════

8. Shares their URL:
   - Copy link button → selflyx.com/chat/johndoe
   - Share to Twitter / WhatsApp / LinkedIn
   - Or embed widget on their own website (copy-paste code)

9. Sets up monetization (Dashboard → Settings → Monetization):
   - Free message limit: 3
   - Pay-per-chat: $5/$10/$25 ✓
   - Subscription: $9.99/month ✓
   - Connects Stripe for payouts

10. Optionally: toggles "Show me on /explore" → appears in the directory

PHASE C: MONITORING & EARNING
═════════════════════════════

11. Dashboard overview shows:
    - Live stats: new chats today, messages, revenue
    - Top questions people are asking
    - Active subscriber count
    - Revenue graph (this week/month/all time)

12. Conversations tab: sees all conversations happening with their AI
    - Each shows: visitor info, message count, payment status
    - Can read full threads (with transparency notice to users)
    - Can archive, export, or delete

13. Revenue tab: sees all payments
    - Pay-per-chat payments
    - Subscription payments
    - Payout history (when money went to bank)

PHASE D: IMPROVING
═══════════════════

14. Reviews what people are asking (from Conversations + Top Questions)

15. Uploads more content to knowledge base (Dashboard → Knowledge)
    → AI automatically uses new content in future answers

16. Tests changes using Mirror (preview mode) before they go live

17. Can also chat with OTHER creators' AIs (visitor behavior)
    → Has a "My Chats" section in their profile for this
```

---

## 7. CONNECTING CHAT TO THE MAIN WEBSITE

Right now these pieces exist but are disconnected:
- `/landing` — marketing page (no creator discovery)
- `/chat/:slug` — the chat (no link back to anything)
- `/@:handle` — creator profile page (exists but nothing links to it)
- `/dashboard` — creator dashboard (creator-only, protected)

Here's how to wire them all together:

### 7.1 Landing page additions

Add a "Meet the AIs" section below the hero/features sections:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   🤖  Meet the AIs                                      │
│   Real knowledge, available 24/7                        │
│                                                         │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│   │  [Avatar]   │  │  [Avatar]   │  │  [Avatar]   │    │
│   │  Ava Smith  │  │  Max Lee    │  │  Sarah K    │    │
│   │  Fitness &  │  │  Business   │  │  Yoga &     │    │
│   │  Wellness   │  │  Strategy   │  │  Mindfulness│    │
│   │             │  │             │  │             │    │
│   │  "Ask me    │  │  "Scale     │  │  "Find your │    │
│   │  anything   │  │  your biz   │  │  inner      │    │
│   │  about fit" │  │  to 10x"    │  │  peace"     │    │
│   │             │  │             │  │             │    │
│   │  3 free     │  │  3 free     │  │  Free to    │    │
│   │  [Chat →]   │  │  [Chat →]   │  │  [Chat →]   │    │
│   └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                         │
│                  [See all AIs →]                         │
│                  (links to /explore)                     │
└─────────────────────────────────────────────────────────┘
```

Only shows creators who opted in (a toggle in their dashboard: "Featured on homepage").
Data source: `GET /api/explore/creators?featured=true&limit=6`

### 7.2 The `/explore` page — creator directory

This is NOT a marketplace. No reviews. No ratings browsing. No subscription shopping. Just a simple directory.

```
┌─────────────────────────────────────────────────────────┐
│  🔍  Explore AI Assistants                              │
│                                                         │
│  [Search by name or topic...]                           │
│  [All Topics ▼]    [Sort: Popular ▼]                   │
│                                                         │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────┐ │
│  │ [Avatar]  │ │ [Avatar]  │ │ [Avatar]  │ │[Avatar] │ │
│  │ John Doe  │ │ Ava Smith │ │ Tech Guy  │ │ Sarah K │ │
│  │ Business  │ │ Fitness   │ │ Coding &  │ │ Yoga    │ │
│  │ Coach     │ │ & Wellness│ │ AI        │ │ Teacher │ │
│  │           │ │           │ │           │ │         │ │
│  │ 3 free    │ │ Free!     │ │ 3 free    │ │ Free    │ │
│  │ [Chat →]  │ │ [Chat →]  │ │ [Chat →]  │ │[Chat →] │ │
│  └───────────┘ └───────────┘ └───────────┘ └─────────┘ │
│                                                         │
│  Showing 24 AIs  •  [1] [2] [3] →                      │
└─────────────────────────────────────────────────────────┘
```

Each creator card:
- Avatar + name (from their profile)
- Expertise/category tag (from onboarding quiz)
- One-line bio
- Pricing indicator: "3 free" or "Free!" (if creator set limit to 0)
- "Chat →" button → goes directly to `/chat/:slug`

Topics (categories): Business, Fitness, Tech, Education, Marketing, Yoga, Finance, Career
Creator can pick category during onboarding or change it in settings.

### 7.3 Navigation bar — changes by user type

```
GUEST (not logged in):
┌─────────────────────────────────────────────┐
│  Selflyx.          [Explore]    [Sign Up]    │
└─────────────────────────────────────────────┘

VISITOR (logged in, userType = visitor):
┌─────────────────────────────────────────────┐
│  Selflyx.    [Explore]  [My Chats]  [👤 ▼]  │
└─────────────────────────────────────────────┘

CREATOR (logged in, userType = creator):
┌─────────────────────────────────────────────┐
│  Selflyx.  [Explore] [My Chats] [Dashboard] [👤 ▼] │
└─────────────────────────────────────────────┘
```

Note: Creators have BOTH "My Chats" (their end-user conversations with other AIs) and "Dashboard" (their creator command center). These are separate things.

The avatar dropdown menu:
- Visitor: Profile, Settings, Logout
- Creator: Profile, Settings, Dashboard, My AI, Logout

### 7.4 Creator public profile `/@:handle` — what to show

This page already exists. Enhance it to be a proper landing page for the creator:

```
┌─────────────────────────────────────────────┐
│                                             │
│              [  Avatar  ]                   │
│              John Doe                       │
│              Business Coach & AI Expert     │
│              ★★★★☆  •  1,234 chats        │
│                                             │
│  "Hi! I'm John. I've spent 10 years in     │
│   the startup world helping entrepreneurs  │
│   build profitable businesses. Ask me       │
│   anything."                                │
│                                             │
│  Topics: Business | Marketing | Startup     │
│                                             │
│  💰 Pricing: 3 free messages, then         │
│     $5/chat or $9.99/month unlimited        │
│                                             │
│  ┌───────────────────────────────────┐      │
│  │   💬  Chat with John's AI →      │      │ ← main CTA → /chat/johndoe
│  └───────────────────────────────────┘      │
│                                             │
│  🐦 Twitter  │  💼 LinkedIn  │  🌐 Website │
│                                             │
└─────────────────────────────────────────────┘
```

No login needed to view this. The "Chat" button goes to `/chat/:slug`. The stats (★ rating, chat count) come from the backend aggregating `chat_sessions` + `mirror_runs` data.

### 7.5 Creator name clickable in chat → profile modal

Currently the creator name in the chat header is just a `<div>`. Make it clickable.

When clicked, show a MODAL (not full page navigation — user doesn't lose their chat):

```
┌──────────────────── Modal ─────────────────────┐
│  ✕                                             │
│                                                │
│  [Avatar]   John Doe                           │
│             Business Coach                     │
│             ★★★★☆  •  1,234 chats             │
│                                                │
│  "I help entrepreneurs build profitable        │
│   businesses from scratch."                    │
│                                                │
│  Topics: Business, Marketing, Startup          │
│                                                │
│  🐦 Twitter  │  💼 LinkedIn                    │
│                                                │
│  [View full profile →]  ← links to /@johndoe  │
│                                                │
└────────────────────────────────────────────────┘
```

This modal is lightweight — just avatar, name, bio, social links, and a link to the full profile page.

---

## 8. END USER CONVERSATION HISTORY — `/my-chats`

### 8.1 The problem

Right now, a logged-in end user has nowhere to see their own conversation history.
- `/conversations` → Creator dashboard route, shows conversations WITH their AI
- `ConversationSidebar` in chat → shows conversations only with the current creator
- No page that shows ALL conversations across ALL creators

### 8.2 The `/my-chats` page layout

```
┌─────────────────────────────────────────────────┐
│  💬  My Conversations                           │
│                                                 │
│  [Search my chats...]                           │
│  [All Creators ▼]   [Sort: Recent ▼]           │
│                                                 │
│  ── Today ────────────────────────────────────  │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  [J]  John Doe's AI              12 msgs │    │
│  │       "The best approach to scaling     │    │
│  │        is to first nail your product.." │    │
│  │       Just now          [Continue →]    │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  [J]  John Doe's AI              5 msgs  │    │
│  │       "You should definitely look       │    │
│  │        into SaaS models because..."     │    │
│  │       2 hours ago       [Continue →]    │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ── Yesterday ────────────────────────────────  │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  [S]  Sarah's Yoga AI            8 msgs  │    │
│  │       "Downward dog is great for        │    │
│  │        building core strength..."       │    │
│  │       Yesterday, 3:42 PM [Continue →]   │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ── Last Week ────────────────────────────────  │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  [T]  Tech Guru                  15 msgs │    │
│  │       "React hooks can be tricky        │    │
│  │        at first but the key is..."      │    │
│  │       Jan 25              [Continue →]  │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
└─────────────────────────────────────────────────┘
```

Each conversation card shows:
- Creator avatar + name (with color-coded initial if no avatar)
- Last message preview (truncated to ~60 chars)
- Message count
- Timestamp (relative: "just now", "2 hours ago", "yesterday", "Jan 25")
- "Continue →" button → navigates to `/chat/:creatorSlug?sessionId=xxx`

### 8.3 Filtering and sorting

**Filter by Creator:** Dropdown shows all creators the user has chatted with. Selecting one filters to only that creator's conversations.

**Sort options:**
- Recent (default) — by last message timestamp
- Oldest first
- Most messages

**Search:** Full-text search across message content + creator names. Highlights matching text in the preview.

### 8.4 Grouped by date

Conversations are grouped into:
- Today
- Yesterday
- Last 7 days
- Last 30 days
- Older

### 8.5 "Continue" action

Clicking "Continue →" on any conversation:
```
→ navigates to /chat/:creatorSlug?sessionId=xxx
→ PublicChatPage loads with sessionId
→ fetches all previous messages for that session
→ user sees the full history and can continue typing
```

If the user is subscribed to that creator → no paywall.
If not → free limit applies (or they can pay again).

### 8.6 Empty state (new user, no conversations yet)

```
┌─────────────────────────────────┐
│                                 │
│   💬  No conversations yet      │
│                                 │
│   Start chatting with an AI     │
│   to see your history here.     │
│                                 │
│   [Explore AIs →]               │
│                                 │
└─────────────────────────────────┘
```

### 8.7 Data source

```
GET /api/user/my-chats
  ?page=1
  &sort=recent
  &creatorId=optional_filter
  &search=optional_query

Response: {
  conversations: [
    {
      sessionId: "cs_xxx",
      creatorId: "uid_yyy",
      creatorName: "John Doe",
      creatorAvatar: "https://...",
      creatorSlug: "john-doe",
      lastMessage: "The best approach to scaling...",
      messageCount: 12,
      lastActivityAt: "2026-02-04T10:30:00Z",
      isPremium: true,            // user paid for this session
      isSubscribed: true          // user has active subscription to this creator
    },
    ...
  ],
  total: 47,
  page: 1
}
```

This endpoint queries `chat_sessions WHERE userId = current_user`, JOINs with `chat_messages` for last message, and JOINs with `users` for creator details.

---

## 9. CREATOR VISIBILITY & ANALYTICS

### 9.1 Should creators see full chat history?

**Yes. Full conversations. Phase 1.**

Reasons:
- Creators NEED to see what questions people ask to improve their AI
- They need to spot wrong answers (quality control)
- They want to understand their audience's pain points
- This is standard practice on similar platforms

What to add: a **transparency notice** shown to end users once:
```
┌──────────────────────────────────────────────┐
│  ℹ️  This conversation may be reviewed by     │
│     the creator for quality improvement.     │
│                                              │
│  [Got it, continue]                          │
└──────────────────────────────────────────────┘
```

Show this the FIRST time an end user starts a chat. Store dismissal in localStorage. In Phase 2, add a privacy toggle in end user settings.

### 9.2 Creator dashboard — conversations view

Already exists at `/conversations`. Current features (keep all):
- List of all chat sessions with their AI
- Can view full thread
- Can archive / favorite / export / delete
- Search across conversations

Additions needed:
- Show payment status per conversation (Free / Paid $X / Subscribed)
- Show visitor email (if they paid with email) or visitorId (if anonymous)
- Show "active subscription" badge on subscriber conversations

```
┌─────────────────────────────────────────────────┐
│  📨  Conversations                              │
│                                                 │
│  Total: 147  │  Active: 23  │  Archived: 124   │
│  Subscribers: 12                                │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  ⭐ priya@email.com         12 messages  │    │  ← ⭐ = subscribed
│  │  Started Jan 30 • Last active: Now      │    │
│  │  "How do I scale my business..."        │    │
│  │  [View] [Archive] [Export]              │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  💳 v_1706234xxx              5 messages  │    │  ← 💳 = paid once
│  │  Started Jan 29 • Last active: Jan 29   │    │
│  │  "What marketing strategy works..."     │    │
│  │  Paid: $10                              │    │
│  │  [View] [Archive] [Export]              │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  🆓 v_1706198xxx              3 messages  │    │  ← 🆓 = free only
│  │  Started Jan 28 • Last active: Jan 28   │    │
│  │  "Hey what do you do?"                  │    │
│  │  [View] [Archive] [Export]              │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 9.3 Creator dashboard — overview/stats

```
┌─────────────────────────────────────────────────┐
│  📊  Overview                                   │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Chats   │  │ Messages │  │ Revenue  │       │
│  │   47     │  │   234    │  │  $89.30  │       │
│  │ this mo  │  │ this mo  │  │ this mo  │       │
│  └──────────┘  └──────────┘  └──────────┘       │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Subs    │  │ Avg Msgs │  │ Payout   │       │
│  │   12     │  │   4.9    │  │ $67.50   │       │
│  │ active   │  │ per chat │  │ pending  │       │
│  └──────────┘  └──────────┘  └──────────┘       │
│                                                 │
│  ── Top Questions (auto-detected) ────────────  │
│  1. "How do I get started?"         23 times    │
│  2. "What's your pricing?"          18 times    │
│  3. "Can you help me with X?"       15 times    │
│  4. "What results do clients get?"  12 times    │
│                                                 │
│  ── Popular Topics ────────────────────────     │
│  Getting Started    ████████████░░ 34%          │
│  Pricing            ████████░░░░░░ 22%          │
│  Results            █████░░░░░░░░░ 15%          │
│  Strategy           ████░░░░░░░░░░ 11%          │
│  Other              ████░░░░░░░░░░ 18%          │
│                                                 │
└─────────────────────────────────────────────────┘
```

"Top Questions" and "Popular Topics" are generated by periodically running an LLM summarization job on recent chat messages. The backend already has `analyticsAggregationService` — just needs a prompt added for topic extraction.

### 9.4 Creator revenue view

```
┌─────────────────────────────────────────────────┐
│  💰  Revenue                                    │
│                                                 │
│  All Time: $1,234.50                            │
│  Paid Out: $1,100.00  │  Pending: $134.50       │
│  Next payout: Monday, Feb 9                     │
│                                                 │
│  ── This Month ───────────────────────────────  │
│  Pay-per-chat: $42.50  (8 payments)             │
│  Subscriptions: $46.80  (12 subscribers × 75%)  │
│  Total: $89.30                                  │
│                                                 │
│  ── Payment History ──────────────────────────  │
│  Feb 3   $10.00   Pay-per-chat  ✅              │
│  Feb 3   $5.00    Pay-per-chat  ✅              │
│  Feb 2   $7.49    Subscription  ✅              │
│  Feb 1   $25.00   Pay-per-chat  ✅              │
│                                                 │
│  ── Payout History ───────────────────────────  │
│  Jan 27   $67.50   ✅ Completed                 │
│  Jan 20   $82.00   ✅ Completed                 │
│                                                 │
│  Stripe Connect: ✅ Connected                   │
│  [View Stripe Dashboard →]                      │
└─────────────────────────────────────────────────┘
```

---

## 10. END USER PROFILE & SETTINGS — `/my-profile`

Visitors (and creators when viewing their end-user side) have a simple profile page:

```
┌─────────────────────────────────────────────────┐
│  👤  My Profile                                 │
│                                                 │
│  [Profile]   [Subscriptions]   [Privacy]        │  ← tabs
│                                                 │
│  ── Profile ──────────────────────────────────  │
│  Name:     [Priya Sharma        ]               │
│  Avatar:   [Current photo] [Change]             │
│  Email:    priya@email.com (verified ✓)         │
│                                                 │
│  [Save changes]                                 │
│                                                 │
│  ── Security ─────────────────────────────────  │
│  [Change password]                              │
│  Active sessions: 2 devices  [Manage]           │
│                                                 │
│  ── Danger Zone ──────────────────────────────  │
│  [Export all my data]                           │
│  [Delete account]                               │
└─────────────────────────────────────────────────┘

Subscriptions tab → (see Section 4.6)

Privacy tab:
┌─────────────────────────────────────────────────┐
│  🔒  Privacy                                    │
│                                                 │
│  Conversation visibility:                       │
│  [✓] Allow creators to review my conversations  │
│      (for quality improvement)                  │
│                                                 │
│  Note: Creators can see your chat history       │
│  with their AI. This helps them improve         │
│  the AI's responses.                            │
│                                                 │
│  Data retention:                                │
│  Your conversations are kept for 30 days        │
│  after your last message. You can export        │
│  or delete them anytime.                        │
│                                                 │
│  [Export all conversations]                     │
│  [Delete all conversations]                     │
└─────────────────────────────────────────────────┘
```

Note: The "Allow creators to review" toggle is for future Phase 2 privacy controls. In Phase 1, it's always ON and just shown as informational. The transparency notice in the chat page (Section 9.1) is the main disclosure.

---

## 11. MOBILE CONSIDERATIONS

80% of users will be on mobile. Key decisions:

### Chat page (already addressed in CHAT_FINAL_FLOW_IMPLEMENT.md)
- Full-screen chat
- Left panel: hamburger menu → drawer
- Right panel: "i" button → bottom sheet
- Input stuck to bottom

### Explore page (mobile)
```
┌──────────────────────┐
│  🔍 Explore AIs      │
│  [Search...]         │
│  [All Topics ▼]      │
│                      │
│  ┌────────────────┐  │
│  │ [Ava] Fitness  │  │  ← single column
│  │ 3 free [Chat]  │  │     card list
│  └────────────────┘  │
│  ┌────────────────┐  │
│  │ [John] Business│  │
│  │ 3 free [Chat]  │  │
│  └────────────────┘  │
│  ...                 │
└──────────────────────┘
```

### My Chats page (mobile)
- Same single-column layout as desktop
- Pull-to-refresh to load new conversations
- Swipe left on a conversation → archive/delete options (optional, Phase 2)

### Creator profile modal (mobile)
- Opens as a bottom sheet instead of modal

### Paywall (mobile)
- Options stack vertically
- Large touch-friendly buttons (min 44px height)

### General
- All buttons: min 44×44px touch target
- Font size: min 16px (avoids iOS auto-zoom)
- No hover states on mobile

---

## 12. DATABASE CHANGES

### 12.1 Modified: `User` table — add columns

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `userType` | TEXT | NULL | `'creator'` or `'visitor'`. NULL = hasn't chosen yet |
| `featuredOnExplore` | BOOLEAN | false | Creator opted-in to appear on /explore and landing page |

### 12.2 Modified: `priceConfig` JSONB structure

Current fields (keep):
```json
{
  "payPerChatTiers": [500, 1000, 2500],
  "freeMessageLimit": 3
}
```

Add these fields:
```json
{
  "payPerChatEnabled": true,
  "subscriptionEnabled": true,
  "subscriptionPriceCents": 999
}
```

No schema migration needed — it's JSONB. Just update the code that reads/writes priceConfig.

### 12.3 New table: `end_user_subscriptions`

```sql
CREATE TABLE IF NOT EXISTS "end_user_subscriptions" (
  "id"                    TEXT PRIMARY KEY,
  "userId"               TEXT NOT NULL REFERENCES "User"(id),   -- the end user
  "creatorId"             TEXT NOT NULL REFERENCES "User"(id),   -- the creator
  "stripeSubscriptionId"  TEXT NOT NULL,                         -- Stripe subscription ID
  "stripePriceId"         TEXT,                                  -- Stripe price ID
  "status"                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','cancelled','past_due','unpaid')),
  "priceCents"            INTEGER NOT NULL,                      -- monthly price in cents
  "currentPeriodStart"    TIMESTAMPTZ,
  "currentPeriodEnd"      TIMESTAMPTZ,
  "cancelAtPeriodEnd"     BOOLEAN DEFAULT false,
  "createdAt"             TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt"             TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast subscription lookups
CREATE INDEX idx_eus_user ON "end_user_subscriptions"("userId");
CREATE INDEX idx_eus_creator ON "end_user_subscriptions"("creatorId");
CREATE UNIQUE INDEX idx_eus_user_creator
  ON "end_user_subscriptions"("userId","creatorId")
  WHERE status = 'active';   -- only one active subscription per user per creator
```

### 12.4 Existing table usage notes

- `chat_sessions.freeResetAt` — already exists, use it for daily free limit reset
- `premium_sessions` — keep as-is for pay-per-chat 24h windows
- `subscriptions` table — this is for CREATOR subscriptions to Selflyx ($49/$99 plans). Do NOT confuse with `end_user_subscriptions` (end user paying a creator)

---

## 13. API CHANGES

### 13.1 New endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/set-user-type` | Required | Set `userType` to 'creator' or 'visitor' during signup |
| GET | `/api/user/my-chats` | Required | List all conversations for the logged-in end user (across all creators) |
| GET | `/api/user/my-chats/search` | Required | Search across user's conversations |
| POST | `/api/payments/subscription/create` | Required | Create a Stripe subscription for end user → creator |
| POST | `/api/payments/subscription/cancel` | Required | Cancel an active subscription |
| GET | `/api/user/subscriptions` | Required | List all active subscriptions for the logged-in user |
| GET | `/api/explore/creators` | Public | List public creators for /explore page (paginated, filterable) |
| GET | `/api/explore/creators/search` | Public | Search creators by name or topic |
| GET | `/api/creator/subscribers` | Required (creator) | List subscribers to this creator's AI |

### 13.2 Modified endpoints

| Endpoint | What changes |
|----------|--------------|
| `POST /api/public/chat` | Before checking free limit, check if user has active subscription for this creator. If yes → skip paywall entirely. |
| `GET /api/public/creator/:slug` | Already returns 404 for unknown slug — confirm the response body includes `{ error: 'Creator not found' }` so frontend can detect it |
| `POST /api/profile/update` | If `userType = 'visitor'`, only require name (not handle, bio, etc.) |
| ProfileCompletionGuard (middleware) | Add `userType` check: if visitor + basic profile done → allow. If creator + onboarding not done → block (as before). If userType null → redirect to /choose-type |
| `GET /api/public/creator/:slug` response | Add `subscriptionEnabled`, `subscriptionPriceCents` to the returned `paymentOptions` so frontend knows whether to show subscription option |

### 13.3 Stripe webhook additions

The existing Stripe webhook at `/api/billing/stripe/webhook` needs to handle new events:
- `subscription.created` — save to `end_user_subscriptions`
- `subscription.updated` — update status
- `subscription.deleted` / `subscription.cancelled` — mark as cancelled
- `subscription.trial_will_end` — send email notification (Phase 2)
- `invoice.payment_failed` — update status to `past_due`

---

## 14. FRONTEND CHANGES

### 14.1 New pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/explore` | `ExplorePage` | Creator directory. Search + filter + grid of creator cards |
| `/my-chats` | `MyChatPage` | End user conversation history across all creators |
| `/my-profile` | `MyProfilePage` | End user profile + subscriptions + privacy settings |
| `/choose-type` | `ChooseTypePage` | The fork: "Create AI" vs "Chat with AI" |

### 14.2 Modified pages

| Page | Changes |
|------|---------|
| **PublicChatPage** | (1) Handle `creator === null` → show NotFound. (2) Make creator name in header clickable → CreatorProfileModal. (3) PaymentPrompt now shows subscription option too (if enabled by creator). (4) Check subscription status on page load — if subscribed, hide paywall entirely. |
| **AuthPage / Signup flow** | After profile step, redirect to `/choose-type` instead of directly to `/onboarding`. Store `next` param (from where user came) in localStorage. |
| **LandingPage** | Add "Meet the AIs" section with featured creator cards |
| **App.tsx** | Add routes: `/explore`, `/my-chats`, `/my-profile`, `/choose-type` |
| **Navigation** | Show different nav links based on `userType` |
| **CreatorPublicProfile** | Same 404 handling as PublicChatPage. Enhance layout (see Section 7.4). |

### 14.3 New components

| Component | Used in | Purpose |
|-----------|---------|---------|
| `CreatorCard` | ExplorePage, LandingPage | Reusable card for creator directory |
| `CreatorProfileModal` | PublicChatPage | Modal showing creator bio when clicking name in chat header |
| `NotFoundCreator` | PublicChatPage, CreatorPublicProfile | 404 screen for invalid slugs |
| `SubscriptionOption` | PaymentPrompt (inside) | The subscription tier option alongside pay-per-chat tiers |

### 14.4 AuthContext changes

Add `userType` to the `MeUser` type:
```typescript
export type MeUser = {
  // ... existing fields ...
  userType?: 'creator' | 'visitor';   // NEW
};
```

The navigation and route guards read this field to determine what to show.

---

## 15. BUILD PRIORITY — EXECUTION ORDER

Build in this order. Each is independently shippable.

```
═══════════════════════════════════════════════════════
PRIORITY 1 — Do This Week (Critical Fixes)
═══════════════════════════════════════════════════════

[1] 404 handling for invalid routes
    - PublicChatPage: null creator → NotFound component
    - CreatorPublicProfile: same
    - Effort: Small (1 day)
    - Impact: Immediately fixes broken UX

[2] User type fork (creator vs visitor)
    - Add userType column to DB
    - Add /choose-type page
    - Modify ProfileCompletionGuard
    - Visitor path: quick profile → done
    - Auto-select visitor if coming from /chat/:slug
    - Effort: Medium (2-3 days)
    - Impact: End users can finally login without creator onboarding

═══════════════════════════════════════════════════════
PRIORITY 2 — Next Sprint (Core Features)
═══════════════════════════════════════════════════════

[3] Creator name clickable in chat → profile modal
    - Make header creator name a button
    - Build CreatorProfileModal component
    - Effort: Small (1 day)
    - Impact: Users can learn about who they're chatting with

[4] /explore page (creator directory)
    - New page + CreatorCard component
    - New API: GET /api/explore/creators
    - Creator toggle: "Featured" in dashboard settings
    - Effort: Medium (2 days)
    - Impact: End users can discover creators

[5] /my-chats page (end user history)
    - New page layout (see Section 8)
    - New API: GET /api/user/my-chats
    - Search + filter + resume chat
    - Effort: Medium (2 days)
    - Impact: End users can find and resume their conversations

[6] Landing page "Meet the AIs" section
    - Add featured creator cards to landing page
    - Uses same CreatorCard component as /explore
    - Effort: Small (1 day)
    - Impact: Social proof, discovery starting point

═══════════════════════════════════════════════════════
PRIORITY 3 — Payment Enhancement (High Impact)
═══════════════════════════════════════════════════════

[7] Subscription flow (NEW payment model)
    - Stripe Subscription API integration
    - New API endpoints (create, cancel, list)
    - end_user_subscriptions table
    - Check subscription status before paywall
    - Effort: Large (4-5 days)
    - Impact: Recurring revenue for creators, better retention for users

[8] Update paywall to show both options
    - PaymentPrompt shows pay-per-chat + subscription
    - Only after [7] is built
    - Effort: Small (half day, after [7])

[9] Daily free limit reset (use freeResetAt)
    - Backend: reset free count every 24h per session
    - Frontend: show "resets in X hours" text
    - Effort: Small (1 day)
    - Impact: Casual users can keep coming back

═══════════════════════════════════════════════════════
PRIORITY 4 — Polish & Growth
═══════════════════════════════════════════════════════

[10] End user profile page (/my-profile)
     - Profile tab, Subscriptions tab, Privacy tab
     - Effort: Medium (2 days)

[11] Navigation updates by user type
     - Different nav links for guest/visitor/creator
     - Effort: Small (1 day)

[12] Transparency notice in chat
     - One-time notice: "Creator can review your chats"
     - Dismiss and remember in localStorage
     - Effort: Small (half day)

[13] Creator dashboard: subscription stats
     - Show subscriber count + subscription revenue
     - Show payment status badges on conversations
     - Effort: Small (1 day)

[14] Stripe Connect for payouts
     - Creator connects their Stripe account
     - Automated weekly payouts
     - Effort: Medium (2-3 days)
     - Can be done in parallel with other items

[15] Creator analytics: Top Questions + Topics
     - LLM-based summarization of recent chats
     - Show in dashboard overview
     - Effort: Medium (2 days)
```

---

## 16. WHAT NOT TO BUILD — PHASE 2

These are explicitly out of scope for Phase 1. Do not build them:

```
❌ Full Marketplace (reviews, ratings, subscription browsing)
   → /explore (directory) is enough for Phase 1

❌ WhatsApp / Instagram integrations
   → Meta approval takes weeks. Phase 2.

❌ Voice responses (ElevenLabs)
   → Nice-to-have add-on. Phase 2.

❌ Video avatars
   → Expensive. Phase 2.

❌ Mobile apps (iOS/Android)
   → Web is enough. 80% of web traffic is mobile anyway.

❌ Advanced analytics dashboard
   → Basic stats + top questions is enough.

❌ Team features (multiple people managing one AI)
   → Single creator per account for now.

❌ API access for end users
   → Not needed for Phase 1.

❌ Referral system / affiliate links
   → Nice for growth but not critical for first 30 customers.

❌ End user privacy toggle (hide chats from creator)
   → Phase 2. Phase 1: all chats visible to creator with notice.

❌ Razorpay integration
   → Start with Stripe globally. Add Razorpay when targeting India specifically.

❌ Chat export to PDF
   → JSON export is enough for Phase 1.

❌ Push notifications
   → Email is sufficient for now.
```

---

## 17. FAQ — Quick Answers

**Q: Do end users need to sign up to chat?**
A: No. 3 free messages with zero signup. Login is optional (only needed to save history or subscribe).

**Q: Do end users need to sign up to pay?**
A: Pay-per-chat: No. Just need email for receipt. Subscription: Yes (account required to track recurring billing).

**Q: Can an end user subscribe to multiple creators?**
A: Yes. Each subscription is independent. They can be subscribed to 5 different creators simultaneously.

**Q: Can a visitor later become a creator?**
A: Yes. They click "Create my own AI" anywhere, enter creator onboarding, and get a dashboard. Their chat history stays.

**Q: Can a creator also chat with other AIs?**
A: Yes. A creator is also a user. They can browse /explore, chat with other AIs, subscribe to them. Their "My Chats" page shows these conversations.

**Q: How does the creator get paid?**
A: Stripe Connect. Platform collects payment → takes 25% → transfers 75% to creator's connected Stripe account → weekly auto-payout to bank.

**Q: Is there a marketplace?**
A: No. There's `/explore` (a simple directory). No reviews, no ratings, no subscription shopping. Just a list of public creators with a "Chat" button.

**Q: What happens after the 24h pay-per-chat window expires?**
A: Free limit resets (3 free messages again). After those 3, paywall shows again. User can pay again or subscribe.

**Q: How long is conversation history kept?**
A: Guests (no account): 30 days via cookie-based visitorId. Logged-in users: forever (until they delete it).

**Q: What if a visitor logs in AFTER chatting as a guest?**
A: The session is auto-claimed. The visitor's guest conversation gets linked to their new account. It appears in their /my-chats automatically.

**Q: Can multiple guest sessions be claimed at once?**
A: Yes. On login, check localStorage for all pending session IDs and claim them all in one batch request.

**Q: How are "Top Questions" generated for creator analytics?**
A: The backend periodically (daily) runs an LLM summarization on recent chat messages for each creator. Groups common questions/themes. Cached and displayed on dashboard.

---

*This document is the master reference. When in doubt, refer here first.*
*Last updated: Feb 4, 2026*
