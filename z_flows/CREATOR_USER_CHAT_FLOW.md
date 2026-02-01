# Creator-to-User Chat Flow - Complete Documentation

## Overview

This document explains how end users interact with a creator's AI clone on the platform. The flow is straightforward: Creator creates AI → Gets unique link → Shares link → Users chat with AI clone.

---

## 1. Creator Onboarding & Setup

### Step 1: Signup & Profile Creation
**File:** [SignupProfilePage.tsx](frontend/react-app/src/pages/SignupProfilePage.tsx)

Creator provides:
- ✅ **Email** (verified via OTP)
- ✅ **Name** (e.g., "John Doe")
- ✅ **Username** (e.g., "johndoe") - **CRITICAL: This creates the chat link**
- ✅ **Profile Image** (optional)
- ✅ **Phone** (optional)

**Result:** Creator's profile URL is created: `/@johndoe`

### Step 2: Personality Quiz (10 Questions)
**File:** [OnboardingQuizPage.tsx](frontend/react-app/src/pages/OnboardingQuizPage.tsx)

Creator answers questions about:
1. Expertise area (business, tech, creative, etc.)
2. Communication style (casual/professional, brief/detailed)
3. Target audience
4. Topics to cover
5. Topics to avoid
6. Language preference
7. Example questions people might ask
8. Response length preference
9. Emoji usage
10. Personality traits (3 words)

**Result:** AI personality is defined

### Step 3: Content Upload
**File:** [OnboardingContentPage.tsx](frontend/react-app/src/pages/OnboardingContentPage.tsx)

Creator uploads knowledge sources:
- 📄 **Files:** PDF, DOCX, TXT, MD, XLSX, CSV
- ✍️ **Text:** Direct paste
- 🎥 **YouTube:** Video transcripts
- 🔗 **URLs:** Medium, Substack, blogs
- 📱 **Social:** Twitter, Instagram, LinkedIn

**Minimum:** 3 items (500+ words recommended)
**Quality Score:** Excellent (10K+ words), Great (5K+), Good (2K+)

**Result:** AI knowledge base is populated

### Step 4: AI Training
**File:** [OnboardingTrainingPage.tsx](frontend/react-app/src/pages/OnboardingTrainingPage.tsx)

Backend processes:
1. Text extraction from all sources
2. Chunking content into segments
3. Creating embeddings
4. Building personality rules
5. Training AI model

**Time:** ~5 minutes per MB of content
**Status:** Tracked via `/api/identity/training-status`

**Result:** AI clone is ready

### Step 5: Deployment & Chat Link
**File:** [OnboardingDeployPage.tsx](frontend/react-app/src/pages/OnboardingDeployPage.tsx)

**🎉 Chat Link Displayed Prominently:**
- Large green card at top showing: `https://app.selflyx.com/chat/username`
- Copy button + Test Chat button
- Clear instructions: "Share this link with your audience"

**Deployment Options:**
1. **Standalone Link** - Direct chat URL (MAIN FEATURE)
2. **Website Embed** - Customizable widget
3. **WhatsApp Business** - Integration
4. **Instagram DMs** - Integration

**Complete Setup Button:**
- Calls `/api/creator/onboarding/complete`
- Sets `onboardingCompleted = true` + `onboardingStep = 'done'`
- Redirects to Dashboard

**Result:** Creator gets chat link + onboarding marked complete

---

## 2. The Critical Link: Username → Chat URL

### How It Works

```
Creator Username: "johndoe"
       ↓
Profile URL: https://app.selflyx.com/@johndoe
       ↓
Chat URL: https://app.selflyx.com/chat/johndoe
       ↓
Embed Widget: <script data-creator-slug="johndoe">
```

### Database Schema

```sql
-- User table (database.ts line 8-44)
CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT UNIQUE NOT NULL,
  "handle" TEXT UNIQUE,  -- The username (e.g., "johndoe")
  "name" TEXT,           -- Display name (e.g., "John Doe")
  "profileImage" TEXT,   -- Avatar URL
  "publicSlug" TEXT,     -- Alternative slug (optional)
  ...
);
```

### Routing Logic

**Backend Route:** `/chat/:slug`
```typescript
// File: backend/src/app.ts or similar
app.get('/chat/:slug', async (req, res) => {
  const slug = req.params.slug; // "johndoe"

  // Find creator by handle
  const creator = await db.query(
    'SELECT * FROM "User" WHERE handle = $1 OR "publicSlug" = $1',
    [slug]
  );

  if (!creator) {
    return res.status(404).send('Creator not found');
  }

  // Serve chat interface
  res.render('chat', { creator });
});
```

**Frontend Route:** `/chat/:slug`
**File:** [App.tsx](frontend/react-app/src/App.tsx)
```typescript
<Route path="/chat/:slug" element={<PublicChatPage />} />
```

---

## 3. End User Chat Flow

### Scenario: User Clicks Creator's Link

**Step 1: User Opens Link**
```
User clicks: https://app.selflyx.com/chat/johndoe
     ↓
Frontend loads: PublicChatPage component
     ↓
Fetches creator info: GET /api/public/creator/johndoe
```

**Step 2: Chat Interface Loads**
**File:** Likely `PublicChatPage.tsx` or `MirrorPage.tsx`

Interface shows:
- Creator's name & avatar
- Welcome message
- Input box for questions
- Popular questions (if configured)
- Voice chat button (if voice clone enabled)

**Step 3: User Sends Message**
```
User types: "How do I start a business?"
     ↓
Frontend sends: POST /api/chat/send
     ↓
Backend processes:
  1. Finds creator by slug
  2. Loads AI identity & knowledge
  3. Generates response using LLM
  4. Returns response
     ↓
Frontend displays AI response
```

### Backend Chat Endpoint

**Likely File:** `backend/src/modules/chat/chatController.ts`
```typescript
export async function sendMessage(req: Request, res: Response) {
  const { slug, message, sessionId } = req.body;

  // 1. Find creator
  const creator = await userQueries.findByHandle(slug);
  if (!creator) {
    return res.status(404).json({ error: 'Creator not found' });
  }

  // 2. Load AI identity
  const identity = await identityQueries.findByUserId(creator.id);
  if (!identity || identity.status !== 'ready') {
    return res.status(503).json({ error: 'AI not ready' });
  }

  // 3. Create or load conversation
  let conversation = await chatQueries.findBySessionId(sessionId);
  if (!conversation) {
    conversation = await chatQueries.create({
      userId: creator.id,
      sessionId,
      visitorId: req.ip,
    });
  }

  // 4. Store user message
  await messageQueries.create({
    conversationId: conversation.id,
    content: message,
    role: 'user',
  });

  // 5. Generate AI response
  const aiResponse = await generateAIResponse({
    identity,
    message,
    conversationHistory: conversation.messages,
  });

  // 6. Store AI response
  await messageQueries.create({
    conversationId: conversation.id,
    content: aiResponse,
    role: 'assistant',
  });

  // 7. Return response
  return res.json({
    response: aiResponse,
    conversationId: conversation.id,
  });
}
```

---

## 4. Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ CREATOR SIDE                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Signup → Email: john@example.com                            │
│  2. Profile → Username: "johndoe" (CREATES LINK)                │
│  3. Quiz → Personality: Professional, Tech Expert               │
│  4. Upload → Content: 10 blog posts, 5 PDFs                     │
│  5. Training → AI processes content (~15 mins)                  │
│  6. Deploy → Gets Links:                                        │
│              • https://app.selflyx.com/@johndoe (Profile)       │
│              • https://app.selflyx.com/chat/johndoe (Chat)      │
│              • Embed code for website                            │
│  7. Share → Posts link on Twitter/Bio/Website                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

                              ↓ SHARE LINK ↓

┌─────────────────────────────────────────────────────────────────┐
│ END USER SIDE                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User clicks: https://app.selflyx.com/chat/johndoe          │
│  2. Page loads with:                                            │
│     • John Doe's profile picture                                │
│     • "Chat with John's AI" title                               │
│     • Input box: "Ask me anything..."                           │
│     • Popular questions:                                        │
│       - "How do I start a business?"                            │
│       - "What's your tech stack?"                               │
│  3. User types: "How do I start a business?"                    │
│  4. AI responds instantly (using John's knowledge):             │
│     "Based on my experience, here's how to start..."            │
│  5. Conversation continues with context awareness               │
│  6. User can:                                                   │
│     • Ask follow-up questions                                   │
│     • Start voice chat (if enabled)                             │
│     • Rate responses (👍 👎)                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

                         ↓ BACKEND PROCESSING ↓

┌─────────────────────────────────────────────────────────────────┐
│ BACKEND (How AI Responds)                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Request: POST /api/chat/send                                   │
│  Body: { slug: "johndoe", message: "How to start business?" }  │
│                                                                  │
│  Processing:                                                     │
│  1. Find creator: WHERE handle = 'johndoe'                      │
│  2. Load identity: Personality rules + Knowledge chunks         │
│  3. Build context:                                              │
│     • Conversation history (last 10 messages)                   │
│     • Relevant knowledge chunks (via vector search)             │
│     • Personality instructions                                  │
│  4. Call LLM (OpenAI/Anthropic):                                │
│     System: "You are John, a tech expert..."                    │
│     Context: [Knowledge chunks about business]                  │
│     User: "How do I start a business?"                          │
│  5. Get response: "Based on my experience..."                   │
│  6. Store message + response in database                        │
│  7. Return to user                                              │
│                                                                  │
│  Response time: ~2-5 seconds                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Key Database Tables

### User (Creator)
```sql
CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT UNIQUE,
  "handle" TEXT UNIQUE,        -- Username for chat link
  "name" TEXT,                  -- Display name
  "profileImage" TEXT,          -- Avatar
  "publicSlug" TEXT UNIQUE,     -- Alternative slug
  "onboardingStep" TEXT,        -- Progress tracking
  "planTier" TEXT               -- Free/Pro/Growth/Scale
);
```

### Identity (AI Clone)
```sql
CREATE TABLE "identities" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES "User"(id),
  "personality" JSONB,          -- Quiz answers
  "status" TEXT,                -- ready/training/failed
  "createdAt" TIMESTAMPTZ
);
```

### Knowledge Sources
```sql
CREATE TABLE "knowledge_sources" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES "User"(id),
  "type" TEXT,                  -- file/paste/youtube/url
  "title" TEXT,
  "rawText" TEXT,               -- Extracted content
  "status" TEXT                 -- processed/pending/failed
);
```

### Conversations (Chat Sessions)
```sql
CREATE TABLE "conversations" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES "User"(id),  -- Creator
  "visitorId" TEXT,             -- End user (anonymous)
  "sessionId" TEXT UNIQUE,      -- Browser session
  "createdAt" TIMESTAMPTZ
);
```

### Messages
```sql
CREATE TABLE "messages" (
  "id" TEXT PRIMARY KEY,
  "conversationId" TEXT REFERENCES "conversations"(id),
  "role" TEXT,                  -- user/assistant
  "content" TEXT,               -- Message text
  "createdAt" TIMESTAMPTZ
);
```

---

## 6. Monetization Flow (Optional)

### Paid Chats
If creator enables paid chats in plan settings:

```
1. User opens: /chat/johndoe
2. Sees pricing: $5 for 10 messages
3. Clicks "Start Chat" → Redirects to Stripe
4. Payment successful → Chat unlocked
5. Messages tracked: 1/10 used
6. Creator earns: $3.75 (75% of $5)
```

### Widget Analytics
Creator dashboard shows:
- Total conversations
- Messages sent/received
- Response satisfaction rate
- Peak usage times
- Revenue earned

---

## 7. Advanced Features

### Voice Chat
If creator has voice clone:
```
1. User clicks microphone icon
2. Browser records audio
3. Sends to backend: POST /api/chat/voice
4. Backend:
   • Transcribes audio (Whisper API)
   • Gets AI text response
   • Converts to speech (ElevenLabs)
   • Returns audio file
5. User hears AI voice response
```

### WhatsApp Integration
```
1. User messages: +1-555-JOHN-AI
2. WhatsApp → Webhook → Backend
3. Backend processes like normal chat
4. Sends response back to WhatsApp
5. User gets AI reply on WhatsApp
```

### Website Embed
Creator adds to website:
```html
<script
  src="https://app.selflyx.com/embed.js"
  data-creator-slug="johndoe"
  data-position="bottom-right"
></script>
```

Widget appears on all pages, visitors can chat directly.

---

## 8. Example User Journey

### Scenario: Sarah wants business advice from John

**1. Discovery**
- Sarah follows John on Twitter
- John's bio: "Chat with my AI: selflyx.com/chat/johndoe"

**2. First Visit**
- Sarah clicks link → Lands on chat page
- Sees: John's photo, "AI trained on my content", "Ask me anything"
- Popular questions: "How to validate ideas?", "Best tools for startups?"

**3. First Message**
- Sarah types: "Should I quit my job to start a business?"
- AI responds in 3 seconds with personalized advice based on John's blog posts

**4. Conversation**
- Sarah asks 5 follow-up questions
- AI maintains context, references previous answers
- Conversation feels natural, like chatting with John

**5. Satisfaction**
- Sarah gets valuable advice instantly (vs waiting days for email reply)
- John's AI handles 100+ conversations/day automatically
- Sarah becomes a customer of John's course (AI included link)

---

## 9. Technical Implementation Summary

### Frontend (React)
- **SignupProfilePage:** Collects username → Creates chat link
- **OnboardingPages:** Builds AI personality & knowledge
- **PublicChatPage:** Public chat interface for end users
- **Dashboard:** Creator views analytics

### Backend (Node.js/Express)
- **authController:** Handles signup, validates unique username
- **identityController:** Processes personality & content
- **chatController:** Handles message sending/receiving
- **userQueries.findByHandle:** Looks up creator by username

### Database (PostgreSQL)
- Stores users, identities, knowledge, conversations, messages
- Username uniqueness enforced via `User_handle_key` constraint

### AI Processing
- **Vector Search:** Finds relevant knowledge chunks
- **LLM (OpenAI/Anthropic):** Generates responses
- **Voice (ElevenLabs):** Text-to-speech conversion

---

## 10. Why Username is Critical

```
❌ WITHOUT USERNAME:
Creator: john@example.com
Chat Link: /chat/user_abc123xyz (random ID)
Problem: Ugly, unmemorable, unprofessional

✅ WITH USERNAME:
Creator: johndoe
Chat Link: /chat/johndoe
Benefits:
  • Professional branding
  • Easy to remember & share
  • SEO-friendly URL
  • Social media ready
  • Custom domain possible: johndoe.ai
```

---

## Conclusion

**The flow is simple but powerful:**

1. ✅ Creator signs up with username → Creates AI clone
2. ✅ Gets chat link: `/chat/username`
3. ✅ Shares link publicly
4. ✅ Users chat instantly with AI
5. ✅ Creator monetizes & scales

**Username is the bridge** between creator and users. Without it, the platform wouldn't work.

---

## Files Modified for Username Feature

1. **Backend:**
   - [authController.ts](backend/src/modules/auth/authController.ts) - Added username validation
   - [database.ts](backend/src/config/database.ts) - Added `findByHandle()` function

2. **Frontend:**
   - [SignupProfilePage.tsx](frontend/react-app/src/pages/SignupProfilePage.tsx) - Added username + image fields

**Result:** Users now enter username during signup, creating instant chat links! 🚀
