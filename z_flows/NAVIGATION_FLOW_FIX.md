# Navigation Flow Fix - Complete Documentation

## Required Flow (as specified by user)

```
Signup → OTP → Profile → Onboarding (10 steps) → Dashboard

Back Button Behavior:
├─ Signup: BLOCKED (kill → back to signup)
├─ OTP: BLOCKED (kill → back to OTP)
├─ Profile: BLOCKED (kill → back to Profile)
├─ Onboarding Steps 1-10: BLOCKED during onboarding
│   └─ If killed during onboarding → Resume from last step (NOT step 1)
├─ Dashboard (after onboarding): Normal navigation
├─ Knowledge/Upload Page: Back → Dashboard (NOT back to onboarding)
└─ Settings/Other Pages: Back → Dashboard (NOT back to onboarding)
```

## Current Issues

1. **Issue #1:** After completing step 10 of onboarding, pressing back from Knowledge page goes to step 1 of onboarding
   - **Root Cause:** No check for onboarding completion status
   - **Fix:** Add onboarding completion check to all onboarding pages

2. **Issue #2:** Onboarding resume might not work properly
   - **Root Cause:** Backend tracks step but frontend might not use it correctly
   - **Fix:** Ensure OnboardingGatePage properly uses `user.onboardingStep`

3. **Issue #3:** Knowledge page allows back navigation to onboarding
   - **Root Cause:** No back prevention on Knowledge page
   - **Fix:** Add back prevention that redirects to dashboard

## Implementation Plan

### 1. Update OnboardingGatePage
- ✅ Already checks `user.onboardingStep` first
- ✅ Already redirects to `/dashboard` if step is 'done'
- ❌ Need to add safeguard: if user manually visits `/onboarding/*` after completion, redirect to dashboard

### 2. Update All Onboarding Pages (Quiz, Content, Plan, Deploy)
- Add check at mount: if `user.onboardingStep === 'done'`, redirect to `/dashboard`
- Keep existing back prevention logic

### 3. Update KnowledgeBasePage
- Add back navigation handler that redirects to `/dashboard`
- Prevent going back to onboarding

### 4. Backend Onboarding Step Tracking
- ✅ Already implemented in `updateOnboardingStep` function
- ✅ Only allows moving forward (quiz=0, content=1, voice=2, plan=3, deploy=4, done=5)
- ✅ Updates automatically when:
  - Identity created → 'content'
  - Content uploaded → 'plan' (if ≥3 items)
  - Trial started or payment completed → 'done'

## Files to Modify

1. `/frontend/react-app/src/pages/OnboardingGatePage.tsx` - Add redirect if done
2. `/frontend/react-app/src/pages/OnboardingQuizPage.tsx` - Add completion check
3. `/frontend/react-app/src/pages/OnboardingContentPage.tsx` - Add completion check
4. `/frontend/react-app/src/pages/OnboardingPlanPage.tsx` - Add completion check
5. `/frontend/react-app/src/pages/OnboardingDeployPage.tsx` - Add completion check
6. `/frontend/react-app/src/pages/KnowledgeBasePage.tsx` - Add back prevention
7. `/frontend/react-app/src/App.tsx` - Add route guard for `/onboarding/*`

## Expected Behavior After Fix

### Scenario 1: New User
1. Signup → OTP → Profile → Quiz (step 1)
2. Complete all 10 quiz steps → Content upload
3. Upload content → Plan select → Deploy → Dashboard
4. ✅ Cannot press back at any point during onboarding
5. ✅ If browser refreshed during quiz step 5, resume at step 5

### Scenario 2: Onboarding Complete, Visiting Knowledge
1. User completes onboarding → Dashboard
2. Navigate to `/knowledge` page
3. Press back → ✅ Goes to Dashboard (NOT back to onboarding)

### Scenario 3: Manual URL Navigation After Completion
1. User completes onboarding
2. Manually types `/onboarding/quiz` in address bar
3. ✅ Immediately redirected to `/dashboard`

### Scenario 4: Kill/Refresh During Onboarding
1. User at onboarding step 7 (content page)
2. Kills browser/refreshes
3. ✅ Redirected to step 7 (content), NOT step 1 (quiz)
4. ✅ Can continue from step 7

## Testing Checklist

- [ ] Back button blocked during signup
- [ ] Back button blocked during OTP
- [ ] Back button blocked during profile
- [ ] Back button blocked during onboarding steps
- [ ] Refresh during onboarding resumes from same step
- [ ] Kill browser during onboarding resumes from same step
- [ ] After onboarding, manual navigation to `/onboarding/*` redirects to dashboard
- [ ] Knowledge page back button goes to dashboard
- [ ] Settings page back button goes to dashboard (if applicable)
- [ ] Dashboard is accessible after onboarding completion
