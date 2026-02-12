# 📊 PRICING & LIMITS FLOW DIAGRAMS
**Visual Implementation Guide**

> **⚡ WANT THE SIMPLE VERSION?** See [MVP_PRICING_IMPLEMENTATION_PLAN.md](./MVP_PRICING_IMPLEMENTATION_PLAN.md) for code-ready examples.
>
> This document shows comprehensive flows. The MVP doc gives you copy-paste code.

---

## 1️⃣ END-USER ACCESS FLOW

### Scenario A: Free User Hits Limit
```
User visits creator's chat page
         ↓
    [Free Chat UI]
         ↓
After 3 messages → Paywall appears
         ↓
┌────────────────────────────────────────┐
│      Choose Your Access Type           │
├────────────────────────────────────────┤
│                                        │
│  [Pay Once] ✓    [Subscribe]          │ ← Tabs
│                                        │
│  ┌──────────────────────────────┐     │
│  │ 24-Hour Priority Pass        │     │
│  │ ✓ 100 messages               │     │
│  │ ✓ Priority response speed    │     │
│  │ ✓ Access for 24 hours        │     │
│  │                              │     │
│  │ $10.00 one-time              │     │
│  │                              │     │
│  │ [Select Country: India ▼]   │     │
│  │ [Pay $10 - Razorpay]         │     │
│  └──────────────────────────────┘     │
│                                        │
│  💡 Subscribe to save 60%              │
│  Monthly: $20/mo vs $300/year         │
└────────────────────────────────────────┘
         ↓
User clicks [Subscribe] tab
         ↓
┌────────────────────────────────────────┐
│  [Pay Once]    [Subscribe] ✓           │
│                                        │
│  ┌──────────────────────────────┐     │
│  │ VIP Unlimited Subscription   │     │
│  │ ✓ 1,000 messages/month       │     │
│  │ ✓ Priority response          │     │
│  │ ✓ Voice messages             │     │
│  │ ✓ File uploads               │     │
│  │ ✓ Cancel anytime             │     │
│  │                              │     │
│  │ $20.00/month                 │     │
│  │                              │     │
│  │ [Select Country: India ▼]   │     │
│  │ [Subscribe - Razorpay]       │     │
│  └──────────────────────────────┘     │
│                                        │
│  💰 Save 60% vs pay-per-chat          │
└────────────────────────────────────────┘
         ↓
User selects country and pays
         ↓
    ┌─────────┴─────────┐
    │                   │
India (Razorpay)   International (LemonSqueezy)
    │                   │
    ↓                   ↓
Payment succeeds    Payment succeeds
    │                   │
    └─────────┬─────────┘
              ↓
     Backend updates database:
     - premium_sessions (24h pass)
       OR
     - marketplace_subscriptions (monthly)
              ↓
     User gains access to chat
              ↓
     Chat UI shows remaining usage:
     "82/100 messages left (24h pass)"
          OR
     "846/1,000 messages left this month"
```

---

### Scenario B: User with 24h Pass Upgrades to Subscription
```
User has active 24h pass (12h remaining)
         ↓
User clicks "Subscribe" in chat
         ↓
┌────────────────────────────────────────┐
│  ✨ Upgrade to VIP Subscription?      │
├────────────────────────────────────────┤
│  You currently have:                   │
│  🎫 24h Pass (12 hours left)          │
│  💬 Used: 42/100 messages             │
│                                        │
│  Upgrade to VIP and get:              │
│  ✓ Unlimited access forever           │
│  ✓ 1,000 messages/month               │
│  ✓ Voice messages & file uploads      │
│  ✓ Higher priority response           │
│                                        │
│  Your remaining 12h will be credited: │
│  First month: $15 (25% off $20)      │
│                                        │
│  [Upgrade to VIP - $15/mo]            │
│  [Keep 24h Pass]                      │
└────────────────────────────────────────┘
         ↓
User upgrades
         ↓
Backend logic:
1. Keep premium_sessions (don't delete)
2. Create marketplace_subscriptions
3. In checkUserAccess():
   - Priority: subscription > pay-per-chat
   - User now uses subscription limits
   - 24h pass ignored but kept in DB
         ↓
User now has VIP subscription
Chat UI shows: "846/1,000 messages this month"
```

---

### Scenario C: Access Priority Check (Middleware)
```
POST /api/public/chat/:username
         ↓
     Middleware: checkUserAccess()
         ↓
┌──────────────────────────────────────┐
│  Query: Check user access types      │
├──────────────────────────────────────┤
│  1. marketplace_subscriptions        │
│     WHERE userId=$1 AND status='active'│
│     AND currentPeriodEnd > NOW()     │
│         ↓                             │
│     Found? → Use subscription limits  │
│         ↓                             │
│     Not found → Check next           │
│                                      │
│  2. premium_sessions                 │
│     WHERE sessionId=$1               │
│     AND expiresAt > NOW()            │
│         ↓                             │
│     Found? → Use pay-per-chat limits │
│         ↓                             │
│     Not found → Use free tier        │
└──────────────────────────────────────┘
         ↓
Return access object:
{
  accessType: 'subscription', // or 'pay_per_chat', 'free'
  limit: 1000,
  rateLimit: 10,
  expiresAt: '2026-03-09',
  features: ['voice', 'files', 'priority']
}
         ↓
Allow/deny message based on usage
```

---

## 2️⃣ CREATOR STORAGE FLOW

### Scenario A: Free Tier Creator Hits Storage Limit
```
Creator uploads file (60 MB PDF)
         ↓
POST /api/content/upload
         ↓
Middleware: checkStorageQuota()
         ↓
┌────────────────────────────────────┐
│  Query: Get storage usage          │
├────────────────────────────────────┤
│  User.storageQuotaBytes: 52428800  │ (50 MB)
│  creator_storage_usage.used: 45MB  │
│                                    │
│  New total: 45 MB + 60 MB = 105 MB│
│  Quota: 50 MB                      │
│                                    │
│  105 MB > 50 MB? → REJECT         │
└────────────────────────────────────┘
         ↓
Return 413 Payload Too Large
         ↓
Frontend shows modal:
┌────────────────────────────────────┐
│  ⚠️ Storage Limit Reached          │
├────────────────────────────────────┤
│  Your 50 MB storage is full.       │
│  Used: 45 MB / 50 MB               │
│                                    │
│  File: "large-book.pdf" (60 MB)    │
│  Cannot upload - exceeds limit     │
│                                    │
│  Options:                          │
│  1. Delete old files               │
│  2. Upgrade to Starter (250 MB)    │
│                                    │
│  [Manage Files] [Upgrade Plan]     │
└────────────────────────────────────┘
```

---

### Scenario B: Starter Creator Uploads Successfully
```
Creator uploads file (25 MB PDF)
         ↓
POST /api/content/upload
         ↓
Middleware: checkStorageQuota()
         ↓
┌────────────────────────────────────┐
│  User.storageQuotaBytes: 262144000 │ (250 MB)
│  creator_storage_usage.used: 120MB│
│                                    │
│  New total: 120 MB + 25 MB = 145MB│
│  Quota: 250 MB                     │
│                                    │
│  145 MB < 250 MB? → ALLOW ✓       │
└────────────────────────────────────┘
         ↓
1. Save file to /uploads/userId/filename.pdf
2. Insert into uploaded_files table:
   {
     id: 'file_xyz',
     userId: 'user_abc',
     fileName: 'training-data.pdf',
     fileSizeBytes: 26214400,
     fileType: 'application',
     uploadedAt: NOW()
   }
3. Update creator_storage_usage:
   storageUsedBytes: 120MB → 145MB
   fileCount: 12 → 13
         ↓
Return 200 OK
         ↓
Frontend shows success:
┌────────────────────────────────────┐
│  ✅ File uploaded successfully     │
├────────────────────────────────────┤
│  training-data.pdf (25 MB)         │
│                                    │
│  Storage: 145 MB / 250 MB (58%)    │
│  Files: 13                         │
└────────────────────────────────────┘
```

---

### Scenario C: Growth Creator at 80% Storage
```
Creator's Dashboard loads
         ↓
GET /api/creator/storage-usage
         ↓
Response:
{
  storageUsedBytes: 1717986918,  // 1.6 GB
  storageLimitBytes: 2147483648,  // 2 GB
  fileCount: 247,
  percentage: 80
}
         ↓
Frontend renders StorageUsageCard:
┌────────────────────────────────────┐
│  📦 Storage Usage                  │
├────────────────────────────────────┤
│  1.6 GB / 2 GB                     │
│  [████████████████░░░░] 80%        │
│                                    │
│  ⚠️ Warning: Low on storage        │
│  You've used 80% of your 2 GB.     │
│                                    │
│  Options:                          │
│  • Delete old files                │
│  • Upgrade to Scale (10 GB)        │
│                                    │
│  [Manage Files] [Upgrade]          │
└────────────────────────────────────┘
         ↓
Creator clicks [Manage Files]
         ↓
Navigate to /settings/files
         ↓
┌──────────────────────────────────────────────────────┐
│  Your Files (247 total)                              │
├──────────────────────────────────────────────────────┤
│  Sort: [Size ▼] [Date] [Type]                       │
│  Filter: [All ▼] [PDF] [Images] [Audio] [Unused]    │
├──────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────┐ │
│  │ 📄 old-training-v1.pdf                         │ │
│  │ 450 MB • Uploaded 3 months ago                 │ │
│  │ Last used: Never                               │ │
│  │ [Download] [Delete] ← Mark as unused          │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ 📄 training-final.pdf                          │ │
│  │ 350 MB • Uploaded 1 month ago                  │ │
│  │ Last used: Yesterday                           │ │
│  │ [Download] [Delete] ← Currently active        │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  💡 Tip: Delete "old-training-v1.pdf" to free 450MB│
└──────────────────────────────────────────────────────┘
         ↓
Creator deletes old file
         ↓
1. Mark as deleted: uploaded_files.isDeleted = true
2. Update usage: storageUsedBytes -= 450 MB
3. Schedule actual file deletion (cron job)
         ↓
Storage: 1.6 GB → 1.15 GB (57%)
```

---

## 3️⃣ CREATOR PLAN UPGRADE FLOW

### Scenario: Free Tier Creator Tries to Publish
```
Creator toggles "Make Public" switch
         ↓
POST /api/marketplace/listings/:id
{ isPublic: true }
         ↓
Backend: Check plan tier
         ↓
┌────────────────────────────────────┐
│  User.planTier: 'free'             │
│  User.trialEndsAt: NULL            │
│                                    │
│  Is trying to publish? YES         │
│  Plan tier = free? YES             │
│  Trial active? NO                  │
│                                    │
│  → REJECT with 403 Forbidden       │
└────────────────────────────────────┘
         ↓
Return error:
{
  error: 'Upgrade to Starter plan to publish'
}
         ↓
Frontend shows modal:
┌────────────────────────────────────┐
│  🔒 Upgrade Required               │
├────────────────────────────────────┤
│  Publishing to marketplace         │
│  requires a paid plan.             │
│                                    │
│  Current plan: Free                │
│  • 50 MB storage                   │
│  • 100 chats/month                 │
│  • Testing only                    │
│                                    │
│  Upgrade to Starter:               │
│  • 250 MB storage                  │
│  • 1,000 chats/month               │
│  • Marketplace publishing ✓        │
│  • Basic analytics                 │
│                                    │
│  Only $15/month                    │
│                                    │
│  [Upgrade to Starter]              │
│  [View All Plans]                  │
└────────────────────────────────────┘
```

---

## 4️⃣ MESSAGE LIMIT TRACKING FLOW

### Scenario: Subscription User Approaching Monthly Limit
```
User sends message #850 (of 1,000 limit)
         ↓
POST /api/public/chat/:username
         ↓
Middleware: checkUserAccess()
         ↓
┌────────────────────────────────────┐
│  Query: access_limits table        │
│  WHERE userId=$1 AND creatorId=$2  │
│        AND periodStart < NOW()     │
│        AND periodEnd > NOW()       │
├────────────────────────────────────┤
│  Found record:                     │
│  {                                 │
│    accessType: 'subscription',     │
│    messagesUsed: 849,              │
│    messagesLimit: 1000,            │
│    periodStart: '2026-02-01',      │
│    periodEnd: '2026-03-01'         │
│  }                                 │
│                                    │
│  New total: 849 + 1 = 850          │
│  Percentage: 850/1000 = 85%        │
│                                    │
│  85% > 80%? → WARN USER           │
└────────────────────────────────────┘
         ↓
Allow message but include warning
         ↓
Response:
{
  success: true,
  message: "...",
  usage: {
    used: 850,
    limit: 1000,
    percentage: 85,
    warningThreshold: true
  }
}
         ↓
Frontend shows banner in chat:
┌────────────────────────────────────┐
│  ⚠️ Message Limit Warning          │
│  You've used 850/1,000 messages    │
│  this month (85%). Plan renews on  │
│  March 1st.                        │
│                                    │
│  [Dismiss] [Contact Creator]       │
└────────────────────────────────────┘
```

---

### Scenario: User Hits Hard Limit
```
User sends message #1,001 (exceeds 1,000 limit)
         ↓
Middleware: checkUserAccess()
         ↓
┌────────────────────────────────────┐
│  messagesUsed: 1000                │
│  messagesLimit: 1000               │
│                                    │
│  1000 >= 1000? → REJECT           │
└────────────────────────────────────┘
         ↓
Return 402 Payment Required
         ↓
Frontend shows modal:
┌────────────────────────────────────┐
│  🚫 Monthly Limit Reached          │
├────────────────────────────────────┤
│  You've used all 1,000 messages    │
│  included in your VIP subscription.│
│                                    │
│  Your plan renews on March 1st.    │
│                                    │
│  Options:                          │
│  1. Wait 2 days for renewal        │
│  2. Contact creator for extension  │
│  3. Upgrade to higher tier plan    │
│     (if available)                 │
│                                    │
│  [Wait for Renewal]                │
│  [Contact Creator]                 │
└────────────────────────────────────┘
```

---

## 5️⃣ RATE LIMITING FLOW

### Scenario: Free User Spamming Messages
```
User sends 3 messages in 5 seconds
         ↓
Message 1: ✓ Allowed (lastMessageAt: NULL)
         ↓
Update: User.lastMessageAt = NOW()
         ↓
Message 2 (2 seconds later):
         ↓
Middleware: Check rate limit
         ↓
┌────────────────────────────────────┐
│  accessType: 'free'                │
│  rateLimit: 0.1 msg/sec            │
│  (= 1 message per 10 seconds)      │
│                                    │
│  lastMessageAt: 2 seconds ago      │
│  Required gap: 10 seconds          │
│                                    │
│  2 < 10? → REJECT                 │
└────────────────────────────────────┘
         ↓
Return 429 Too Many Requests
         ↓
Frontend shows toast:
┌────────────────────────────────────┐
│  ⏱️ Slow down!                     │
│  Free tier: 1 message per 10 sec   │
│  Please wait 8 more seconds.       │
│                                    │
│  Upgrade for faster responses:     │
│  • 24h Pass: 5 msg/min             │
│  • VIP Sub: 10 msg/min             │
└────────────────────────────────────┘
```

---

## 6️⃣ CRON JOBS & BACKGROUND TASKS

### Task 1: Reset Monthly Limits
```
Cron: Run daily at 00:00 UTC
         ↓
Query: Find expired periods
SELECT * FROM access_limits
WHERE periodEnd < NOW()
  AND accessType = 'subscription'
         ↓
For each record:
1. Check if subscription still active
   → marketplace_subscriptions.status = 'active'
2. If yes, create new period:
   INSERT INTO access_limits
   (userId, creatorId, accessType, messagesUsed, messagesLimit, periodStart, periodEnd)
   VALUES
   ($1, $2, 'subscription', 0, 1000, NOW(), NOW() + INTERVAL '1 month')
3. Delete old record
         ↓
Log results:
"✅ Reset 47 subscription limits for March 2026"
```

---

### Task 2: Expire 24h Passes
```
Cron: Run every hour
         ↓
Query: Find expired passes
SELECT * FROM premium_sessions
WHERE expiresAt < NOW()
  AND NOT expired
         ↓
For each record:
1. Mark as expired (for analytics)
   UPDATE premium_sessions
   SET expired = true
   WHERE id = $1
2. Send notification email (optional)
   "Your 24h pass for @creator has expired"
3. Suggest upgrade to subscription
         ↓
Log results:
"✅ Expired 12 premium sessions"
```

---

### Task 3: Cleanup Deleted Files
```
Cron: Run weekly on Sundays at 02:00 UTC
         ↓
Query: Find files marked for deletion > 7 days ago
SELECT * FROM uploaded_files
WHERE isDeleted = true
  AND deletedAt < NOW() - INTERVAL '7 days'
         ↓
For each file:
1. Delete physical file from disk
   fs.unlink(file.filePath)
2. Delete database record
   DELETE FROM uploaded_files WHERE id = $1
3. Log for audit trail
         ↓
Log results:
"✅ Cleaned up 23 deleted files (1.2 GB freed)"
```

---

### Task 4: Recalculate Storage Usage
```
Cron: Run daily at 03:00 UTC
         ↓
For each creator:
1. Sum all uploaded_files where isDeleted = false
   SELECT userId, SUM(fileSizeBytes) as total, COUNT(*) as count
   FROM uploaded_files
   WHERE isDeleted = false
   GROUP BY userId
2. Update creator_storage_usage
   UPDATE creator_storage_usage
   SET storageUsedBytes = $1,
       fileCount = $2,
       lastCalculatedAt = NOW()
   WHERE userId = $3
3. If usage > 80% of quota, send email warning
         ↓
Log results:
"✅ Recalculated storage for 1,247 creators"
"⚠️ 34 creators over 80% storage quota"
```

---

## 7️⃣ WEBHOOK HANDLING

### LemonSqueezy: Subscription Cancelled
```
POST /api/billing/lemonsqueezy/webhook
         ↓
Verify signature
         ↓
Parse payload:
{
  eventName: 'subscription_cancelled',
  custom: { userId: 'user_abc', tier: 'growth' }
}
         ↓
┌────────────────────────────────────┐
│  Check: Is this trial expiry?      │
│  OR manual cancellation?           │
├────────────────────────────────────┤
│  Query User.trialEndsAt            │
│  Is trialEndsAt < NOW()? YES       │
│  → This is trial expiry            │
└────────────────────────────────────┘
         ↓
Handle trial expiry:
1. Downgrade user
   UPDATE User SET planTier = 'free'
2. Hide marketplace listing
   UPDATE marketplace_listings
   SET isPublic = false
   WHERE creatorId = $1
3. Send email notification
   "Your trial has expired. Upgrade to keep your listing live."
4. Schedule cleanup of user's data (optional)
         ↓
Return 200 OK
```

---

## 8️⃣ ERROR HANDLING FLOW

### API Error Response Structure
```
HTTP Status Codes:

401 Unauthorized
→ User not logged in
→ Action: Redirect to /login

402 Payment Required
→ User hit usage limit
→ Action: Show upgrade modal

403 Forbidden
→ User's plan doesn't allow this feature
→ Action: Show "Upgrade Required" modal

413 Payload Too Large
→ File exceeds storage quota
→ Action: Show "Storage Full" modal

429 Too Many Requests
→ User exceeded rate limit
→ Action: Show "Slow Down" toast with timer

500 Internal Server Error
→ Server/database error
→ Action: Show generic error + contact support
```

### Example Error Response:
```json
{
  "error": "Storage quota exceeded",
  "message": "Your 250 MB storage is full. Delete old files or upgrade your plan.",
  "code": "STORAGE_QUOTA_EXCEEDED",
  "details": {
    "used": 262144000,
    "quota": 262144000,
    "overage": 52428800,
    "suggestedAction": "upgrade_or_delete"
  },
  "actions": [
    {
      "label": "Manage Files",
      "url": "/settings/files"
    },
    {
      "label": "Upgrade Plan",
      "url": "/pricing"
    }
  ]
}
```

---

## 9️⃣ TESTING SCENARIOS

### Test Case 1: Pay-Per-Chat → Subscription Upgrade
```
1. User signs up, visits creator chat
2. Click "Pay Once" → Pay $10 → Get 24h pass
3. Send 50 messages → Verify usage tracked
4. Click "Subscribe" → See upgrade modal with credit
5. Subscribe for $15 (25% off) → Verify discount applied
6. Verify priority switched to subscription limits
7. Verify 24h pass ignored but not deleted
8. Wait for 24h expiry → Verify subscription still active
```

### Test Case 2: Storage Quota Enforcement
```
1. Create free tier account (50 MB quota)
2. Upload 40 MB PDF → Success
3. Check dashboard → Storage shows 40/50 MB (80%)
4. Try upload 20 MB PDF → Reject with 413 error
5. Delete 40 MB file → Verify storage freed
6. Upload 20 MB PDF → Success
7. Upgrade to Starter → Verify quota increased to 250 MB
```

### Test Case 3: Message Limit Warning
```
1. Create subscription with 1,000 msg/mo limit
2. Simulate usage: Set messagesUsed = 850
3. Send message → Verify warning banner appears
4. Continue to 1,000 messages → Verify chat locks
5. Show "Monthly Limit Reached" modal
6. Simulate month rollover → Verify limit resets
```

---

## 🎯 PRIORITY CHECKLIST

### Week 1: Critical Implementation
```
□ Add access_limits table
□ Add creator_storage_usage table
□ Add uploaded_files table
□ Implement checkUserAccess() middleware
□ Implement checkStorageQuota() middleware
□ Update content upload routes
□ Add message counting per tier
□ Add storage tracking per upload
□ Create error response structure
```

### Week 2: UI & Warnings
```
□ Build MessageLimitWarning component
□ Build StorageUsageCard component
□ Add warnings at 80% usage (both limits)
□ Add upgrade modals for quota exceeded
□ Build FilesManagementPage
□ Update CreatorDashboardPage with storage card
□ Add usage graphs/charts
```

### Week 3: Background Jobs
```
□ Cron: Reset monthly message limits
□ Cron: Expire 24h passes
□ Cron: Cleanup deleted files
□ Cron: Recalculate storage usage
□ Email notifications for warnings
□ Email notifications for expirations
```

---

**Next Steps:**
1. Review these flows with team
2. Confirm database schema changes
3. Implement Week 1 changes
4. Test all scenarios end-to-end
5. Deploy to staging
6. Launch! 🚀
