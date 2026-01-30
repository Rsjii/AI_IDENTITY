# Can Do - Low Priority Items

This document contains low priority features and improvements that can be implemented in future iterations.

## 1. Data Export in Settings

**Description:** Allow users to download all their data in a structured format (JSON, CSV, or ZIP).

**Implementation:**
- Add "Data Export" section in Settings > Security tab
- Create backend endpoint: `GET /api/profile/export`
- Export includes:
  - User profile data
  - Identity configurations (all versions)
  - Chat history
  - Payment/earnings history
  - Uploaded content metadata
- Frontend: Button to trigger export, download as ZIP file

**Files to modify:**
- `backend/src/modules/profile/profileController.ts` - Add export endpoint
- `frontend/react-app/src/pages/SettingsPage.tsx` - Add export button in Security tab

---

## 2. API Keys Section (for Future API Access)

**Description:** Allow creators to generate API keys for programmatic access to their AI clone.

**Implementation:**
- Add "API Keys" tab in Settings
- Backend: Create `api_keys` table
  ```sql
  CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    userId TEXT REFERENCES "User"(id),
    keyHash TEXT NOT NULL,
    name TEXT,
    lastUsedAt TIMESTAMP,
    createdAt TIMESTAMP DEFAULT NOW(),
    revokedAt TIMESTAMP
  );
  ```
- Endpoints:
  - `POST /api/profile/api-keys` - Generate new key
  - `GET /api/profile/api-keys` - List all keys
  - `DELETE /api/profile/api-keys/:id` - Revoke key
- Frontend: Display keys with "Copy" button, show last used date, allow naming keys

**Files to create/modify:**
- `backend/src/modules/profile/apiKeysController.ts` - New controller
- `backend/src/modules/profile/profileRoutes.ts` - Add routes
- `frontend/react-app/src/pages/SettingsPage.tsx` - Add API Keys tab

---

## 3. WebSocket for Real-Time Updates

**Description:** Replace polling with WebSocket connections for real-time dashboard updates and chat notifications.

**Implementation:**
- Backend: Use Socket.io or native WebSocket
  - Install: `npm install socket.io`
  - Create: `backend/src/services/socketService.ts`
  - Events:
    - `chat:new` - New chat started
    - `payment:received` - Payment completed
    - `training:progress` - AI training progress updates
    - `dashboard:stats` - Real-time stats updates
- Frontend: 
  - Install: `npm install socket.io-client`
  - Create: `frontend/react-app/src/services/socketClient.ts`
  - Update `CreatorDashboardPage.tsx` to use WebSocket instead of polling
  - Update `OnboardingTrainingPage.tsx` for real-time training progress

**Benefits:**
- Instant updates (no 10s polling delay)
- Reduced server load
- Better user experience

**Files to create/modify:**
- `backend/src/services/socketService.ts` - New service
- `backend/src/server.ts` - Initialize Socket.io
- `frontend/react-app/src/services/socketClient.ts` - New client
- `frontend/react-app/src/pages/CreatorDashboardPage.tsx` - Replace polling
- `frontend/react-app/src/pages/OnboardingTrainingPage.tsx` - Real-time progress

---

## 4. Account Deletion

**Description:** Allow users to permanently delete their account and all associated data.

**Implementation:**
- Add "Delete Account" section in Settings > Security tab
- Backend endpoint: `DELETE /api/profile/account`
- Soft delete: Mark user as deleted, anonymize data
- Hard delete (optional): Permanently remove all data
- Email confirmation required before deletion
- 30-day grace period (can restore within 30 days)

**Files to modify:**
- `backend/src/modules/profile/profileController.ts` - Add delete endpoint
- `frontend/react-app/src/pages/SettingsPage.tsx` - Add delete section

---

## 5. Advanced Analytics

**Description:** More detailed analytics and insights for creators.

**Features:**
- User journey tracking
- Conversion funnel analysis
- A/B testing for AI responses
- Sentiment analysis of conversations
- Geographic distribution of users
- Device/browser breakdown

**Files to create:**
- `backend/src/modules/analytics/analyticsController.ts`
- `frontend/react-app/src/pages/AnalyticsPage.tsx`

---

## 6. Bulk Operations

**Description:** Allow creators to perform bulk operations on content, chats, etc.

**Features:**
- Bulk delete chat sessions
- Bulk export conversations
- Bulk update identity rules
- Bulk upload content files

---

## 7. Custom Domain Support

**Description:** Allow creators to use their own domain for chat widget.

**Implementation:**
- Settings > Payment tab: Add "Custom Domain" section
- Backend: Verify domain ownership (DNS TXT record)
- Update embed code to use custom domain
- SSL certificate provisioning (via Let's Encrypt or similar)

---

## 8. Multi-Language Support

**Description:** Support for multiple languages in UI and AI responses.

**Implementation:**
- Use i18n library (react-i18next)
- Language selector in Settings
- Translate all UI text
- AI can respond in user's preferred language

---

## 9. Advanced Payment Options

**Description:** More flexible payment configurations.

**Features:**
- Custom pricing tiers (not just premium/vip)
- Subscription-based pay-per-chat
- Discount codes/coupons
- Payment plans (installments)
- Refund management

---

## 10. Team/Collaboration Features

**Description:** Allow multiple users to manage a single AI clone.

**Features:**
- Team members (invite via email)
- Role-based permissions (admin, editor, viewer)
- Shared dashboard
- Activity logs (who did what)

---

## 11. Cost Tracking & Analytics (Low Priority)

**Description:** Advanced cost monitoring and optimization features.

**Features:**
- Daily cost alerts (email when cost exceeds threshold)
- Cost breakdown by model (Groq vs OpenAI)
- Cost optimization suggestions (e.g., "Switch to Groq for simple queries")
- Cost aggregation queries (daily/weekly/monthly costs per user)
- Cost dashboard metrics (show in creator dashboard)
- Cost per conversation tracking
- Model usage analytics (which models cost most)

**Implementation:**
- Create cost aggregation service
- Add cost alerts (cron job or scheduled task)
- Add cost metrics to dashboard API
- Create cost optimization recommendations engine

**Files to create/modify:**
- `backend/src/services/costAggregationService.ts` - New service
- `backend/src/modules/creator/costController.ts` - Cost analytics endpoints
- `frontend/react-app/src/pages/CreatorDashboardPage.tsx` - Add cost metrics

---

## 12. Unused Event Types (Future Features)

**Description:** Event types defined in `EVENT_TYPES` but not yet implemented. These should be logged when corresponding features are added.

**Event Types:**
- `SHARE_CLICKED` - Log when share button is clicked (social sharing feature)
- `PROFILE_VIEWED` - Log when a creator's profile is viewed (profile analytics)
- `ACCOUNT_DELETED` - Log when user deletes their account (account deletion feature)
- `PRIVACY_SETTINGS_UPDATED` - Log when privacy settings are changed (privacy settings feature)
- `USER_BLOCKED` - Log when a user is blocked (user blocking feature)
- `CONTENT_MODERATED` - Log when content is moderated (content moderation feature)
- `CONTENT_REPORTED` - Log when content is reported (content reporting feature)
- `INVITE_SENT` - Log when referral invite is sent (referral system - partially implemented)
- `INVITE_ACCEPTED` - Log when referral invite is accepted (referral system - partially implemented)

**Note:** These events are defined in `backend/src/config/constants.ts` but not currently logged. They should be implemented when the corresponding features are added.

---

## 13. Accessibility Audit (A11Y)

**Description:** Make the app usable for people with disabilities (visual, motor, cognitive). Required by law in many places (ADA, WCAG).

### What to Check:

#### A. Keyboard Navigation
- Can users navigate without a mouse?
- Tab order is logical
- All interactive elements are reachable via Tab
- Focus indicators are visible

**Example:**
```typescript
// ❌ BAD: Button without keyboard support
<div onClick={handleClick}>Click me</div>

// ✅ GOOD: Proper button with keyboard support
<button onClick={handleClick} onKeyDown={(e) => e.key === 'Enter' && handleClick()}>
  Click me
</button>
```

#### B. Screen Reader Support
- ARIA labels on buttons, inputs, icons
- Semantic HTML (`<button>` not `<div>`)
- Alt text for images
- Form labels linked to inputs

**Example:**
```typescript
// ❌ BAD: No label for screen reader
<input type="text" />

// ✅ GOOD: Proper label
<label htmlFor="email">Email</label>
<input id="email" type="email" aria-label="Email address" />
```

#### C. Color Contrast
- Text is readable (WCAG AAA: 7:1 for normal text, 4.5:1 for large text)
- Don't rely only on color to convey information

#### D. Focus Indicators
- Visible outline when Tab focuses an element
- Custom focus styles if needed

### How to Audit:

1. **Automated Tools:**
   - Chrome DevTools Lighthouse (Accessibility tab)
   - axe DevTools extension
   - WAVE browser extension

2. **Manual Testing:**
   - Use keyboard only (Tab, Enter, Space, Arrow keys)
   - Test with screen reader (NVDA on Windows, VoiceOver on Mac)
   - Check color contrast with online tools

3. **Checklist:**
   ```
   □ All buttons work with keyboard
   □ All forms have labels
   □ All images have alt text
   □ Color contrast passes WCAG AAA
   □ Focus indicators visible
   □ No keyboard traps (can't escape)
   □ Screen reader announces all content
   ```

**Time Required:** 1-2 days
- Day 1: Run automated tools, fix obvious issues
- Day 2: Manual testing, screen reader testing, final fixes

**Priority:** Medium (legal requirement but can be done post-launch)

---

## 14. Performance Optimization

**Description:** Make the app fast - quick load times, smooth interactions, efficient resource usage.

### What to Check:

#### A. Bundle Size
- JavaScript bundle size (should be < 500KB gzipped)
- CSS bundle size
- Code splitting (load only what's needed)

**How to Check:**
```bash
# Build and analyze
cd frontend/react-app
npm run build

# Check bundle size
ls -lh dist/assets/*.js
```

#### B. Image Optimization
- Images in WebP format
- Lazy loading for images below the fold
- Proper sizing (not loading 4K images for thumbnails)

#### C. Code Splitting
- Routes load separately (not all at once)
- Heavy libraries loaded on demand

#### D. Lighthouse Score
- Performance score > 90
- First Contentful Paint (FCP) < 1.8s
- Largest Contentful Paint (LCP) < 2.5s
- Time to Interactive (TTI) < 3.8s

**How to Check:**
1. Open Chrome DevTools
2. Go to Lighthouse tab
3. Run Performance audit
4. Target: 90+ score

### What to Optimize:

1. **Bundle Analysis:**
```bash
# Install bundle analyzer
npm install --save-dev vite-bundle-visualizer

# Add to vite.config.ts
import { visualizer } from 'vite-bundle-visualizer'

export default defineConfig({
  plugins: [
    react(),
    visualizer() // Shows bundle breakdown
  ]
})
```

2. **Lazy Load Routes:**
```typescript
// Verify heavy pages are lazy loaded:
const CreatorDashboardPage = lazy(() => import('./pages/CreatorDashboardPage'));
```

3. **Optimize Images:**
```typescript
// Convert images to WebP
// Use lazy loading:
<img src="image.jpg" loading="lazy" alt="..." />
```

4. **Enable Compression:**
```typescript
// Backend should gzip responses
import compression from 'compression';
app.use(compression());
```

**Time Required:** 1 day
- Morning: Run Lighthouse, analyze bundle
- Afternoon: Fix issues (lazy load, optimize images, compress)

**Priority:** Medium (affects UX but app works without it)

---

## 15. Beta Testing

**Description:** Test with real users before public launch to find bugs and improve UX.

**What to Do:**
1. Recruit 5-10 beta users
   - Friends, family, or early adopters
   - Mix of tech-savvy and non-tech users
2. Give them access
   - Free accounts or special beta access
   - Clear instructions on what to test
3. Collect feedback
   - What works well
   - What's confusing
   - What breaks
   - What's missing
4. Fix critical bugs
   - Fix issues found
   - Improve UX based on feedback

**Example Beta Test Plan:**
```
Week 1: Onboard 5 users
Week 2: They use the platform, report issues
Week 3: Fix critical bugs, iterate
Week 4: Onboard 5 more users, repeat
```

**Time Required:** 2-4 weeks

**Priority:** High (find bugs before launch, but can be done post-launch with limited users)

---

## 16. Legal & Compliance

**Description:** Legal requirements before launch - privacy policy, terms of service, GDPR compliance.

**What to Check:**

1. **Privacy Policy**
   - What data you collect
   - How you use it
   - How users can delete it
   - GDPR compliance (if serving EU users)

2. **Terms of Service**
   - User responsibilities
   - Your responsibilities
   - Payment terms
   - Refund policy

3. **GDPR Compliance (if needed)**
   - Data export (users can download their data)
   - Data deletion (users can delete account)
   - Cookie consent banner (if using cookies)

4. **Payment Compliance**
   - Stripe terms
   - Refund policy
   - Tax handling

**Current Status:**
- ✅ PrivacyPage.tsx exists
- ✅ TermsPage.tsx exists
- ⚠️ Need to verify they're complete and match actual practices

**What to Do:**
1. Review existing privacy/terms pages
2. Update if needed (add missing sections)
3. Add cookie consent if needed
4. Add data export/deletion features (if GDPR required)

**Time Required:** 1 week
- Day 1-2: Review and update legal pages
- Day 3-4: Add GDPR features if needed
- Day 5: Legal review (optional: lawyer)

**Priority:** High (legal requirement, but can launch with basic pages and add features later)

---

## 17. Launch Checklist Execution

**Description:** Final checks before going live - deploy, test, monitor.

**Pre-Launch Checklist:**
```
□ All critical bugs fixed
□ Beta testing complete (optional for MVP)
□ Legal pages updated
□ Privacy policy live
□ Terms of service live
□ Payment processing tested
□ Email sending tested
□ Error tracking (Sentry) configured
□ Analytics (PostHog) configured
□ Domain name configured
□ SSL certificate installed
□ Database backups set up
□ Environment variables set in production
□ API keys configured (Stripe, Resend, etc.)
```

**Launch Day:**
```
□ Deploy to production
□ Test all critical flows:
  - Signup works
  - Login works
  - Payment works
  - Chat works
  - Dashboard works
□ Monitor error logs
□ Check server performance
□ Announce on social media
□ Post on Product Hunt (optional)
```

**Post-Launch:**
```
□ Monitor for 24 hours
□ Fix any critical issues
□ Respond to user feedback
```

**Time Required:** 1 week
- Days 1-3: Pre-launch checklist
- Day 4: Deploy and test
- Days 5-7: Monitor and fix issues

**Priority:** High (must do before launch, but can be done incrementally)

---

## Priority Ranking

### High Priority (Do Before/During Launch)
1. **Launch Checklist Execution** - Must do before going live
2. **Legal & Compliance** - Legal requirement (can start with basic pages)
3. **Beta Testing** - Find bugs before launch (can be limited to 5 users)

### Medium Priority (Post-Launch Polish)
4. **Accessibility Audit** - Legal requirement, improves UX
5. **Performance Optimization** - Affects user experience
6. **WebSocket for Real-Time Updates** - High impact on UX
7. **Data Export** - Privacy/Compliance requirement
8. **Account Deletion** - Privacy/Compliance requirement

### Low Priority (Future Features)
9. **API Keys Section** - Enables integrations
10. **Advanced Analytics** - Nice to have
11. **Bulk Operations** - Efficiency improvement
12. **Custom Domain** - Professional feature
13. **Multi-Language Support** - International expansion
14. **Advanced Payment Options** - Monetization flexibility
15. **Team/Collaboration** - Enterprise feature
16. **Cost Tracking & Analytics** - Cost optimization

---

## 18. External Monitoring & Analytics Integrations

**Description:** Professional-grade error tracking and performance monitoring tools for production environments with thousands of users.

**Note:** Not needed for MVP launch. All analytics and monitoring will be implemented via `/admin` endpoint initially. These external tools should be considered when scaling to production-grade infrastructure.

### A. Error Tracking (Sentry)

**Description:** Integrate Sentry for comprehensive error tracking across frontend and backend.

**Implementation:**
- Install Sentry SDK for frontend (`@sentry/react`)
- Install Sentry SDK for backend (`@sentry/node`)
- Configure error boundaries in React
- Set up error alerting (email/Slack notifications)
- Add breadcrumbs for debugging context
- Configure error grouping and deduplication
- Set up error rate monitoring dashboard

**When to Implement:**
- When user base grows to 1000+ active users
- When you need advanced error tracking and debugging
- When you need automatic error notifications

**Files to create/modify:**
- `frontend/react-app/src/config/sentry.ts` - Frontend Sentry config
- `backend/src/config/sentry.ts` - Backend Sentry config
- `frontend/react-app/src/components/ErrorBoundary.tsx` - React error boundary

---

### B. Performance Monitoring (New Relic / Datadog)

**Description:** Set up APM (Application Performance Monitoring) tools for real-time performance tracking.

**Implementation:**
- Choose APM tool (New Relic, Datadog, or similar)
- Install APM agent in backend
- Configure performance tracking
- Set up dashboards for:
  - API latency metrics (p50, p95, p99)
  - LLM API latency separately
  - Database query execution times
  - Memory usage and CPU metrics
- Set up alerts for latency > 5 seconds
- Create real-time performance dashboard

**When to Implement:**
- When you need advanced performance monitoring
- When scaling to handle high traffic
- When you need detailed performance analytics

**Files to create/modify:**
- `backend/src/config/apm.ts` - APM configuration
- `backend/src/middleware/performance.ts` - Performance middleware

---

### C. Advanced Analytics (PostHog)

**Description:** Full-featured product analytics platform for user behavior tracking and insights.

**Implementation:**
- Install PostHog SDK
- Configure event tracking
- Set up user funnels
- Create custom dashboards
- Set up feature flags
- Configure session recordings

**When to Implement:**
- When you need advanced product analytics
- When you want user behavior insights
- When implementing A/B testing

**Note:** PostHog is already partially integrated but full implementation can be done later when needed.

---

## Notes

- All items are optional and not required for immediate launch
- Implementation order should be based on user feedback and business priorities
- Some features may require additional infrastructure (e.g., WebSocket server scaling)
- Consider GDPR/compliance implications for data export and account deletion
- **Accessibility, Performance, Beta Testing, Legal, and Launch Checklist** can be done incrementally post-launch
- Platform is functionally complete - these are polish and operational tasks
- **External integrations (Sentry, New Relic, Datadog, PostHog) are not needed for MVP** - use `/admin` endpoint for analytics initially

