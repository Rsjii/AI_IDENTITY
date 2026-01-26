# PHASE 1 - COMPLETE CHANGES NEEDED (A-Z)

> Comprehensive analysis comparing current codebase against PHASE1.md requirements
> Generated: 2026-01-26

---

## SUMMARY

| Category | Status | Missing Items |
|----------|--------|---------------|
| User Onboarding | 70% | Missing Google signup button, plan selection in signup flow |
| AI Clone Creation | 75% | Missing personality quiz improvements, voice sample recording |
| Content Upload | 60% | Missing YouTube auto-transcription, audio file support |
| Chat Interface | 65% | Missing typing indicators polish, payment prompts in chat |
| Deployment | 80% | Missing QR code generation, preview before launch |
| Creator Dashboard | 50% | Missing most asked questions, response times, satisfaction score |
| Monetization | 40% | Missing pay-per-chat in public chat, platform fee automation |

---

## 1. USER ONBOARDING

### 1.1 Landing Page (frontend/react-app/src/pages/LandingPage.tsx)

**CURRENT STATE:** Basic landing page exists with "Identity Mirror" branding
**REQUIRED (PHASE1.md):** Creator-focused "Clone Yourself" messaging

**Changes needed:**

| Line | Current | Required |
|------|---------|----------|
| 24-27 | "Reply without second-guessing your tone" | "Clone Yourself. Scale Infinitely." |
| 29-30 | Identity mirror messaging | "Your AI handles 1000 conversations while you sleep. Deploy to Instagram, WhatsApp, Website in 10 minutes." |
| - | Missing | Add social proof section: "5,000+ creators already cloned", "$2M+ earned by creators" |
| 45 | "Create Your Identity" | "Start Free Trial - No Credit Card" |
| - | Missing | Add testimonials with faces |
| - | Missing | Add demo video section (2 mins) |

**NEW FILE NEEDED:** `frontend/react-app/src/components/Testimonials.tsx`
- Testimonial carousel with creator photos
- Revenue numbers
- Use cases (fitness, tech, finance)

---

### 1.2 Auth Page (frontend/react-app/src/pages/AuthPage.tsx)

**Changes needed:**

| Location | Required Change |
|----------|----------------|
| Signup form | Add "Continue with Google" button prominently at top |
| After signup | Auto-redirect to /onboarding/quiz (not /signup/profile) |
| UI | Add progress indicator showing "Step 1 of 4" |

---

### 1.3 Signup Flow Restructure

**CURRENT:** signup -> verify -> profile -> identity
**REQUIRED:** signup -> quiz -> content -> voice(optional) -> plan -> deploy

**Files to modify:**
- `frontend/react-app/src/App.tsx` (lines 40-60): Update route order
- `backend/src/modules/auth/authController.ts`: Update redirect after signup
- `frontend/react-app/src/pages/SignupProfilePage.tsx`: Merge into quiz or remove

---

## 2. AI CLONE CREATION (Personality Quiz)

### 2.1 OnboardingQuizPage.tsx (frontend/react-app/src/pages/OnboardingQuizPage.tsx)

**CURRENT STATE:** 10 basic text inputs
**REQUIRED (PHASE1.md):** Conversational quiz with proper input types

**Changes needed:**

| Line | Current | Required |
|------|---------|----------|
| 26 | Basic Input for "AI name" | Keep, add placeholder "e.g., John's Fitness AI" |
| 27 | Basic Input for "What do you do?" | Change to dropdown/select: [Fitness coach, Tech creator, Business coach, Artist, Writer, Other] |
| 28 | Basic Input for "vibe" | Change to visual selector: [Casual, Professional, Funny] with icons |
| 29 | Basic Input for "expertise" | Change to tag input with suggestions: #fitness #nutrition #gym etc. |
| 30 | Basic Input for "audience" | Change to radio buttons: [Beginners, Advanced, Everyone] |
| 31 | Textarea for "topics" | Keep, add character count |
| 32 | Textarea for "avoid" | Add preset checkboxes: [Politics, Religion, Competitors, Personal life] + custom |
| 33 | Basic Input for "language" | Change to dropdown: [English, Hindi, Hinglish, Spanish, Other] |
| 34 | Basic Input for "length" | Change to slider: Short <---> Detailed with preview |
| 35 | Basic Input for "goal" | Change to multi-select: [Scale coaching, Monetize audience, Save time, Build community] |

**Additional UI changes:**
- Line 72: Add animated progress bar (not just text)
- Add transition animations between questions
- Add "Skip" option for non-essential questions
- Add sample response preview after each question

**NEW COMPONENT NEEDED:** `frontend/react-app/src/components/QuizQuestion.tsx`
```
- Visual question cards
- Multiple input type support (text, select, tags, slider, checkbox)
- Animation between steps
- Progress indicator
```

---

### 2.2 Voice Sample Recording

**CURRENT STATE:** Voice upload exists but no in-browser recording
**REQUIRED (PHASE1.md):** "Record 10-min audio" option

**NEW FILE NEEDED:** `frontend/react-app/src/components/VoiceRecorder.tsx`

**Features required:**
- Browser-based audio recording (MediaRecorder API)
- 10-minute timer with visual countdown
- Waveform visualization
- Pause/Resume/Stop controls
- Upload recorded audio to /api/voice/upload
- "Skip for now" option

**Backend changes needed:**
- `backend/src/modules/voice/voiceController.ts`: Accept base64 audio from browser recording

---

### 2.3 AI Training Status Page

**CURRENT STATE:** Missing
**REQUIRED (PHASE1.md):** "Your AI is learning..." screen with progress

**NEW FILE NEEDED:** `frontend/react-app/src/pages/OnboardingTrainingPage.tsx`

**Required features:**
- Progress animation: "Processing 5 documents..."
- Status updates: "Analyzing writing style..."
- Estimated time: "Ready in 18 hours"
- Email notification opt-in
- Meanwhile: Setup payment & deployment links

---

## 3. CONTENT UPLOAD

### 3.1 OnboardingContentPage.tsx (frontend/react-app/src/pages/OnboardingContentPage.tsx)

**CURRENT STATE:** Basic paste, YouTube URL, file upload
**REQUIRED (PHASE1.md):** Full content upload with progress, transcription, social import

**Changes needed:**

| Line | Current | Required |
|------|---------|----------|
| 59-61 | Basic textarea for paste | Add character count, file type detection |
| 65-69 | YouTube URL input | Add "Auto-transcribes" label, show transcription progress |
| 70 | Note "MVP: stores URL only" | REMOVE - implement actual transcription |
| 74-75 | Basic file input | Change to drag-drop zone with progress bar |
| - | Missing | Add "Connect Social" section |
| - | Missing | Add file limit display: "10 files, 50MB total" |

**NEW FEATURES NEEDED:**

1. **YouTube Transcription** (backend/src/modules/content/contentService.ts):
```typescript
// Line 19-23: Currently stores URL only
// Required: Implement actual transcription
export async function createYoutubeSource(userId: string, url: string, title?: string) {
  // Extract video ID
  // Call YouTube API or yt-dlp to get captions
  // If no captions, use Whisper API for audio transcription
  // Store transcribed text as chunks
}
```

2. **Audio File Support** (backend/src/modules/content/contentController.ts):
- Add validation for MP3, WAV, M4A files
- Transcribe audio using Whisper API
- Store transcription as knowledge chunks

3. **Social Import** - NEW FILES:
- `backend/src/modules/content/twitterService.ts`: Import last 100 tweets
- `backend/src/modules/content/instagramService.ts`: Import Instagram captions
- `frontend/react-app/src/components/SocialImport.tsx`: OAuth connect buttons

---

### 3.2 File Upload Improvements

**backend/src/modules/content/contentService.ts (lines 26-44)**

**Current:** Stores file to S3, no parsing
**Required:** Parse and extract text from:
- PDF files (use pdf-parse library)
- Word docs (use mammoth library)
- Text files (direct read)

```typescript
// NEW: Add to contentService.ts
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export async function createFileSource(userId: string, file: Express.Multer.File, title?: string) {
  let extractedText = '';

  // Extract text based on file type
  if (file.mimetype === 'application/pdf') {
    const data = await pdfParse(file.buffer);
    extractedText = data.text;
  } else if (file.mimetype.includes('word')) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    extractedText = result.value;
  } else if (file.mimetype.startsWith('text/')) {
    extractedText = file.buffer.toString('utf-8');
  }

  // Create chunks from extracted text
  const chunks = chunkText(extractedText);
  // ... rest of function
}
```

**NEW DEPENDENCIES TO ADD (backend/package.json):**
```json
"pdf-parse": "^1.1.1",
"mammoth": "^1.6.0",
"openai": "^4.x" // For Whisper transcription
```

---

## 4. CHAT INTERFACE

### 4.1 PublicChatPage.tsx (frontend/react-app/src/pages/PublicChatPage.tsx)

**CURRENT STATE:** Basic chat, no monetization
**REQUIRED (PHASE1.md):** WhatsApp-like UI with payment prompts

**Changes needed:**

| Line | Current | Required |
|------|---------|----------|
| 49-70 | Basic div layout | Redesign to WhatsApp-like UI with header, avatar |
| 52 | Simple title | Add avatar image, online status indicator |
| 54 | Basic border container | Add rounded corners, shadow, mobile-responsive |
| 55-61 | Basic message bubbles | Style as chat bubbles (user right, AI left) |
| 62 | "AI is typing..." | Add animated typing indicator (three dots) |
| 65-68 | Basic input | Add send button icon, mic button for voice |
| - | Missing | Add welcome message with "Popular questions" buttons |
| - | Missing | Add payment prompt after free message limit |
| - | Missing | Add "Subscribe for unlimited" upsell |

**NEW COMPONENT NEEDED:** `frontend/react-app/src/components/ChatBubble.tsx`
```
- Proper bubble styling (rounded, colored)
- Timestamp display
- Payment card embed
- Voice message player
```

---

### 4.2 Payment Prompts in Chat

**CURRENT STATE:** No pay-per-chat implemented in public chat
**REQUIRED (PHASE1.md):** Premium response paywalls

**Backend changes needed (backend/src/modules/public/publicController.ts):**

```typescript
// After line 31, add payment check:
export async function publicChat(req: Request, res: Response) {
  // ... existing code ...

  // Check if user exceeded free tier
  const freeMessageLimit = 3;
  const sessionMessages = await chatMessageQueries.countBySession(sid);

  if (sessionMessages >= freeMessageLimit) {
    // Check if premium payment made
    const pricing = u.priceConfig || { premium: { amountCents: 500 } };

    return res.json({
      success: true,
      requiresPayment: true,
      paymentOptions: {
        premium: { amount: pricing.premium.amountCents, label: 'Detailed Answer' },
        vip: { amount: pricing.vip?.amountCents || 5000, label: 'Full Consultation' },
      },
      previewReply: result.reply?.substring(0, 100) + '...',
    });
  }
  // ... rest of function
}
```

**Frontend changes needed (PublicChatPage.tsx):**
- Add `PaymentPrompt` component
- Integrate Stripe Elements for in-chat payment
- Show payment success and unlock content

---

### 4.3 Typing Indicators

**NEW FILE NEEDED:** `frontend/react-app/src/components/TypingIndicator.tsx`

```tsx
export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 p-3">
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
    </div>
  );
}
```

---

## 5. DEPLOYMENT

### 5.1 OnboardingDeployPage.tsx (frontend/react-app/src/pages/OnboardingDeployPage.tsx)

**CURRENT STATE:** Only shows standalone link
**REQUIRED (PHASE1.md):** Full deployment options with preview

**Changes needed:**

| Line | Current | Required |
|------|---------|----------|
| 23-28 | Only standalone link | Add 4 deployment options: Website Embed, Standalone, WhatsApp, Instagram |
| - | Missing | Add embed code snippet with copy button |
| - | Missing | Add QR code generation |
| - | Missing | Add "Preview" button that opens widget demo |
| - | Missing | Add social share templates |
| - | Missing | Add video tutorial link |

**NEW FEATURES:**

1. **QR Code Generation:**
```typescript
// Add to OnboardingDeployPage.tsx
import QRCode from 'qrcode';

const [qrDataUrl, setQrDataUrl] = useState('');

useEffect(() => {
  if (standaloneLink) {
    QRCode.toDataURL(standaloneLink).then(setQrDataUrl);
  }
}, [standaloneLink]);
```

**NEW DEPENDENCY (frontend/react-app/package.json):**
```json
"qrcode": "^1.5.3"
```

2. **Social Share Templates:**
```tsx
const shareTemplates = [
  "Chat with my AI! Link in bio",
  "I cloned myself. Ask me anything: [link]",
  "24/7 AI version of me is live! Try it:"
];
```

---

### 5.2 Widget Preview

**NEW FILE NEEDED:** `frontend/react-app/src/components/WidgetPreview.tsx`

**Features:**
- iframe or modal showing embed widget
- Live preview of color/position changes
- Test chat functionality

---

### 5.3 Website Embed Improvements

**frontend/src/public/embed.js (lines 1-109)**

**Current:** Basic widget
**Required additions:**

| Feature | Status | Required |
|---------|--------|----------|
| Position customization | Done | - |
| Color customization | Done | - |
| Avatar display | Done | - |
| Voice replies | Done | - |
| Welcome message | Missing | Add data-welcome-message attribute |
| Popular questions | Missing | Add clickable question buttons |
| Payment flow | Missing | Add Stripe integration in widget |
| Mobile responsiveness | Partial | Improve mobile layout |

**Changes to embed.js:**

```javascript
// Add after line 8:
const WELCOME_MESSAGE = script.getAttribute('data-welcome-message') || 'Hey! Ask me anything!';
const POPULAR_QUESTIONS = (script.getAttribute('data-popular-questions') || '').split(',').filter(Boolean);

// Add welcome message display (after line 29):
if (WELCOME_MESSAGE) {
  messagesDiv.innerHTML = `<div class="selflyx-msg selflyx-msg-bot">${WELCOME_MESSAGE}</div>`;
}

// Add popular questions buttons (after messagesDiv):
if (POPULAR_QUESTIONS.length > 0) {
  const questionsDiv = document.createElement('div');
  questionsDiv.className = 'selflyx-popular-questions';
  POPULAR_QUESTIONS.forEach(q => {
    const btn = document.createElement('button');
    btn.className = 'selflyx-question-btn';
    btn.textContent = q;
    btn.onclick = () => { input.value = q; sendMessage(); };
    questionsDiv.appendChild(btn);
  });
  messagesDiv.after(questionsDiv);
}
```

**CSS additions (embed.css):**
```css
.selflyx-popular-questions {
  padding: 8px 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.selflyx-question-btn {
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
}

.selflyx-question-btn:hover {
  background: #e5e7eb;
}
```

---

## 6. CREATOR DASHBOARD

### 6.1 CreatorDashboardPage.tsx (frontend/react-app/src/pages/CreatorDashboardPage.tsx)

**CURRENT STATE:** Only shows chat counts and revenue
**REQUIRED (PHASE1.md):** Full analytics dashboard

**Changes needed:**

| Line | Current | Required |
|------|---------|----------|
| 18-22 | 4 metrics only | Expand to full dashboard sections |

**NEW SECTIONS REQUIRED:**

1. **Overview Section:**
   - Total chats today/week/month (EXISTS)
   - Revenue earned (EXISTS)
   - Active users right now (MISSING)

2. **Analytics Section (MISSING):**
   - Most asked questions (top 10)
   - Response times (avg, min, max)
   - User satisfaction score (from trust events)
   - Peak usage hours (chart)

3. **Customize Section (MISSING):**
   - Edit personality (link to /identity/edit)
   - Update knowledge base (link to /knowledge)
   - Set pricing (EXISTS in Integrations, move here)
   - Block certain questions

4. **Earnings Section (MISSING):**
   - Revenue breakdown by tier
   - Payout settings (bank account)
   - Transaction history

**Backend changes needed (backend/src/modules/creator/creatorController.ts):**

```typescript
// Add to dashboard() function after line 39:

// Most asked questions
const topQuestions = await db.query(`
  SELECT "incomingMessage", COUNT(*) as count
  FROM "mirror_runs" mr
  JOIN "identity_versions" iv ON iv.id = mr."identityVersionId"
  JOIN "identities" i ON i.id = iv."identityId"
  WHERE i."userId" = $1
  GROUP BY "incomingMessage"
  ORDER BY count DESC
  LIMIT 10
`, [userId]);

// Response times
const responseTime = await db.query(`
  SELECT
    AVG("latencyMs") as avg,
    MIN("latencyMs") as min,
    MAX("latencyMs") as max
  FROM "mirror_runs" mr
  JOIN "identity_versions" iv ON iv.id = mr."identityVersionId"
  JOIN "identities" i ON i.id = iv."identityId"
  WHERE i."userId" = $1
`, [userId]);

// Satisfaction score
const satisfaction = await db.query(`
  SELECT
    COUNT(*) FILTER (WHERE event = 'confirm_yes') as positive,
    COUNT(*) FILTER (WHERE event = 'confirm_no') as negative
  FROM "trust_events" te
  JOIN "identity_versions" iv ON iv.id = te."identityVersionId"
  JOIN "identities" i ON i.id = iv."identityId"
  WHERE i."userId" = $1
`, [userId]);

// Peak hours
const peakHours = await db.query(`
  SELECT EXTRACT(HOUR FROM mr."createdAt") as hour, COUNT(*) as count
  FROM "mirror_runs" mr
  JOIN "identity_versions" iv ON iv.id = mr."identityVersionId"
  JOIN "identities" i ON i.id = iv."identityId"
  WHERE i."userId" = $1
  GROUP BY hour
  ORDER BY hour
`, [userId]);

// Add to response JSON
return res.json({
  // ... existing fields ...
  analytics: {
    topQuestions: topQuestions.rows,
    responseTime: responseTime.rows[0],
    satisfaction: {
      positive: satisfaction.rows[0]?.positive || 0,
      negative: satisfaction.rows[0]?.negative || 0,
      score: calculateScore(satisfaction.rows[0]),
    },
    peakHours: peakHours.rows,
  },
});
```

---

### 6.2 Active Users Right Now

**NEW TABLE NEEDED (backend/src/config/database.ts):**

```sql
CREATE TABLE IF NOT EXISTS "active_sessions" (
  "id" TEXT PRIMARY KEY,
  "creatorId" TEXT NOT NULL,
  "visitorId" TEXT,
  "lastActiveAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_active_sessions_creatorId" ON "active_sessions"("creatorId");
CREATE INDEX IF NOT EXISTS "idx_active_sessions_lastActiveAt" ON "active_sessions"("lastActiveAt");
```

**Backend query:**
```typescript
// Active users (last 5 minutes)
const activeUsers = await db.query(`
  SELECT COUNT(DISTINCT "visitorId") as count
  FROM "active_sessions"
  WHERE "creatorId" = $1 AND "lastActiveAt" > NOW() - INTERVAL '5 minutes'
`, [userId]);
```

---

## 7. MONETIZATION

### 7.1 Pay-Per-Chat Implementation

**CURRENT STATE:** Stripe subscription only, no pay-per-chat
**REQUIRED (PHASE1.md):** Pay-per-chat with creator-set prices

**NEW FILES NEEDED:**

1. **backend/src/modules/payments/payPerChatController.ts:**
```typescript
import Stripe from 'stripe';

export async function createPaymentIntent(req: Request, res: Response) {
  const { creatorId, tier } = req.body; // tier: 'premium' | 'vip'

  const creator = await userQueries.findById(creatorId);
  const pricing = creator.priceConfig || { premium: { amountCents: 500 }, vip: { amountCents: 5000 } };

  const amount = tier === 'vip' ? pricing.vip.amountCents : pricing.premium.amountCents;

  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    metadata: { creatorId, tier, visitorId: req.body.visitorId },
  });

  return res.json({ clientSecret: paymentIntent.client_secret });
}

export async function confirmPayment(req: Request, res: Response) {
  const { paymentIntentId, sessionId } = req.body;

  // Record payment
  await stripePaymentQueries.create({
    creatorId: req.body.creatorId,
    sessionId,
    amount: req.body.amount,
    status: 'succeeded',
    stripePaymentIntentId: paymentIntentId,
  });

  // Platform fee (25%)
  const platformFee = Math.floor(req.body.amount * 0.25);
  // Creator gets 75%

  return res.json({ success: true });
}
```

2. **backend/src/modules/payments/payPerChatRoutes.ts:**
```typescript
router.post('/intent', requireJWTFromCookie, createPaymentIntent);
router.post('/confirm', confirmPayment);
```

3. **frontend/react-app/src/components/PaymentPrompt.tsx:**
```tsx
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement } from '@stripe/react-stripe-js';

export function PaymentPrompt({ creatorId, onSuccess }) {
  // Stripe Elements integration
  // Show premium/VIP options
  // Process payment
  // Call onSuccess to unlock content
}
```

---

### 7.2 Platform Fee Implementation

**CURRENT STATE:** No automatic fee calculation
**REQUIRED (PHASE1.md):** 20-25% platform fee on all transactions

**Backend changes needed:**

1. **Add to stripe_payments table (database.ts):**
```sql
ALTER TABLE "stripe_payments" ADD COLUMN IF NOT EXISTS "platformFeeCents" INTEGER;
ALTER TABLE "stripe_payments" ADD COLUMN IF NOT EXISTS "creatorEarningsCents" INTEGER;
```

2. **Update payment processing:**
```typescript
const PLATFORM_FEE_PERCENT = 0.25; // 25%

const platformFee = Math.floor(amount * PLATFORM_FEE_PERCENT);
const creatorEarnings = amount - platformFee;

await db.query(`
  INSERT INTO "stripe_payments" (..., "platformFeeCents", "creatorEarningsCents")
  VALUES (..., $1, $2)
`, [platformFee, creatorEarnings]);
```

---

### 7.3 Payout Settings

**NEW FILES NEEDED:**

1. **backend/src/modules/payments/payoutController.ts:**
   - Bank account connection (Stripe Connect)
   - Payout requests
   - Transaction history

2. **frontend/react-app/src/pages/PayoutSettingsPage.tsx:**
   - Bank account form
   - Pending balance display
   - Request payout button
   - Transaction history table

---

## 8. PLATFORM INTEGRATIONS

### 8.1 Instagram DM Integration

**CURRENT STATE:** OAuth flow + webhook exists
**REQUIRED (PHASE1.md):** Payment links in DM

**Changes needed (backend/src/modules/instagram/instagramController.ts):**

```typescript
// After line 226, add payment link in reply:
async function processIncomingMessage(event: any) {
  // ... existing code ...

  if (result.decision === 'reply' && result.reply) {
    // Check if premium response needed
    const creator = await userQueries.findById(userId);
    const pricing = creator.priceConfig;

    if (pricing?.premium?.enabled && shouldUpsell(result)) {
      const paymentLink = `${process.env.FRONTEND_URL}/chat/${creator.publicSlug}?upgrade=1`;
      const replyWithLink = `${result.reply}\n\n💎 Want more detailed advice? ${paymentLink}`;
      await sendInstagramMessage(senderId, replyWithLink, accessToken);
    } else {
      await sendInstagramMessage(senderId, result.reply, accessToken);
    }
  }
}
```

---

### 8.2 WhatsApp Integration

**CURRENT STATE:** Basic Twilio webhook
**REQUIRED (PHASE1.md):** QR code connect, business hours, payment links

**Changes needed:**

1. **QR Code Connect (frontend):**
   - Currently uses phone number input
   - Add option to scan QR code for WhatsApp Web link

2. **Business Hours (backend/src/modules/whatsapp/whatsappController.ts):**
```typescript
// Add business hours check
async function processIncomingMessage(event: any) {
  const integration = await findUserByWhatsAppNumber(fromNumber);
  const businessHours = integration.config?.businessHours;

  if (businessHours && !isWithinBusinessHours(businessHours)) {
    await sendWhatsAppMessage(fromNumber, "Thanks for reaching out! I'll respond during business hours.");
    return;
  }

  // ... rest of processing
}
```

3. **Payment Links:**
   - Same pattern as Instagram

---

## 9. VOICE FEATURES

### 9.1 Voice Sample Recording (Missing)

**NEW FILE NEEDED:** `frontend/react-app/src/components/VoiceRecorder.tsx`

```tsx
import { useState, useRef } from 'react';

export function VoiceRecorder({ onUpload }) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.current = new MediaRecorder(stream);

    mediaRecorder.current.ondataavailable = (e) => chunks.current.push(e.data);
    mediaRecorder.current.onstop = () => {
      const blob = new Blob(chunks.current, { type: 'audio/webm' });
      onUpload(blob);
    };

    mediaRecorder.current.start();
    setRecording(true);

    // 10-minute timer
    const timer = setInterval(() => {
      setDuration(d => {
        if (d >= 600) { // 10 minutes
          stopRecording();
          clearInterval(timer);
        }
        return d + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setRecording(false);
  };

  // ... render with timer, waveform, controls
}
```

---

### 9.2 Voice Setup Page Improvements

**frontend/react-app/src/pages/VoiceSetupPage.tsx:**

**Changes needed:**
- Add VoiceRecorder component
- Show 10-minute target with progress
- Add "Skip for now" button
- Add voice quality tips

---

## 10. EMAIL NOTIFICATIONS

### 10.1 Transactional Emails (Missing)

**CURRENT STATE:** Only OTP emails
**REQUIRED (PHASE1.md):** Signup, payment, training ready notifications

**NEW FILE NEEDED:** `backend/src/services/emailTemplates.ts`

```typescript
export const emailTemplates = {
  welcome: (name: string) => ({
    subject: 'Welcome to Selflyx - Your AI Clone Awaits!',
    html: `<h1>Hey ${name}!</h1><p>Your AI clone is being trained...</p>`,
  }),

  trainingComplete: (name: string, link: string) => ({
    subject: 'Your AI Clone is Ready!',
    html: `<h1>${name}, your AI is live!</h1><p>Start sharing: ${link}</p>`,
  }),

  paymentReceived: (amount: number) => ({
    subject: 'Payment Received - $' + (amount / 100).toFixed(2),
    html: `<p>You received a payment...</p>`,
  }),

  weeklyReport: (stats: any) => ({
    subject: 'Your Weekly AI Clone Report',
    html: `<p>${stats.chats} chats, $${stats.revenue} earned...</p>`,
  }),
};
```

**Backend integration needed:**
- Send welcome email after signup
- Send training complete email after 24h (or when ready)
- Send payment notification on each transaction
- Send weekly report (cron job)

---

## 11. DATABASE SCHEMA UPDATES

### 11.1 Missing Tables

Add to `backend/src/config/database.ts`:

```sql
-- Active sessions for "users right now"
CREATE TABLE IF NOT EXISTS "active_sessions" (
  "id" TEXT PRIMARY KEY,
  "creatorId" TEXT NOT NULL,
  "visitorId" TEXT,
  "sessionId" TEXT,
  "lastActiveAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Blocked topics
CREATE TABLE IF NOT EXISTS "blocked_topics" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Payout requests
CREATE TABLE IF NOT EXISTS "payout_requests" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "stripeTransferId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMPTZ
);

-- Email notifications log
CREATE TABLE IF NOT EXISTS "email_logs" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT,
  "type" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "sentAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

### 11.2 Table Modifications

```sql
-- Add to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeConnectId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "payoutEnabled" BOOLEAN DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "businessHours" JSONB;

-- Add to stripe_payments
ALTER TABLE "stripe_payments" ADD COLUMN IF NOT EXISTS "platformFeeCents" INTEGER;
ALTER TABLE "stripe_payments" ADD COLUMN IF NOT EXISTS "creatorEarningsCents" INTEGER;
ALTER TABLE "stripe_payments" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'subscription';

-- Add to mirror_runs
ALTER TABLE "mirror_runs" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;
ALTER TABLE "mirror_runs" ADD COLUMN IF NOT EXISTS "visitorId" TEXT;
```

---

## 12. MISSING PAGES

### 12.1 New Pages Needed

| Page | Route | Purpose |
|------|-------|---------|
| OnboardingTrainingPage | /onboarding/training | AI training progress |
| PayoutSettingsPage | /payouts | Bank account, request payouts |
| BlockedTopicsPage | /settings/blocked | Manage blocked topics |
| SubscribersPage | /subscribers | List of subscribers |

---

## 13. UI/UX IMPROVEMENTS

### 13.1 Progress Indicators

Add to all onboarding pages:
```tsx
<div className="flex gap-2 mb-6">
  {['Quiz', 'Content', 'Voice', 'Plan', 'Deploy'].map((step, i) => (
    <div key={step} className={`h-2 flex-1 rounded ${i <= currentStep ? 'bg-primary' : 'bg-muted'}`} />
  ))}
</div>
```

### 13.2 Mobile Responsiveness

Files needing mobile fixes:
- `PublicChatPage.tsx`: Full-screen chat on mobile
- `CreatorDashboardPage.tsx`: Stack cards on mobile
- `IntegrationsPage.tsx`: Collapse sections on mobile

---

## 14. ENVIRONMENT VARIABLES

### 14.1 New Variables Needed (.env)

```env
# YouTube transcription
YOUTUBE_API_KEY=

# Whisper transcription
OPENAI_API_KEY=

# Instagram
META_APP_ID=
META_APP_SECRET=
INSTAGRAM_VERIFY_TOKEN=

# WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=

# Stripe Connect (for payouts)
STRIPE_CONNECT_CLIENT_ID=

# Email (for transactional emails beyond OTP)
RESEND_API_KEY=

# Frontend
VITE_META_APP_ID=
VITE_STRIPE_PUBLISHABLE_KEY=
```

---

## 15. DEPENDENCIES TO ADD

### 15.1 Backend (package.json)

```json
{
  "dependencies": {
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.6.0",
    "openai": "^4.x",
    "ytdl-core": "^4.11.5"
  }
}
```

### 15.2 Frontend (package.json)

```json
{
  "dependencies": {
    "qrcode": "^1.5.3",
    "@stripe/stripe-js": "^2.x",
    "@stripe/react-stripe-js": "^2.x",
    "recharts": "^2.x"
  }
}
```

---

## PRIORITY ORDER FOR IMPLEMENTATION

### HIGH PRIORITY (Week 1)
1. Landing page redesign with creator messaging
2. Pay-per-chat in public chat
3. YouTube transcription
4. Dashboard analytics (most asked questions, satisfaction)
5. Typing indicators and chat UI polish

### MEDIUM PRIORITY (Week 2)
1. Voice recorder component
2. QR code generation
3. Platform fee implementation
4. Email notifications
5. Widget improvements (popular questions, payment)

### LOWER PRIORITY (Week 3-4)
1. Payout settings
2. Social import (Twitter, Instagram)
3. Business hours for WhatsApp
4. Active users tracking
5. Weekly report emails

---

## ESTIMATED TOTAL CHANGES

| Category | New Files | Modified Files | New Lines |
|----------|-----------|----------------|-----------|
| Frontend Pages | 4 | 8 | ~1500 |
| Frontend Components | 6 | 3 | ~800 |
| Backend Controllers | 2 | 5 | ~600 |
| Backend Services | 3 | 2 | ~400 |
| Database Schema | 0 | 1 | ~100 |
| Styles | 0 | 1 | ~150 |
| **TOTAL** | **15** | **20** | **~3550** |

---

## END OF DOCUMENT

This document should be updated as changes are implemented. Check off items as completed.
