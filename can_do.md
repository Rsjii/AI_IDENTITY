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

## Priority Ranking

1. **WebSocket for Real-Time Updates** - High impact on UX
2. **API Keys Section** - Enables integrations
3. **Data Export** - Privacy/Compliance requirement
4. **Account Deletion** - Privacy/Compliance requirement
5. **Advanced Analytics** - Nice to have
6. **Bulk Operations** - Efficiency improvement
7. **Custom Domain** - Professional feature
8. **Multi-Language Support** - International expansion
9. **Advanced Payment Options** - Monetization flexibility
10. **Team/Collaboration** - Enterprise feature
11. **Cost Tracking & Analytics** - Cost optimization (low priority)

---

## Notes

- All items are optional and not required for Phase 1
- Implementation order should be based on user feedback and business priorities
- Some features may require additional infrastructure (e.g., WebSocket server scaling)
- Consider GDPR/compliance implications for data export and account deletion

