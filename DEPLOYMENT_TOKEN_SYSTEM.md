# Token-Based Pricing System - Deployment Guide

**Date:** 2026-02-10
**Version:** 1.0
**Status:** Ready for deployment

---

## Overview

This guide covers deploying the complete token-based pricing system for the AI Avatar platform. The system includes:

- ✅ Token usage tracking for all AI conversations
- ✅ Creator subscription plans (FREE/STARTER/GROWTH/SCALE)
- ✅ End-user token packs (one-time purchases)
- ✅ Usage-based limits with visual indicators
- ✅ Webhook integration for payments
- ✅ Comprehensive analytics

---

## Pre-Deployment Checklist

### 1. Database Backup
```bash
# Create a backup before running migrations
pg_dump -h <host> -U <user> -d <database> > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Environment Verification
Ensure you have access to:
- PostgreSQL database (write access)
- Razorpay account (India)
- LemonSqueezy account (International)
- Production environment variables

---

## Step 1: Database Migration

### Run Migration SQL

```bash
# Connect to your database
psql -h <host> -U <user> -d <database>

# Or using environment URL
psql $DATABASE_URL

# Run the migration file
\i backend/src/config/migrations/add_token_system.sql
```

### Expected Output
```
CREATE TABLE
CREATE INDEX
...
NOTICE: Token system tables created successfully:
NOTICE: - token_usage: 0
NOTICE: - creator_token_aggregates: X (number of existing users)
NOTICE: - user_creator_token_aggregates: 0
NOTICE: - token_packs: 0
NOTICE: Migration completed successfully!
```

### Verify Migration
```sql
-- Check new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('token_usage', 'creator_token_aggregates', 'user_creator_token_aggregates', 'token_packs');

-- Check new columns added
SELECT column_name FROM information_schema.columns
WHERE table_name = 'User'
AND column_name IN ('plan_tier', 'plan_token_quota', 'plan_storage_mb');

-- Check helper functions
SELECT proname FROM pg_proc
WHERE proname IN ('get_user_token_pack_balance', 'get_creator_period_usage', 'get_user_free_tier_usage');
```

---

## Step 2: Environment Variables

### Add to `.env` file:

```bash
# =====================================================
# TOKEN SYSTEM CONFIGURATION
# =====================================================

# Feature flag (set to true to enable token system)
ENABLE_TOKEN_SYSTEM=true

# LemonSqueezy Variant IDs for Creator Plans
LEMONSQUEEZY_VARIANT_ID_CREATOR_STARTER=variant_xxxxx
LEMONSQUEEZY_VARIANT_ID_CREATOR_GROWTH=variant_xxxxx
LEMONSQUEEZY_VARIANT_ID_CREATOR_SCALE=variant_xxxxx

# LemonSqueezy Variant IDs for Token Packs
LEMONSQUEEZY_VARIANT_ID_TOKEN_PACK_SMALL=variant_xxxxx
LEMONSQUEEZY_VARIANT_ID_TOKEN_PACK_MEDIUM=variant_xxxxx
LEMONSQUEEZY_VARIANT_ID_TOKEN_PACK_LARGE=variant_xxxxx
LEMONSQUEEZY_VARIANT_ID_TOKEN_PACK_JUMBO=variant_xxxxx

# Razorpay Configuration (already exists, verify pricing)
RAZORPAY_KEY_ID=rzp_xxxxx
RAZORPAY_KEY_SECRET=xxxxx

# Optional: Token system tuning
TOKEN_FREE_TIER_LIMIT=10000
TOKEN_RATE_LIMIT_FREE=1
TOKEN_RATE_LIMIT_PACK=5
TOKEN_RATE_LIMIT_SUB=10
```

---

## Step 3: LemonSqueezy Product Setup

### Create Products in LemonSqueezy Dashboard

#### Creator Plans
1. **Starter Plan**
   - Name: "Creator Starter Plan"
   - Price: $15/month (or annual $150)
   - Copy variant ID to `LEMONSQUEEZY_VARIANT_ID_CREATOR_STARTER`

2. **Growth Plan**
   - Name: "Creator Growth Plan"
   - Price: $60/month (or annual $600)
   - Copy variant ID to `LEMONSQUEEZY_VARIANT_ID_CREATOR_GROWTH`

3. **Scale Plan**
   - Name: "Creator Scale Plan"
   - Price: $175/month (or annual $1,750)
   - Copy variant ID to `LEMONSQUEEZY_VARIANT_ID_CREATOR_SCALE`

#### Token Packs
1. **Small Pack** - $5 (150K tokens)
2. **Medium Pack** - $10 (350K tokens)
3. **Large Pack** - $25 (1M tokens)
4. **Jumbo Pack** - $50 (2.5M tokens)

Copy each variant ID to the corresponding environment variable.

---

## Step 4: Razorpay Product Setup

For Indian users, Razorpay will be used. The system already supports dynamic pricing, but verify:

```typescript
// In creatorPlanController.ts and tokenPackController.ts
// Prices are already configured in code (in paise/cents)

Creator Plans (India):
- Starter: ₹1,500 (1500 paise)
- Growth: ₹6,000 (6000 paise)
- Scale: ₹17,500 (17500 paise)

Token Packs (India):
- Small: ₹500 (500 paise)
- Medium: ₹1,000 (1000 paise)
- Large: ₹2,500 (2500 paise)
- Jumbo: ₹5,000 (5000 paise)
```

No additional Razorpay setup needed - dynamic order creation handles this.

---

## Step 5: Deploy Backend

### Build and Deploy

```bash
# Navigate to backend directory
cd backend

# Install dependencies (if not already installed)
npm install

# Build TypeScript
npm run build

# Run tests (optional but recommended)
npm test

# Start production server
npm run start
# OR with PM2
pm2 restart ai-identity-backend
```

### Verify Deployment

```bash
# Check server health
curl https://your-domain.com/api/health

# Check token system endpoints
curl https://your-domain.com/api/billing/creator-plan \
  -H "Cookie: jwtToken=YOUR_JWT"

# Check token packs endpoint
curl https://your-domain.com/api/marketplace/token-packs/YOUR_CREATOR_ID
```

---

## Step 6: Testing

### Manual Testing Checklist

#### 1. Creator Plan Management
- [ ] View current plan: `GET /api/billing/creator-plan`
- [ ] View usage stats: `GET /api/billing/creator-plan/usage`
- [ ] Create checkout (Razorpay): `POST /api/billing/creator-plan/checkout` (with billingCountry=IN)
- [ ] Create checkout (LemonSqueezy): `POST /api/billing/creator-plan/checkout` (without billingCountry)
- [ ] Verify payment: `POST /api/billing/creator-plan/verify`
- [ ] Cancel plan: `POST /api/billing/creator-plan/cancel`

#### 2. Token Pack Purchases
- [ ] View available packs: `GET /api/marketplace/token-packs/:creatorId`
- [ ] Create checkout: `POST /api/marketplace/token-packs/checkout`
- [ ] Verify payment: `POST /api/marketplace/token-packs/verify`
- [ ] Check balance: `GET /api/marketplace/token-packs/balance?creatorId=...`

#### 3. Chat with Token Checking
- [ ] Chat as free user (10K tokens/month limit)
- [ ] Chat with token pack (deducts from pack)
- [ ] Chat with subscription (deducts from subscription quota)
- [ ] Hit rate limit (verify 1/5/10 msg/min based on tier)
- [ ] Reach token limit (verify paywall appears)
- [ ] Verify usage indicator shows correct percentage

#### 4. Webhook Testing
- [ ] Trigger LemonSqueezy webhook for creator plan
- [ ] Trigger LemonSqueezy webhook for token pack
- [ ] Verify database records created correctly
- [ ] Verify fee split (25% platform, 75% creator)

---

## Step 7: Monitoring & Alerts

### Key Metrics to Monitor

1. **Token Usage**
   ```sql
   -- Total tokens consumed today
   SELECT SUM(total_tokens)
   FROM token_usage
   WHERE created_at >= CURRENT_DATE;

   -- Average tokens per message
   SELECT AVG(total_tokens)
   FROM token_usage
   WHERE created_at >= CURRENT_DATE;
   ```

2. **Creator Quotas**
   ```sql
   -- Creators approaching limit (>80%)
   SELECT u.email, u.plan_tier,
          cta.tokens_used_this_period,
          u.plan_token_quota,
          (cta.tokens_used_this_period::float / u.plan_token_quota * 100) as percentage
   FROM "User" u
   JOIN creator_token_aggregates cta ON cta.creator_id = u.id
   WHERE (cta.tokens_used_this_period::float / u.plan_token_quota * 100) > 80;
   ```

3. **Revenue**
   ```sql
   -- Token pack revenue today
   SELECT COUNT(*), SUM(amount_paid_cents)/100 as total_usd
   FROM token_packs
   WHERE purchased_at >= CURRENT_DATE;
   ```

### Set Up Alerts

Create alerts for:
- ❗ Creators exceeding 100% quota
- ⚠️ High token usage rate (cost spike)
- ❗ Webhook failures
- ⚠️ Payment verification failures

---

## Step 8: Gradual Rollout Strategy

### Phase 1: Internal Testing (1-2 days)
- Enable for admin accounts only
- Test all flows manually
- Monitor error logs

### Phase 2: Beta Users (3-5 days)
- Enable for select creators (beta testers)
- Collect feedback
- Monitor usage patterns

### Phase 3: Soft Launch (1 week)
- Enable for all new signups
- Existing users see notification but not enforced
- Monitor system performance

### Phase 4: Full Rollout
- Enable for all users
- Existing users grandfathered with generous quotas
- Monitor and adjust limits as needed

---

## Rollback Plan

If issues arise, you can disable the system:

### 1. Disable Feature Flag
```bash
# In .env
ENABLE_TOKEN_SYSTEM=false
```

### 2. Restart Server
```bash
pm2 restart ai-identity-backend
```

### 3. Database Rollback (if needed)
```sql
-- Drop new tables (CAUTION: loses token usage data)
DROP TABLE IF EXISTS token_usage CASCADE;
DROP TABLE IF EXISTS creator_token_aggregates CASCADE;
DROP TABLE IF EXISTS user_creator_token_aggregates CASCADE;
DROP TABLE IF EXISTS token_packs CASCADE;

-- Remove added columns
ALTER TABLE "User"
  DROP COLUMN IF EXISTS plan_tier,
  DROP COLUMN IF EXISTS plan_token_quota,
  DROP COLUMN IF EXISTS plan_storage_mb,
  DROP COLUMN IF EXISTS storage_used_mb,
  DROP COLUMN IF EXISTS plan_period_start,
  DROP COLUMN IF EXISTS plan_period_end,
  DROP COLUMN IF EXISTS creator_plan_subscription_id,
  DROP COLUMN IF EXISTS plan_status;

ALTER TABLE marketplace_subscriptions
  DROP COLUMN IF EXISTS token_limit,
  DROP COLUMN IF EXISTS tokens_used_this_period,
  DROP COLUMN IF EXISTS period_start,
  DROP COLUMN IF EXISTS period_end;
```

---

## Troubleshooting

### Issue: Webhook Not Triggering
**Solution:**
1. Verify LemonSqueezy webhook URL is correct
2. Check `X-Signature` header validation
3. Check server logs for errors
4. Test with LemonSqueezy webhook tester

### Issue: Token Deduction Not Working
**Solution:**
1. Check `ENABLE_TOKEN_SYSTEM` is true
2. Verify `mirror_runs` table has token data
3. Check `recordTokenUsage()` logs
4. Verify database transaction not rolled back

### Issue: Rate Limit Too Strict
**Solution:**
1. Adjust rate limits in `tokenService.ts`
2. Or increase limits for specific users:
   ```sql
   -- Temporary override (implement in code)
   ```

### Issue: Creator Quota Exhausted
**Solution:**
1. Upgrade creator's plan
2. Or temporarily increase quota:
   ```sql
   UPDATE "User"
   SET plan_token_quota = plan_token_quota * 2
   WHERE id = 'creator_id';
   ```

---

## Post-Deployment Tasks

### Week 1
- [ ] Monitor token usage patterns
- [ ] Collect user feedback
- [ ] Adjust rate limits if needed
- [ ] Send usage reports to creators

### Week 2
- [ ] Analyze revenue impact
- [ ] Identify high-usage creators
- [ ] Offer plan upgrade incentives
- [ ] Fix any bugs discovered

### Month 1
- [ ] Review pricing strategy
- [ ] Consider introducing new tiers
- [ ] Implement usage alerts for users
- [ ] Build creator analytics dashboard

---

## Support & Documentation

### For Developers
- Code documentation: See inline comments in all new files
- Architecture diagram: See `FINAL_COMPLETE_IMPLEMENTATION_PLAN.md`
- API reference: Generate with `npm run docs`

### For Users
- Creator guide: How to manage token quotas
- End-user guide: How token packs work
- FAQ: Common questions about billing

---

## Success Criteria

The deployment is successful when:
- ✅ All database tables created without errors
- ✅ Webhooks processing payments correctly
- ✅ Token deduction working for all chat messages
- ✅ Rate limiting enforced properly
- ✅ Usage indicators displaying correctly
- ✅ No increase in error rate
- ✅ Payment flow completing successfully
- ✅ Revenue tracking accurate

---

## Contact

For deployment support or issues:
- GitHub Issues: https://github.com/your-repo/issues
- Email: dev@yourplatform.com
- Slack: #engineering

---

**Last Updated:** 2026-02-10
**Next Review:** After 30 days of production use
