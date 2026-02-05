
Design: All 7 page layouts — Desktop + Mobile wireframes + flows + mapping
Existing design system study complete. Dark-first, purple accent #8B5CF6, Inter font, shadcn/ui tabs + cards already in deps. Har existing page kaun hai, routes kya hain — sab clear hai. Ab full design output.


╔══════════════════════════════════════════════════════════════════╗
║          S E L F L Y X   —   F I N A L   U I   D E S I G N    ║
║                    Desktop  +  Mobile                           ║
╚══════════════════════════════════════════════════════════════════╝
1 DESIGN TOKENS (existing theme se — change nahi karna)

DARK MODE (default)                  LIGHT MODE
─────────────────                    ─────────────────
bg-primary     #0A0A0B  page bg      #FFFFFF
bg-secondary   #18181B  sidebar/card #F9FAFB
bg-tertiary    #27272A  borders      #F3F4F6
bg-elevated    #3F3F46  hover bg     #E5E7EB

accent-primary #8B5CF6  buttons      #7C3AED
accent-hover   #A78BFA  hover        #6D28D9
accent-glow    rgba(139,92,246, 0.08)  ← active nav bg

text-primary   #FAFAFA              #111827
text-secondary #A1A1AA              #4B5563
text-muted     #52525B              #9CA3AF

border-subtle  #27272A              #E5E7EB
border-default #3F3F46              #D1D5DB

gradient       135deg #8B5CF6 → #6366F1   ← CTA buttons

FONT: Inter  |  ICONS: lucide-react  |  COMPONENTS: shadcn/ui
2 ROLE LOGIC — nav kaise decide hota hai

/api/auth/me  →  { userType }
                        │
          ┌─────────────┴─────────────┐
          │                           │
   "visitor"                    "creator"
          │                           │
          ▼                           ▼
    END USER NAV              CREATOR NAV
    (3 primary items)         (4 primary items
                               + 2 secondary)

  Creator IS also an end user.
  Isliye Creator nav me "Also" section hota hai
  jisme Explore + My Chats milenge —
  koi alag role-switcher NAHI chahiye.
3 NAVIGATION COMPONENTS
3A Desktop Sidebar — Expanded (260px)

┌──────────────────────────────────────┐
│  ◆ Selflyx            [◁ collapse]  │  ← logo left, collapse right
├──────────────────────────────────────┤
│                                      │
│   ╭────────────────────────────╮     │
│   │  ◎  John Doe               │     │  ← user card
│   │      @johndoe              │     │
│   │      ● Creator             │     │  ← role badge (green dot)
│   ╰────────────────────────────╯     │
│                                      │
│   ── Main ─────────────────────      │  ← section label: text-muted 11px
│                                      │
│   ▎📊  Dashboard          ← active  │  ← 3px left border accent
│      bg: accent-glow                 │     + tinted bg
│   🤖  My AI                          │
│   💬  Conversations                  │
│   ⚙   Settings                      │
│                                      │
│   ── Also ─────────────────────      │  ← lighter label, these are
│                                      │    end-user items creators
│   🌍  Explore                        │    can also use
│   📨  My Chats                       │
│                                      │
│   ──────────────────────────         │  ← bottom separator
│                                      │
│   🌙  Dark Mode      [●]            │  ← theme toggle inline
│   🚪  Logout                         │
│                                      │
└──────────────────────────────────────┘

Nav item states:
  default  →  text-secondary, icon gray
  hover    →  bg-elevated, text-primary, icon brighter
  active   →  3px left border #8B5CF6
              bg rgba(139,92,246, 0.08)
              text-primary, icon purple

Item height: 44px  |  padding: 0 20px  |  icon: 18px + 12px gap
Section label: 11px uppercase text-muted, padding-top 20px
3B Desktop Sidebar — Collapsed (72px, icon only)

┌────────┐
│        │
│   ◆    │  ← logo (tap → expand)
│        │
│  ────  │
│        │
│  [av]  │  ← avatar circle only
│        │
│  ────  │
│        │
│   📊   │  ← Dashboard (active: purple icon + subtle glow ring)
│   🤖   │  ← My AI
│   💬   │  ← Conversations
│   ⚙    │  ← Settings
│        │
│  ────  │
│        │
│   🌍   │  ← Explore
│   📨   │  ← My Chats
│        │
│  ────  │
│        │
│   🌙   │  ← Theme toggle
│   🚪   │  ← Logout
│        │
└────────┘

Hover on any icon → tooltip slides in from right:
  "Dashboard", "My AI", etc.

Active icon: purple colored + faint glow ring
All icons: centered, 20px
3C Mobile Bottom Nav + More Sheet

CREATOR  (4 tabs + More)                END USER  (3 tabs + avatar)
─────────────────────                   ─────────────────────
┌─────────────────────┐                 ┌─────────────────────┐
│                     │                 │                     │
│  [page content]     │                 │  [page content]     │
│                     │                 │                     │
├──┬──┬──┬──┬────────┤                 ├──┬──┬──┬───────────┤
│📊│🤖│💬│⚙ │  ⋯    │                 │🌍│📨│⚙ │   [av]    │
│  │  │  │  │       │                 │  │  │  │           │
│Da│AI│Ch│St│ More  │                 │Ex│Ch│St│    Me     │
└──┴──┴──┴──┴────────┘                └──┴──┴──┴───────────┘

Nav bar height: 80px (+ safe-area-inset-bottom)
Active tab: icon + label turn purple (#8B5CF6)
Inactive: icon gray, label text-muted
Icon: 22px, label: 11px

"Me" (End User) → tap → small sheet:
  ┌───────────────────┐
  │  🌙 Dark Mode [●] │
  │  🚪 Logout        │
  └───────────────────┘

"More" (Creator) → bottom sheet slides up:
  ┌───────────────────────┐
  │    ─── (drag) ───     │
  │                       │
  │  🌍  Explore          │
  │  📨  My Chats         │
  │                       │
  │  ─────────────────    │
  │  🌙  Dark Mode  [●]   │
  │  🚪  Logout           │
  └───────────────────────┘
4 END USER PAGES
4A EXPLORE

DESKTOP                                      MOBILE
──────────────────────────────────           ─────────────────────
┌────────┬────────────────────────┐         ┌─────────────────────┐
│Sidebar │  Explore               │         │  Explore            │
│        │  Browse AI clones      │         │  Browse AI clones   │
│        │                        │         │                     │
│        │  ┌────────────────┐    │         │  ┌─────────────┐   │
│        │  │🔍 Search...   │    │         │  │🔍 Search..  │   │
│        │  └────────────────┘    │         │  └─────────────┘   │
│        │                        │         │                     │
│        │  Category pills:       │         │  → horizontal scroll:
│        │  [All][Tech][Business] │         │  [All][Tech][Biz]→  │
│        │  [Creative][Health][+] │         │                     │
│        │                        │         │  Popular ▼          │
│        │  Sort bar:             │         │                     │
│        │  Popular ▼ Trending    │         │  ┌─────────────┐   │
│        │  Newest   Price ↑      │         │  │ [av] TechBot│   │
│        │                        │         │  │ AI coding   │   │
│        │  Card grid (3-col):    │         │  │ tutor       │   │
│        │                        │         │  │ ⭐4.8 • $3  │   │
│        │  ┌───────┐ ┌───────┐  │         │  │ [Chat →]    │   │
│        │  │[av]   │ │[av]   │  │         │  └─────────────┘   │
│        │  │TechBot│ │Creativ│  │         │                     │
│        │  │       │ │  X    │  │         │  ┌─────────────┐   │
│        │  │AI cod.│ │Writing│  │         │  │ [av] CreatX │   │
│        │  │tutor  │ │assist.│  │         │  │ Writing..   │   │
│        │  │       │ │       │  │         │  │ ⭐4.5 • Free│   │
│        │  │⭐4.8   │ │⭐4.5   │  │         │  │ [Chat →]    │   │
│        │  │$3/msg │ │Free   │  │         │  └─────────────┘   │
│        │  │[Chat→]│ │[Chat→]│  │         │                     │
│        │  └───────┘ └───────┘  │         │  ┌─────────────┐   │
│        │  ... (paginated)      │         │  │ ...         │   │
│        │                       │         │  └─────────────┘   │
└────────┴───────────────────────┘         ├──🌍──📨──⚙──[av]─┤
                                           └─────────────────────┘
Card: bg-secondary, border-subtle, radius-8
Hover: lift + border-default
[Chat →]: accent-gradient pill button, full card width
Mobile: 1 col default, 2 col on wider phones (≥480px)
4B MY CHATS

DESKTOP                                      MOBILE
──────────────────────────────────           ─────────────────────
┌────────┬────────────────────────┐         ┌─────────────────────┐
│Sidebar │  My Chats              │         │  My Chats           │
│        │  Your conversations    │         │  Your conversations │
│        │                        │         │                     │
│        │  ┌────────────────┐    │         │  ┌─────────────┐   │
│        │  │🔍 Search...   │    │         │  │🔍 Search..  │   │
│        │  └────────────────┘    │         │  └─────────────┘   │
│        │                        │         │                     │
│        │  Filter pills:         │         │  → scroll:          │
│        │  [All][Paid][Free][⭐]  │         │  [All][Paid][Free]→ │
│        │                        │         │                     │
│        │  ── Today ──           │         │  ── Today ──        │
│        │                        │         │                     │
│        │  ┌────────────────┐    │         │  ┌─────────────┐   │
│        │  │[av] TechBot    │    │         │  │[av] TechBot │   │
│        │  │"Sure, here's   │    │         │  │"Sure here's"│   │
│        │  │ how you can…"  │    │         │  │3 msg • $5   │   │
│        │  │3 msgs • $5 •⭐ │    │         │  └─────────────┘   │
│        │  │2h ago          │    │         │                     │
│        │  └────────────────┘    │         │  ┌─────────────┐   │
│        │                        │         │  │[av] CreatAI │   │
│        │  ┌────────────────┐    │         │  │"Great idea!"│   │
│        │  │[av] CreativeAI │    │         │  │7 msg • Free │   │
│        │  │"Great idea!…"  │    │         │  └─────────────┘   │
│        │  │7 msgs • Free   │    │         │                     │
│        │  │4h ago          │    │         │  ── Yesterday ──    │
│        │  └────────────────┘    │         │                     │
│        │                        │         │  ┌─────────────┐   │
│        │  ── Yesterday ──       │         │  │[av] FinAI   │   │
│        │                        │         │  │"Based on…"  │   │
│        │  ┌────────────────┐    │         │  │12 msg • $3  │   │
│        │  │[av] FinanceAI  │    │         │  └─────────────┘   │
│        │  │"Based on your  │    │         │                     │
│        │  │ portfolio…"    │    │         │  [Load more ↓]      │
│        │  │12 msgs • $3    │    │         │                     │
│        │  │1d ago          │    │         │
│        │  └────────────────┘    │         │
│        │                        │         │
│        │  [Load more ↓]         │         │
│        │                        │         │
└────────┴───────────────────────┘         ├──🌍──📨──⚙──[av]─┤
                                           └─────────────────────┘

Convo card: bg-secondary, border-subtle
  - Left: avatar (40px circle)
  - Right top: creator name bold + time muted right-aligned
  - Right mid: last message preview (1 line truncate)
  - Right bottom: "X msgs • $5" or "Free" badge + ⭐ favorite toggle

Time grouping headers: text-muted 12px uppercase

Click on card → /chat/:handle?sessionId=XXX
4C SETTINGS (End User)

DESKTOP                                      MOBILE
──────────────────────────────────           ─────────────────────
┌────────┬────────────────────────┐         ┌─────────────────────┐
│Sidebar │  Settings              │         │  Settings           │
│        │                        │         │                     │
│        │  ┌──────┬──────┐       │         │  [Profile][Account] │ ← pills
│        │  │Profile│Account│     │         │                     │
│        │  └──────┴──────┘       │         │  [Profile active]   │
│        │                        │         │                     │
│        │  [Profile active]      │         │  ┌─────────────┐   │
│        │                        │         │  │   [avatar]  │   │
│        │  ┌────────────────┐    │         │  │  [Change]   │   │
│        │  │                │    │         │  └─────────────┘   │
│        │  │   [avatar]     │    │         │                     │
│        │  │   [Change]     │    │         │  Display Name       │
│        │  │                │    │         │  ┌─────────────┐   │
│        │  └────────────────┘    │         │  │ John Doe    │   │
│        │                        │         │  └─────────────┘   │
│        │  Display Name          │         │                     │
│        │  ┌────────────────┐    │         │  Bio                │
│        │  │ John Doe       │    │         │  ┌─────────────┐   │
│        │  └────────────────┘    │         │  │ Hello I'm…  │   │
│        │                        │         │  └─────────────┘   │
│        │  Bio                   │         │                     │
│        │  ┌────────────────┐    │         │  [Save Changes]     │
│        │  │ Hello, I'm…    │    │         │                     │
│        │  └────────────────┘    │         │
│        │                        │         │  ── Account tab ──  │
│        │  [Save]                │         │  Email • Password   │
│        │                        │         │  Notifications      │
│        │  ────────────────      │         │  Appearance         │
│        │                        │         │  Danger Zone        │
│        │  [Account tab]         │         │                     │
│        │  • Email (read-only)   │         │
│        │  • Password change     │         │
│        │  • Notifications       │         │
│        │    (email • alerts)    │         │
│        │  • Appearance          │         │
│        │    (theme • language)  │         │
│        │  • ── Danger Zone ──   │         │
│        │    [Delete Account]    │         │
└────────┴───────────────────────┘         ├──🌍──📨──⚙──[av]─┤
                                           └─────────────────────┘
5 CREATOR PAGES
5A DASHBOARD

DESKTOP                                      MOBILE
──────────────────────────────────           ─────────────────────
┌────────┬────────────────────────┐         ┌─────────────────────┐
│Sidebar │  Dashboard             │         │  Dashboard          │
│        │  Your AI performance   │         │  Your AI performance│
│        │                        │         │                     │
│        │  Stats cards (1 row):  │         │  Stats: 2×2 grid    │
│        │                        │         │                     │
│        │  ┌─────┐┌─────┐┌────┐ │         │  ┌────┬────┐       │
│        │  │💬   ││💰   ││👥  │ │         │  │💬  │💰  │       │
│        │  │247  ││$138 ││ 12 │ │         │  │247 │$138│       │
│        │  │+12↑ ││+23↑ ││+2↑ │ │         │  │+12↑│+23↑│       │
│        │  │/week││/mo  ││/mo │ │         │  └────┴────┘       │
│        │  └─────┘└─────┘└────┘ │         │  ┌────┬────┐       │
│        │  ┌─────┐              │         │  │👥  │⭐  │       │
│        │  │⭐4.7 │              │         │  │ 12 │4.7 │       │
│        │  │89%+ │              │         │  │+2↑ │89%+│       │
│        │  └─────┘              │         │  └────┴────┘       │
│        │                        │         │                     │
│        │  2-col layout:         │         │  Activity Feed      │
│        │                        │         │  ──────────         │
│        │  ┌───────┐ ┌────────┐ │         │                     │
│        │  │Activit│ │Top Q's │ │         │  2m • New chat      │
│        │  │y Feed │ │(chart) │ │         │  John started…      │
│        │  │       │ │        │ │         │                     │
│        │  │2m ago │ │"How…"██│ │         │  15m • Chat ended   │
│        │  │ chat  │ │"What…"█│ │         │  Sarah • $5 earned  │
│        │  │ John  │ │"Tell…"█│ │         │                     │
│        │  │       │ │   │ │         │  1h • New chat      │
│        │  │15m ago│ │        │ │         │  Mike started…      │
│        │  │ ended │ │        │ │         │                     │
│        │  │ $5    │ │        │ │         │  Recent Convos      │
│        │  └───────┘ └────────┘ │         │  ──────────         │
│        │                        │         │                     │
│        │  ┌────────────────┐    │         │  John D. • $5  [→] │
│        │  │Recent Convos   │    │         │  Sarah M. • Free[→] │
│        │  │                │    │         │  Mike R. • $3  [→] │
│        │  │ John D.  $5 [→]│    │         │                     │
│        │  │ Sarah M. Free[→│    │         │  [View all →]       │
│        │  │ Mike R.  $3 [→]│    │         │                     │
│        │  │                │    │         │
│        │  │ [View all →]   │    │         │
│        │  └────────────────┘    │         │
└────────┴───────────────────────┘         ├──📊─🤖──💬──⚙─⋯─┤
                                           └─────────────────────┘

Stat cards: bg-secondary, border-subtle
  - Icon top-left, value big bold, delta green ↑ or red ↓, period muted
  - Cards scale: 4 across desktop, 2×2 mobile

Activity Feed: real-time (poll 5s)
  - Each item: time ago | event type | name | value

Top Questions: recharts BarChart (horizontal bars)
  - Already exists in CreatorDashboardPage

Recent Convos:
  - Max 5 shown here
  - [→] links to /conversations/:sessionId
  - "View all →" links to /conversations
5B MY AI (Setup / Train / Preview)

DESKTOP                                      MOBILE
──────────────────────────────────           ─────────────────────
┌────────┬────────────────────────┐         ┌─────────────────────┐
│Sidebar │  My AI                 │         │  My AI              │
│        │  Configure your clone  │         │  Configure your clone│
│        │                        │         │                     │
│        │  ┌──────┬─────┬──────┐ │         │  [Setup][Train][Prv]│ ← scroll pills
│        │  │Setup │Train│Preview│ │         │                     │
│        │  └──────┴─────┴──────┘ │         │  ── SETUP ──        │
│        │                        │         │                     │
│        │  ── SETUP ──           │         │  ┌─────────────┐   │
│        │                        │         │  │   [avatar]  │   │
│        │  Avatar                │         │  │  [Change]   │   │
│        │  ┌──────┐              │         │  └─────────────┘   │
│        │  │[av]  │ [Change]     │         │                     │
│        │  └──────┘  [Remove]    │         │  AI Name *          │
│        │                        │         │  ┌─────────────┐   │
│        │  AI Name *             │         │  │  TechBot    │   │
│        │  ┌────────────────┐    │         │  └─────────────┘   │
│        │  │ TechBot        │    │         │                     │
│        │  └────────────────┘    │         │  Bio *              │
│        │                        │         │  ┌─────────────┐   │
│        │  Bio *                 │         │  │  I'm an AI… │   │
│        │  ┌────────────────┐    │         │  └─────────────┘   │
│        │  │ I'm an AI that │    │         │                     │
│        │  │ helps with..   │    │         │  Expertise          │
│        │  └────────────────┘    │         │  [Python×][React×]+ │
│        │                        │         │                     │
│        │  Expertise Areas       │         │  Topics             │
│        │  ┌────────────────┐    │         │  [Tech ✓][Business ]│
│        │  │[Python×][React×]+│  │         │                     │
│        │  └────────────────┘    │         │  Personality        │
│        │                        │         │  [Friendly ▼]       │
│        │  Topics                │         │                     │
│        │  [Tech ✓][Business ]   │         │  Greeting           │
│        │  [Health ][Creative ]  │         │  ┌─────────────┐   │
│        │                        │         │  │ "Hi! I'm… " │   │
│        │  Personality Style     │         │  └─────────────┘   │
│        │  [Friendly ▼]         │         │                     │
│        │                        │         │  [Save Changes]     │
│        │  Default Greeting      │         │                     │
│        │  ┌────────────────┐    │         │
│        │  │ "Hi! I'm Tech…"│    │         │
│        │  └────────────────┘    │         │
│        │                        │         │
│        │  [Save Changes]        │         │
└────────┴───────────────────────┘         ├──📊─🤖──💬──⚙─⋯─┤
                                           └─────────────────────┘
Train tab:


── TRAIN TAB ──

  ┌─────────────────────────────────────────┐
  │  Knowledge Base                         │  ← section heading
  │                                         │
  │  ╭─── Drop files here ──────────────╮  │
  │  │                                   │  │
  │  │   📂  or click to browse          │  │  ← drag-drop zone
  │  │   PDF · DOCX · TXT               │  │
  │  │                                   │  │
  │  ╰───────────────────────────────────╯  │
  │                                         │
  │  Uploaded files:                        │
  │  ┌─────────────────────────────────┐   │
  │  │ 📄 getting-started.pdf          │   │
  │  │    32 KB  •  Added today        │   │
  │  │    [Preview]  [✕ Remove]       │   │
  │  ├─────────────────────────────────┤   │
  │  │ 📄 faq-document.docx            │   │
  │  │    45 KB  •  Added 3d ago       │   │
  │  │    [Preview]  [✕ Remove]       │   │
  │  └─────────────────────────────────┘   │
  │                                         │
  │  [+ Add URL]  [+ Upload file]          │
  └─────────────────────────────────────────┘

  ┌─────────────────────────────────────────┐
  │  Instructions / Rules                   │  ← section heading
  │                                         │
  │  ┌───────────────────────────────────┐  │
  │  │ Always be helpful and             │  │
  │  │ professional. Do NOT discuss      │  │  ← textarea
  │  │ competitors. Focus on Python      │  │
  │  │ and React topics only.            │  │
  │  └───────────────────────────────────┘  │
  │                                         │
  │  Tone                                   │
  │  ┌───────────────────────────────────┐  │
  │  │ Casual but informative            │  │
  │  └───────────────────────────────────┘  │
  └─────────────────────────────────────────┘

  [Save & Retrain]  ← accent gradient button
                       shows spinner on click until done

Mobile Train: same layout stacked, drag-drop becomes
  [+ Upload] button only (no drag on mobile)
Preview tab:


── PREVIEW TAB ──

  ┌─────────────────────────────────────────┐
  │  Preview: Chat with your AI             │  ← header
  │  "See how users will experience it"     │
  │                                         │
  │  ┌─────────────────────────────────┐   │
  │  │  🤖 TechBot                     │   │
  │  │  "Hi! I'm TechBot, your coding  │   │
  │  │   assistant. How can I help?"   │   │
  │  │                                 │   │
  │  │  You                            │   │
  │  │  "How do I use React hooks?"    │   │
  │  │                                 │   │
  │  │  🤖 TechBot                     │   │
  │  │  "React hooks are functions     │   │
  │  │   that let you use state…"      │   │
  │  └─────────────────────────────────┘   │
  │                                         │
  │  ┌───────────────────────────────────┐  │
  │  │  Type a test message...           │  │  ← input
  │  └───────────────────────────────────┘  │
  │                                         │
  │  [↺ Reset Session]  [🗑 Clear]         │
  │                                         │
  │  Quick test:                            │
  │  ["How do I start?"]  ["What can you…"] │  ← tappable chips
  │  ["Tell me about pricing"]             │
  └─────────────────────────────────────────┘

  Preview panel reuses MirrorPage logic internally.
  Mobile: same full-width layout, works perfectly.
5C CONVERSATIONS

DESKTOP  (split-pane layout)                 MOBILE (list → detail push)
──────────────────────────────               ─────────────────────────

┌────────┬──────────┬───────────────┐       ┌─────────────────────┐
│Sidebar │  List    │  Detail       │       │  Conversations      │
│        │  pane    │  pane         │       │                     │
│        │          │               │       │  [🔍 Search]        │
│        │ Convo-   │               │       │  [All][Paid][Free]  │
│        │ rsations │  ← empty:    │       │                     │
│        │          │  "Select a    │       │  ┌─────────────┐   │
│        │ [🔍]    │   conversation"│       │  │● John D.    │   │
│        │          │               │       │  │  "How do I…"│   │
│        │ [All|Paid│  ← selected:  │       │  │  2h • $5    │   │
│        │  |Free]  │               │       │  └─────────────┘   │
│        │          │  User info:   │       │                     │
│        │  ● John  │  ┌─────────┐ │       │  ┌─────────────┐   │
│        │    "How…"│  │ John D. │ │       │  │○ Sarah M.   │   │
│        │    2h •$5│  │ 2h ago  │ │       │  │  "Tell me…" │   │
│        │          │  │ 12 msgs │ │       │  │  1d • Free  │   │
│        │  ○ Sarah │  │ $5.00   │ │       │  └─────────────┘   │
│        │    "Tell…│  └─────────┘ │       │                     │
│        │    1d •Fre│              │       │  ┌─────────────┐   │
│        │          │  Messages:    │       │  │● Mike R.    │   │
│        │  ● Mike  │  ┌─────────┐ │       │  │  "What's…"  │   │
│        │    "What…│  │ John:   │ │       │  │  3d • $3    │   │
│        │    3d •$3│  │ "How…"  │ │       │  └─────────────┘   │
│        │          │  │ AI:     │ │       │                     │
│        │  [Load   │  │ "Sure…" │ │       │  [Load more ↓]      │
│        │   more]  │  │ John:   │ │       │                     │
│        │          │  │ "Thanks"│ │       │  ── Tap → pushes: ──│
│        │          │  └─────────┘ │       │                     │
│        │          │              │       │  ┌─────────────┐   │
│        │          │  ← scroll   │       │  │← John Doe   │   │
│        │          │              │       │  │ 12 msgs•$5  │   │
└────────┴──────────┴───────────────┘       │  ─────────── │   │
                                           │  John: How…  │   │
List pane: 320px, scrollable                │  AI: Sure…   │   │
Detail pane: flex-grow, fills rest          │  John: Thanks│  │
● = paid  ○ = free                          │  └─────────────┘  │
Active row: bg-tertiary + purple left edge  ├──📊─🤖──💬──⚙─⋯─┤
                                           └─────────────────────┘
5D SETTINGS (Creator — 4 tabs)

DESKTOP                                      MOBILE
──────────────────────────────────           ─────────────────────
┌────────┬────────────────────────┐         ┌─────────────────────┐
│Sidebar │  Settings              │         │  Settings           │
│        │                        │         │                     │
│        │  ┌─────┬─────┬───┬───┐ │         │  [Pro][Pri][Int][Ac]│ ← scroll pills
│        │  │Prof.│Price│Int│Acc│ │         │                     │
│        │  └─────┴─────┴───┴───┘ │         │  [Profile active]   │
│        │                        │         │                     │
│        │  ── PROFILE ──         │         │  ┌─────────────┐   │
│        │                        │         │  │   [avatar]  │   │
│        │  [avatar]  [Change]    │         │  │  [Change]   │   │
│        │                        │         │  └─────────────┘   │
│        │  Display Name          │         │                     │
│        │  ┌────────────────┐    │         │  Display Name       │
│        │  │ John Doe       │    │         │  ┌─────────────┐   │
│        │  └────────────────┘    │         │  │ John Doe    │   │
│        │                        │         │  └─────────────┘   │
│        │  Bio                   │         │                     │
│        │  ┌────────────────┐    │         │  Bio                │
│        │  │ Building AI…   │    │         │  ┌─────────────┐   │
│        │  └────────────────┘    │         │  │ Building…   │   │
│        │                        │         │  └─────────────┘   │
│        │  Social Links          │         │                     │
│        │  ┌───────┬────────┐    │         │  Social Links       │
│        │  │Twitter│@handle │    │         │  Twitter [input]    │
│        │  │Insta  │empty   │    │         │  Instagram [input]  │
│        │  │YouTube│empty   │    │         │  YouTube [input]    │
│        │  │Website│.com    │    │         │  Website [input]    │
│        │  └───────┴────────┘    │         │                     │
│        │                        │         │  Public Profile     │
│        │  Public Profile        │         │  [toggle ●] [→]    │
│        │  [toggle ●ON]          │         │                     │
│        │  /@johndoe  [→]        │         │  [Save Changes]     │
│        │                        │         │                     │
│        │  [Save Changes]        │         │
└────────┴───────────────────────┘         ├──📊─🤖──💬──⚙─⋯─┤
                                           └─────────────────────┘
Pricing tab:


── PRICING ──

  Free Messages (users get X free)
  ┌──────┐
  │  3   │  ← number stepper
  └──────┘

  Pay-per-Chat Tiers
  ┌────┐ ┌────┐ ┌────┐ ┌────┐
  │ $1 │ │ $3 │ │ $5 │ │$10 │    ← selectable chips
  └────┘ └────┘ └────┘ └────┘       (● = default tier)
                 ● default
  [+ Add tier]  [Edit]

  Welcome Message
  ┌─────────────────────────────┐
  │ "Hi! Feel free to ask me    │
  │  anything. I'm here to…"    │
  └─────────────────────────────┘

  Suggested Questions
  ┌─────────────────────────────┐
  │ [How do I start?  ×]        │
  │ [What's the cost? ×]        │
  │ [+ Add question]            │
  └─────────────────────────────┘

  [Save]
Integrations tab:


── INTEGRATIONS ──

  Widget Embed Code
  ┌─────────────────────────────────┐
  │  <script                        │
  │    src="https://selflyx.com/…"  │
  │    data-handle="johndoe">       │
  │  </script>                      │
  └─────────────────────────────────┘
  [📋 Copy Code]   [👁 Preview]

  Widget Color
  ┌─────┐
  │  ●  │  ← color picker (accent purple default)
  └─────┘

  ─────────────────────────────

  API Keys
  ┌─────────────────────────────┐
  │ sk_live_●●●●●●●●●●●●●●●●  │
  │ Created: Jan 15, 2026       │
  │ [Show]  [↻ Rotate]         │
  └─────────────────────────────┘

  [+ Generate New Key]
Account tab:


── ACCOUNT ──

  Email
  john@example.com   [Creator]     ← badge, read-only

  Password
  ┌─────────────────────┐
  │ Current  ••••••••   │
  │ New      ••••••••   │
  │ Confirm  ••••••••   │
  └─────────────────────┘

  Plan & Billing
  ┌─────────────────────┐
  │ [Pro]  $29/mo       │
  │ Renews  Feb 28      │
  │ [Manage Billing]    │
  └─────────────────────┘

  Earnings
  ┌─────────────────────┐
  │ Total    $1,240     │
  │ Available $138      │
  │ [Request Payout]    │
  └─────────────────────┘

  Appearance
  Theme:    [Dark ●]  [Light]
  Language: [English ▼]

  ─── Danger Zone ───
  [Delete Account]    ← red, requires confirmation modal
6 KEY INTERACTION FLOWS

FLOW 1: Login → Landing
─────────────────────────
  Logged out  →  / → LandingPage (marketing)
  Logged in   →  / → HomeRoute detects role:
                       creator  → /dashboard
                       visitor  → /explore

FLOW 2: End User discovers + chats
─────────────────────────────────────
  Explore → browse cards → [Chat →]
       ↓
  /chat/:handle  (PublicChatPage — full screen, no sidebar)
       ↓
  Chat appears in My Chats → can resume anytime

FLOW 3: Creator sets up AI (first time)
────────────────────────────────────────
  Dashboard → "Your AI isn't set up" banner  ← empty state
       ↓ [Set up My AI]
  My AI → Setup tab (pre-filled empty)
       ↓ [Save]
  My AI → Train tab (upload knowledge base)
       ↓ [Save & Retrain]
  My AI → Preview tab (test it live)
       ↓ looks good
  Done! Dashboard now shows live stats

FLOW 4: Creator monitors
──────────────────────────
  Dashboard → sees real-time activity
       ↓ [View all →]
  Conversations → list of all chats
       ↓ tap one
  Detail pane opens (desktop) / pushes (mobile)

FLOW 5: Mobile "More" access
──────────────────────────────
  Creator bottom nav: [Dash][MyAI][Chat][Set][⋯]
       ↓ tap ⋯
  Sheet: Explore, My Chats, Logout
7 PAGE → EXISTING CODE MAP

┌─────────────────────┬──────────┬─────────────────────────────┐
│ New Nav Item        │ Tab      │ Current File(s) to use       │
├─────────────────────┼──────────┼─────────────────────────────┤
│ Explore             │  —       │ MarketplacePage.tsx          │
│ My Chats            │  —       │ MyChatsPage.tsx              │
│ End User Settings   │ Profile  │ MyProfilePage.tsx → merge   │
│ End User Settings   │ Account  │ SettingsPage.tsx (Acct tabs) │
├─────────────────────┼──────────┼─────────────────────────────┤
│ Dashboard           │  —       │ CreatorDashboardPage.tsx     │
│ My AI               │ Setup    │ IdentitySetupPage.tsx +      │
│                     │          │ IdentityEditPage.tsx          │
│ My AI               │ Train    │ KnowledgeBasePage.tsx +      │
│                     │          │ instructions form (new)      │
│ My AI               │ Preview  │ MirrorPage.tsx               │
│ Conversations       │  —       │ CreatorConversationsPage.tsx │
│                     │ (detail) │ CreatorConversationDetailPage│
│ Creator Settings    │ Profile  │ SettingsPage Profile tab +   │
│                     │          │ MyProfilePage.tsx (social)   │
│ Creator Settings    │ Pricing  │ SettingsPage Billing +       │
│                     │          │ Payment config sections      │
│ Creator Settings    │ Integr.  │ Integrations.tsx             │
│ Creator Settings    │ Account  │ SettingsPage Acct/Security   │
└─────────────────────┴──────────┴─────────────────────────────┘

Routes — mostly STAY as they are.
New routes needed:
  /my-ai          → MyAIPage  (wrapper with 3 tabs)
                     internally loads Setup/Train/Preview

Changed routes:
  /explore        → keep (already exists, uses MarketplacePage)
  /identity/setup → becomes tab inside /my-ai  (redirect old URL)
  /identity/edit  → becomes tab inside /my-ai
  /mirror         → becomes tab inside /my-ai
  /knowledge      → becomes tab inside /my-ai (Train)
  /my-profile     → redirect → /settings#profile
8 DECISIONS — FINAL (implemented)

1. Sidebar collapse threshold
   → DONE: Initial state = expanded if window.innerWidth >= 1400, else collapsed.
     CSS hides sidebar entirely below lg (1024px); mobile uses bottom nav only.
     Manual toggle chevron always visible in sidebar header.

2. Creator Settings tabs
   → DONE: 4 pills with horizontal scroll (overflow-x-auto).
     Creator: [Profile][Pricing][Integrations][Account]
     End User: [Profile][Account]
     Tab array is role-conditional in JSX.

3. Dashboard empty state
   → DONE: When aiStatus === 'not_setup', a gradient onboarding banner renders
     above the metric cards with "Set up My AI" button → /my-ai?tab=setup.
     Metric cards still render (show zeros) below the banner.

4. /explore vs /marketplace
   → DONE: /explore kept as primary. /marketplace flag-gated routes remain.

5. My AI page — tab state
   → DONE: URL-based via useSearchParams. /my-ai?tab=setup|train|preview.
     Defaults to 'setup' if no tab param.
Update Todos

Study existing codebase — pages, nav, design system, theme tokens

Design: All navigation + page layouts — Desktop + Mobile + Flows + Mapping
Design complete. Summary of what's above:

Navigation — Sidebar (desktop, expanded + collapsed) and Bottom Nav (mobile) designed to existing dark purple theme. No new color tokens needed.

7 pages total, every one has both desktop and mobile wireframe:

Role	Page	Key layout note
End User	Explore	3-col card grid (desktop), 1-col stack (mobile)
End User	My Chats	Time-grouped list, click opens chat
End User	Settings	2 tabs: Profile, Account
Creator	Dashboard	Stat cards row + 2-col activity/charts grid
Creator	My AI	3 tabs: Setup / Train / Preview — tab-based routing
Creator	Conversations	Split pane (desktop) / list→push detail (mobile)
Creator	Settings	4 tabs: Profile / Pricing / Integrations / Account
Code mapping in Section 7 shows exactly which existing files map where — no files need to be deleted, mostly reorganized into tab wrappers.

All 5 open decisions resolved and implemented (see Section 8 above).

9 IMPLEMENTATION STATUS — COMPLETE ✓

New files created:
  src/components/Sidebar.tsx        — desktop sidebar (expanded/collapsed)
  src/components/MobileNav.tsx      — mobile bottom nav + more/me sheet
  src/pages/MyAIPage.tsx            — /my-ai tab wrapper (setup|train|preview)

Files modified:
  src/components/Layout.tsx         — replaced Navbar with Sidebar + MobileNav, role-aware
  src/App.tsx                       — added /my-ai route, 4 redirects (/identity/edit, /mirror, /knowledge, /my-profile)
  src/pages/IdentityEditPage.tsx    — added embedded prop + conditional Layout wrapper
  src/pages/KnowledgeBasePage.tsx   — added embedded prop + conditional Layout wrapper
  src/pages/Integrations.tsx        — added embedded prop + conditional Layout wrapper
  src/pages/CreatorDashboardPage.tsx— fixed header button routes, added empty-state onboarding banner
  src/pages/SettingsPage.tsx        — role-based tab array, remapped all tab conditions,
                                      added IntegrationsPage embedded in integrations tab

TypeScript: tsc --noEmit passed with 0 errors.