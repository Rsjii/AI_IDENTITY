# Integration Test Checklist

This checklist covers critical user flows that should be tested before each release.

## Pre-Deployment Checklist

### ✅ Authentication & Onboarding
- [ ] User can sign up with email
- [ ] OTP verification works
- [ ] User can complete onboarding flow (Quiz → Content → Voice → Plan → Deploy)
- [ ] User can log in and out
- [ ] Session persistence works

### ✅ Public Chat Flow
- [ ] Public chat page loads with creator info
- [ ] User can send messages
- [ ] AI responds correctly
- [ ] Free message limit (3) is enforced
- [ ] Payment prompt appears after limit
- [ ] Payment flow works end-to-end
- [ ] Full answer is unlocked after payment
- [ ] Email receipt is sent (if configured)

### ✅ Pay-Per-Chat
- [ ] Creator can enable/disable pay-per-chat in settings
- [ ] Payment trigger rules work (keywords, length, always require)
- [ ] Payment modal shows correct pricing
- [ ] Stripe PaymentElement loads correctly
- [ ] Payment confirmation works
- [ ] Earnings are recorded correctly
- [ ] Creator can view earnings in dashboard

### ✅ Widget Integration
- [ ] Widget embed code is generated correctly
- [ ] Widget loads on external website
- [ ] Widget chat works
- [ ] Widget respects creator plan limits
- [ ] Widget shows upgrade message when limit reached
- [ ] Widget session counting is correct (not over-counting)

### ✅ Subscription Flow
- [ ] Pricing page displays correctly
- [ ] User can select plan (Starter/Growth/Scale)
- [ ] Stripe checkout session is created
- [ ] Trial period (7 days) is applied for new subscriptions
- [ ] Webhook updates user plan tier
- [ ] Plan limits are enforced

### ✅ Creator Dashboard
- [ ] Dashboard loads with correct data
- [ ] Chat statistics are accurate
- [ ] Revenue/earnings are displayed
- [ ] Analytics charts render
- [ ] Satisfaction scores are calculated
- [ ] Top questions are shown

### ✅ Earnings & Payouts
- [ ] Earnings are calculated correctly (available vs pending)
- [ ] CSV export works
- [ ] Payout request can be submitted (min $10)
- [ ] Payout history is displayed

### ✅ Settings
- [ ] Profile can be updated
- [ ] Payment settings can be configured
- [ ] Payment trigger rules can be set
- [ ] Billing history is displayed

### ✅ Integrations
- [ ] Instagram DM integration (if configured)
- [ ] WhatsApp integration (if configured)
- [ ] Extension API works with valid token

### ✅ Error Handling
- [ ] 404 pages work correctly
- [ ] API errors are handled gracefully
- [ ] Network errors show user-friendly messages
- [ ] Validation errors are displayed

### ✅ Performance
- [ ] Page load times are acceptable (< 3s)
- [ ] API responses are fast (< 1s for most endpoints)
- [ ] No memory leaks in long-running sessions
- [ ] Database queries are optimized

## Manual Testing Scripts

### Test Public Chat with Payment
1. Navigate to `/chat/{creator-slug}`
2. Send 3 messages (should be free)
3. Send 4th message (should trigger payment)
4. Complete payment flow
5. Verify full answer is unlocked
6. Check email for receipt (if email configured)

### Test Widget
1. Get embed code from `/onboarding/deploy`
2. Add to test HTML page
3. Open page and interact with widget
4. Verify messages are sent
5. Check dashboard for session count

### Test Subscription
1. Go to `/pricing`
2. Select a plan
3. Complete Stripe checkout
4. Verify plan tier is updated
5. Check plan limits are enforced

## Automated Smoke Tests

Run smoke tests:
```bash
cd backend
npx tsx src/scripts/smokeTests.ts
```

Set environment variables for full testing:
```bash
export API_BASE=http://localhost:3000
export TEST_EXTENSION_TOKEN=your_token_here
```

## Known Issues

- Email sending requires Resend API key configuration
- Stripe Connect payouts require full Stripe Connect setup
- Some features require specific environment variables

## Post-Deployment Verification

After deployment, verify:
1. All smoke tests pass
2. Critical user flows work
3. No console errors in browser
4. Database migrations applied
5. Environment variables are set correctly






