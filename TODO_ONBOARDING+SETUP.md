🎯 FINAL ONBOARDING + SETUP FLOW (Industry Standard)
Samajh gaya boss! Main COMPLETE RETHINK kar raha hu. Let me design this properly based on industry leaders (Notion, Stripe, Linear, Shopify).

🔍 INDUSTRY ANALYSIS (How Top Platforms Do It)
Notion Onboarding:

1. Signup (Google OAuth)
2. "What will you use Notion for?" (1 question)
3. Template selection
4. DONE → Jump into product
5. Setup wizard appears as sidebar checklist
Stripe Onboarding:

1. Signup
2. Try in test mode (no payment needed)
3. When ready to go live → Setup checklist:
   - [ ] Verify business
   - [ ] Add bank account
   - [ ] Enable payment methods
   - [ ] Go live
Shopify Onboarding:

1. Signup
2. Basic store setup (name, type)
3. DONE → Dashboard with setup checklist
4. Checklist:
   - [ ] Add products
   - [ ] Customize theme
   - [ ] Set up payments
   - [ ] Launch store
Linear Onboarding:

1. Signup
2. Create workspace (name, team)
3. DONE → Product tour
4. Settings accessible anytime
💡 KEY INSIGHTS (Industry Best Practices)

✅ DO:
1. Get user to "aha moment" in < 2 minutes
2. Let them TRY before PAYING
3. Setup as progressive checklist (not blocking)
4. Ask for payment only when needed
5. Show value first, monetize later

❌ DON'T:
1. Ask for payment upfront (kills conversion)
2. Too many onboarding steps (user drops off)
3. Block user until everything is complete
4. Ask questions you don't immediately need
🎯 NEW FLOW DESIGN (Best of All Worlds)
ARCHITECTURE:

┌─────────────────────────────────────────────┐
│                                             │
│  ONBOARDING (Fast - 2 min)                  │
│  Goal: Get to "aha moment" ASAP             │
│  ↓                                          │
│  User tries AI chat immediately             │
│  ↓                                          │
│  SETUP CHECKLIST (Progressive)              │
│  Goal: Complete when ready to monetize      │
│                                             │
└─────────────────────────────────────────────┘
📋 PHASE 1: ONBOARDING (Essential Only)
Step 1: Signup

Route: /auth

Google OAuth (preferred) or Email

No verification, instant login
Step 2: Quick Profile (3 Questions Only)

Route: /onboarding/start

┌─────────────────────────────────────────┐
│ Welcome! Let's set up your AI 🚀        │
├─────────────────────────────────────────┤
│                                         │
│ 1. What's your name?                    │
│    [Sarah Johnson____________]          │
│                                         │
│ 2. What do you do?                      │
│    [Fitness Coach___________] 🔽        │
│    (Dropdown: categories)               │
│                                         │
│ 3. What should your AI help with?       │
│    [Workout plans, nutrition advice___] │
│    ________________________________     │
│                                         │
│ [Continue →]                            │
│                                         │
│ Takes 30 seconds                        │
└─────────────────────────────────────────┘

SAVES:
- displayName
- category (for marketplace later)
- primaryUse (AI focus)
Step 3: Upload Knowledge (Simplified)

Route: /onboarding/upload

┌─────────────────────────────────────────┐
│ Share Your Expertise 📚                 │
├─────────────────────────────────────────┤
│                                         │
│ Upload your content so your AI can      │
│ answer questions like you.              │
│                                         │
│ [Drop files or click to browse]         │
│                                         │
│ Accepted: PDF, TXT, DOCX, URLs          │
│ Minimum: 500 words                      │
│                                         │
│ ✅ fitness-guide.pdf (1,234 words)      │
│                                         │
│ Total: 1,234 words ✓                    │
│                                         │
│ [Continue →]                            │
│                                         │
│ ℹ️  You can add more content later      │
└─────────────────────────────────────────┘

SAVES:
- Uploads to S3
- Generates embeddings
- Creates identity version
Step 4: Try Your AI (Aha Moment!)

Route: /onboarding/preview

┌─────────────────────────────────────────┐
│ 🎉 Your AI is Ready! Try it now         │
├─────────────────────────────────────────┤
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Chat with your AI                   │ │
│ │                                     │ │
│ │ 💬 Ask me anything!                 │ │
│ │                                     │ │
│ │ [What's a good workout for...]      │ │
│ │ [Send]                              │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Try asking:                             │
│ • "What's your workout routine?"        │
│ • "Best diet for weight loss?"          │
│                                         │
│ [Looks good! Continue →]                │
│                                         │
│ or [← Back to edit content]             │
└─────────────────────────────────────────┘

USER TESTS:
- Sends 2-3 test messages
- Sees AI respond in their voice
- "Aha moment" = AI works!
Step 5: Choose Your Path

Route: /onboarding/complete

┌─────────────────────────────────────────┐
│ What's Next? 🎯                         │
├─────────────────────────────────────────┤
│                                         │
│ Your AI is live! Choose what to do:     │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 🚀 Go Live & Monetize               │ │
│ │                                     │ │
│ │ Set pricing, choose plan, start     │ │
│ │ earning from visitors.              │ │
│ │                                     │ │
│ │ [Complete Setup →]                  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 👀 Explore Dashboard First          │ │
│ │                                     │ │
│ │ See features, test more, set up     │ │
│ │ monetization later.                 │ │
│ │                                     │ │
│ │ [Go to Dashboard]                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘

BRANCHES:
1. "Complete Setup" → Go to PHASE 2 (Setup)
2. "Dashboard" → Skip to dashboard with setup banner
TOTAL TIME: 2-3 minutes

📋 PHASE 2: SETUP (Progressive, Non-Blocking)
When User Clicks "Complete Setup" or Dashboard Banner:

Route: /setup

┌─────────────────────────────────────────┐
│ Complete Your Setup 🎯                  │
├─────────────────────────────────────────┤
│                                         │
│ Complete these steps to start earning:  │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 1. Set Your Pricing                 │ │
│ │    How much visitors will pay       │ │
│ │    [Setup Pricing →]                │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 2. Choose Platform Plan             │ │
│ │    Free trial or paid plan          │ │
│ │    [Choose Plan →]                  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 3. Connect Stripe (Optional)        │ │
│ │    Receive payouts automatically    │ │
│ │    [Connect Stripe →]               │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 4. Share Your AI                    │ │
│ │    Get your link and start sharing  │ │
│ │    [Get Link →]                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Skip for Now]                          │
│                                         │
└─────────────────────────────────────────┘

ALLOWS:
- Complete in any order
- Skip and come back later
- Each step is independent
SETUP STEP 1: Pricing

Route: /setup/pricing

┌─────────────────────────────────────────┐
│ Set Your Pricing 💰                     │
├─────────────────────────────────────────┤
│                                         │
│ How much should visitors pay?           │
│                                         │
│ Pay-per-chat (24h access):              │
│ $ [10]                                  │
│ Recommended: $5-25                      │
│                                         │
│ Monthly subscription (unlimited):       │
│ $ [20] /month                           │
│ Recommended: $10-50                     │
│                                         │
│ Free preview messages:                  │
│ [3] messages (0-10)                     │
│                                         │
│ ────────────────────────────────────    │
│                                         │
│ Revenue Split:                          │
│ ┌─────────────────────────────────────┐ │
│ │ Visitor pays: $10                   │ │
│ │ You earn: $7.50 (75%)               │ │
│ │ Platform fee: $2.50 (25%)           │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Save & Continue]   [Skip for Now]     │
│                                         │
└─────────────────────────────────────────┘

SAVES TO:
- marketplace_listings (payPerChatPriceCents, subscriptionPriceCents)
- User.priceConfig (backup)
SETUP STEP 2: Platform Plan

Route: /setup/plan

ENHANCED CARD DESIGN (Industry Standard):

┌─────────────────────────────────────────┐
│ Choose Your Platform Plan 📊            │
├─────────────────────────────────────────┤
│                                         │
│ Start with a free trial, upgrade when   │
│ you're ready to scale.                  │
│                                         │
│ ┌───────────────────────────────────┐   │
│ │ 🎁 FREE TRIAL                     │   │
│ │ ─────────────────────────────────  │   │
│ │                                   │   │
│ │ $0 for 7 days                     │   │
│ │ Then $49/mo or downgrade to free  │   │
│ │                                   │   │
│ │ ✅ All features unlocked          │   │
│ │ ✅ 5,000 chats/month              │   │
│ │ ✅ Monetization enabled           │   │
│ │ ✅ Marketplace listing            │   │
│ │ ✅ Email support                  │   │
│ │                                   │   │
│ │ [Start Free Trial →]              │   │
│ │                                   │   │
│ │ ⭐ RECOMMENDED                    │   │
│ └───────────────────────────────────┘   │
│                                         │
│ ┌──────┬──────┬──────┐                  │
│ │Starter Growth Scale │                 │
│ ├──────┼──────┼──────┤                  │
│ │$49/mo│$149  │$499  │                 │
│ │      │      │      │                 │
│ │5K    │25K   │Unlim │                 │
│ │chats │chats │ited  │                 │
│ │      │      │      │                 │
│ │[Select] [Select] [Select]           │
│ └──────┴──────┴──────┘                  │
│                                         │
│ ────────────────────────────────────    │
│                                         │
│ 💡 Feature Comparison:                  │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Feature         Free Start Growth   │ │
│ │ Monetization    ❌    ✅     ✅     │ │
│ │ Marketplace     ❌    ✅     ✅     │ │
│ │ Chats/month     500   5K    25K     │ │
│ │ Custom brand    ❌    ❌     ✅     │ │
│ │ Priority support❌    ❌     ✅     │ │
│ │ Analytics       Basic Basic Advanced│ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Skip for Now - Stay on Free]           │
│                                         │
└─────────────────────────────────────────┘

CARD STYLING (Describe, no code):
- Free Trial: Gradient border (purple-pink)
- Badge: "RECOMMENDED" (floating above card)
- Hover effect: Lift + shadow
- Current plan: Green checkmark badge
- Comparison table: Sticky header on scroll
SETUP STEP 3: Stripe Connect

Route: /setup/stripe

┌─────────────────────────────────────────┐
│ Connect Stripe to Get Paid 💳           │
├─────────────────────────────────────────┤
│                                         │
│ Link your Stripe account to receive     │
│ payouts from visitor payments.          │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ✅ Secure OAuth (1-click)           │ │
│ │ ✅ Instant payouts to your bank     │ │
│ │ ✅ Automatic 75/25 split            │ │
│ │ ✅ Tax compliant                    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Connect Stripe Account]                │
│                                         │
│ ℹ️  Don't have Stripe? We'll help you  │
│    create an account (takes 2 min)     │
│                                         │
│ [Skip for Now]                          │
│                                         │
│ (You can connect later in Settings)     │
│                                         │
└─────────────────────────────────────────┘

CONDITIONAL:
- If user.subscriptionTier === 'free' → Skip this step
- Only shown for paid tiers
SETUP STEP 4: Share Your AI

Route: /setup/share

┌─────────────────────────────────────────┐
│ Your AI is Live! 🎉                     │
├─────────────────────────────────────────┤
│                                         │
│ Share your AI chat link:                │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ selflyx.com/chat/sarahfitness       │ │
│ │ [Copy Link] [QR Code]               │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Quick Share:                            │
│ [📱 Instagram] [🐦 Twitter] [💼 LinkedIn]│
│                                         │
│ ────────────────────────────────────    │
│                                         │
│ Embed on Your Website:                  │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ <script src="..."></script>         │ │
│ │ [Copy Code]                         │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ────────────────────────────────────    │
│                                         │
│ 💡 Next Steps:                          │
│ 1. Share link in your bio               │
│ 2. Post about your AI on social         │
│ 3. Add to your website/newsletter       │
│                                         │
│ [Go to Dashboard →]                     │
│                                         │
└─────────────────────────────────────────┘
🎯 DASHBOARD SETUP BANNER (If Incomplete)

When user skips setup, show in dashboard:

┌─────────────────────────────────────────┐
│ ⚠️  Complete Your Setup to Start Earning│
├─────────────────────────────────────────┤
│                                         │
│ Progress: 2/4 steps completed           │
│                                         │
│ [████████░░░░] 50%                      │
│                                         │
│ ✅ Profile created                      │
│ ✅ Content uploaded                     │
│ ⚠️  Set pricing                         │
│ ⚠️  Choose plan                         │
│                                         │
│ [Complete Setup]  [Dismiss]             │
│                                         │
└─────────────────────────────────────────┘

DISMISSIBLE:
- User can close banner
- Re-appears on next login
- Disappears when all steps done
📊 COMPLETE FLOW DIAGRAM

┌─────────────────────────────────────────────────────────────┐
│                     USER JOURNEY                            │
└─────────────────────────────────────────────────────────────┘

1. SIGNUP
   ↓
   [Google OAuth / Email]
   ↓
   
2. ONBOARDING (2-3 min)
   ↓
   /onboarding/start
   ├─ Quick profile (3 questions)
   ↓
   /onboarding/upload
   ├─ Upload content (500+ words)
   ↓
   /onboarding/preview
   ├─ Try AI chat (aha moment!)
   ↓
   /onboarding/complete
   ├─ Choose path:
   │  ├─ [Complete Setup] → Go to SETUP
   │  └─ [Dashboard] → Skip to Dashboard
   ↓

3. SETUP (Progressive, 5-10 min)
   ↓
   /setup
   ├─ Checklist shown
   │
   ├─ /setup/pricing
   │  └─ Set pay-per-chat + subscription prices
   │
   ├─ /setup/plan
   │  └─ Choose platform tier (Free trial recommended)
   │
   ├─ /setup/stripe (optional)
   │  └─ Connect Stripe for payouts
   │
   └─ /setup/share
      └─ Get link + share
   ↓

4. DASHBOARD
   ↓
   If setup incomplete:
   ├─ Show banner: "Complete setup to earn"
   ├─ Click → Back to /setup
   └─ Dismissible
   
   If setup complete:
   ├─ Full dashboard access
   ├─ Analytics, earnings, conversations
   └─ Settings accessible

┌─────────────────────────────────────────────────────────────┐
│                 SETUP COMPLETION STATES                     │
└─────────────────────────────────────────────────────────────┘

State 1: Onboarding Only (No Setup)
├─ Can chat with own AI
├─ Cannot monetize
├─ Not listed on marketplace
└─ Dashboard shows setup banner

State 2: Pricing + Plan (No Stripe)
├─ Marketplace listing created
├─ Visitors see paywall
├─ Payments fail (no Stripe connected)
└─ Dashboard shows "Connect Stripe to receive payouts"

State 3: Full Setup Complete
├─ Monetization live
├─ Marketplace listing active
├─ Payments flow to Stripe
└─ Dashboard shows full analytics
🎯 SETUP CHECKLIST (Database Tracking)

-- User table additions
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS setupCompleted JSONB DEFAULT '{
    "profile": false,
    "content": false,
    "pricing": false,
    "plan": false,
    "stripe": false,
    "share": false
  }';

-- Update as user completes each step
UPDATE "User" 
SET setupCompleted = jsonb_set(setupCompleted, '{pricing}', 'true')
WHERE id = $1;

-- Check completion
SELECT 
  (setupCompleted->>'profile')::boolean as profile_done,
  (setupCompleted->>'content')::boolean as content_done,
  (setupCompleted->>'pricing')::boolean as pricing_done,
  (setupCompleted->>'plan')::boolean as plan_done,
  (setupCompleted->>'stripe')::boolean as stripe_done
FROM "User" WHERE id = $1;
📋 ONBOARDING VS SETUP (Clear Separation)

┌─────────────────────────────────────────────────────────────┐
│                  ONBOARDING (Required)                      │
├─────────────────────────────────────────────────────────────┤
│ Goal: Get to aha moment ASAP                                │
│ Time: 2-3 minutes                                           │
│ Blocking: Yes (can't skip)                                  │
│                                                             │
│ Steps:                                                      │
│ 1. Profile (name, category, focus)                         │
│ 2. Upload content (500 words min)                          │
│ 3. Preview AI (test chat)                                  │
│ 4. Choose path (setup now / explore first)                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  SETUP (Optional)                           │
├─────────────────────────────────────────────────────────────┤
│ Goal: Enable monetization when ready                        │
│ Time: 5-10 minutes                                          │
│ Blocking: No (can skip, complete later)                     │
│                                                             │
│ Steps:                                                      │
│ 1. Pricing (what visitors pay)                             │
│ 2. Plan (platform subscription)                            │
│ 3. Stripe (payout method) [optional]                       │
│ 4. Share (get link, embed code)                            │
│                                                             │
│ Tracked: setupCompleted JSONB field                         │
│ UI: Dashboard banner if incomplete                          │
└─────────────────────────────────────────────────────────────┘
🎨 PLAN PAGE CARDS (Design Specifications)
Card Layout (4 cards in row, responsive)

DESKTOP: 4 columns (Free Trial, Starter, Growth, Scale)
TABLET: 2x2 grid
MOBILE: 1 column (scroll)

CARD ANATOMY:

┌───────────────────────────────┐
│ [BADGE] "Recommended"         │ ← Floating badge (if applicable)
├───────────────────────────────┤
│ HEADER                        │
│ ├─ Title (bold, 24px)         │
│ ├─ Subtitle (muted, 14px)     │
│ └─ Icon (top-right)           │
├───────────────────────────────┤
│ PRICING                       │
│ ├─ Price (48px, bold)         │
│ ├─ Period (16px, muted)       │
│ └─ Limit (12px, muted)        │
├───────────────────────────────┤
│ FEATURES (Checklist)          │
│ ├─ ✅ Feature 1               │
│ ├─ ✅ Feature 2               │
│ ├─ ✅ Feature 3               │
│ └─ ❌ Feature 4 (if not incl.)│
├───────────────────────────────┤
│ CTA BUTTON                    │
│ ├─ Primary (if recommended)   │
│ └─ Outline (if not)           │
├───────────────────────────────┤
│ FOOTER (small text)           │
│ └─ Fine print / note          │
└───────────────────────────────┘

STYLING:
- Border: 2px solid (accent color for recommended)
- Shadow: Hover = lift + shadow
- Background: Gradient (subtle) for recommended
- Badge: Absolute positioned, -top-3
- Animation: Fade-in on scroll
Specific Card Designs:

CARD 1: FREE TRIAL (Recommended)
─────────────────────────────────
Border: Purple gradient (2px)
Badge: "🎁 RECOMMENDED" (purple bg)
Icon: Gift emoji
Price: $0
Features:
  ✅ All features unlocked
  ✅ 5,000 chats/month
  ✅ Monetization enabled
  ✅ 7 days free trial
Button: "Start Free Trial" (primary, purple)
Note: "No credit card required"

CARD 2: STARTER
─────────────────────────────────
Border: Gray (1px)
Price: $49/mo
Subtext: "5K chats/month"
Features:
  ✅ Marketplace listing
  ✅ Monetization
  ✅ Email support
  ❌ Custom branding
Button: "Choose Starter" (outline)

CARD 3: GROWTH
─────────────────────────────────
Border: Gray (1px)
Price: $149/mo
Subtext: "25K chats/month"
Features:
  ✅ Everything in Starter
  ✅ Custom branding
  ✅ Priority support
  ✅ Advanced analytics
Button: "Choose Growth" (outline)

CARD 4: SCALE
─────────────────────────────────
Border: Gold gradient (1px)
Badge: "⚡ UNLIMITED" (gold bg)
Price: $499/mo
Subtext: "Unlimited chats"
Features:
  ✅ Everything in Growth
  ✅ Unlimited chats
  ✅ Dedicated manager
  ✅ WhatsApp integration
Button: "Choose Scale" (outline, gold)
📊 COMPARISON TABLE (Below Cards)

┌─────────────────────────────────────────────────────────────┐
│ Compare All Features                                        │
├─────────────────┬───────┬─────────┬────────┬───────────────┤
│ Feature         │ Free  │ Starter │ Growth │ Scale         │
├─────────────────┼───────┼─────────┼────────┼───────────────┤
│ Chats/month     │ 500   │ 5,000   │ 25,000 │ Unlimited     │
│ Monetization    │ ❌    │ ✅      │ ✅     │ ✅            │
│ Marketplace     │ ❌    │ ✅      │ ✅     │ ✅            │
│ Custom branding │ ❌    │ ❌      │ ✅     │ ✅            │
│ Analytics       │ Basic │ Basic   │Advanced│ Advanced      │
│ Support         │ Email │ Email   │Priority│ Dedicated     │
│ WhatsApp        │ ❌    │ ❌      │ ❌     │ ✅            │
│ API access      │ ❌    │ ❌      │ ❌     │ ✅            │
└─────────────────┴───────┴─────────┴────────┴───────────────┘

STYLING:
- Sticky header on scroll
- Zebra striping (alternate row colors)
- Hover: Highlight column
- Mobile: Horizontal scroll with shadow gradient
🎯 FINAL RECOMMENDATIONS
1. Onboarding Path:

Minimal friction → Fast to value → Progressive setup

DO:
✅ 3-question profile (not 10)
✅ 500-word upload (not 3-file minimum)
✅ Let user try AI before asking for payment
✅ Setup as optional checklist

DON'T:
❌ Ask for payment in onboarding
❌ Block user until setup complete
❌ Too many steps upfront
2. Setup Path:

Progressive disclosure → Non-blocking → Checklist UI

DO:
✅ Show checklist in dashboard
✅ Allow skipping (complete later)
✅ Track completion per step
✅ Re-prompt gently (dismissible banner)

DON'T:
❌ Force linear flow
❌ Block dashboard access
❌ Nag user constantly
3. Plan Selection:

Free trial default → Clear comparison → Upgrade path

DO:
✅ Recommend free trial (reduces friction)
✅ Show feature comparison table
✅ Highlight savings (Growth vs Scale)
✅ Allow downgrade (free after trial)

DON'T:
❌ Hide free option
❌ Push expensive plan first
❌ Complicated pricing tiers
✅ IMPLEMENTATION CHECKLIST

PHASE 1: ONBOARDING (2 days)
☐ /onboarding/start (3-question form)
☐ /onboarding/upload (simplified, 500 words)
☐ /onboarding/preview (AI chat test)
☐ /onboarding/complete (choose path)

PHASE 2: SETUP (3 days)
☐ /setup (checklist page)
☐ /setup/pricing (price input + revenue split)
☐ /setup/plan (enhanced cards + comparison table)
☐ /setup/stripe (OAuth flow)
☐ /setup/share (link + embed code)

PHASE 3: DASHBOARD INTEGRATION (1 day)
☐ Setup completion banner (if incomplete)
☐ Progress indicator (2/4 steps done)
☐ Quick links to incomplete steps
☐ Dismiss functionality

PHASE 4: DATABASE (1 day)
☐ Add setupCompleted JSONB field
☐ Track each step completion
☐ Query helper functions
🎯 FINAL FLOW SUMMARY

USER FLOW:
1. Signup (30 sec)
2. Onboarding (2 min) → Try AI
3. Choose: Setup now OR Explore dashboard
4. If explore: Dashboard shows setup banner
5. Complete setup when ready (5 min)
6. Start earning

SKIP LOGIC:
- Onboarding: Cannot skip
- Setup: Can skip entirely
- Plan: Free trial default (no payment required)
- Stripe: Optional (only needed for payouts)

COMPLETION STATES:
- Onboarding only: Can use AI, cannot monetize
- Pricing + Plan: Marketplace live, but no payouts
- Full setup: Everything works, money flows
Batao boss, ye flow sahi hai? Isse implement karna hai? 🚀

Main changes:

Onboarding = Minimal (3 questions, upload, try AI)
Setup = Progressive (checklist, non-blocking)
Plan cards = Enhanced (badges, comparison table)
Dashboard banner = Gentle reminder (dismissible)
Kya implement karu ab? 💪