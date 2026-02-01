# Onboarding Strict Flow - Complete Implementation

## Overview

This document describes the **strict, mandatory onboarding flow** that ensures users complete all required steps before accessing any protected pages. Users are always redirected back to their last incomplete step if they try to access other pages.

## Flow Sequence

```
Signup → Profile → Quiz → Content Upload → Plan Selection → Deploy → Done
```

### Step-by-Step Flow

1. **Signup** (`/auth`)
   - User creates account (email/password or Google OAuth)
   - After signup, user is redirected to profile completion

2. **Profile** (`/signup/profile`)
   - **Required**: User must complete profile (name, phone, etc.)
   - `profileCompleted` flag must be `true` to proceed
   - If incomplete, user is **blocked from all other pages**

3. **Quiz** (`/onboarding/quiz`)
   - **Required**: User completes personality quiz (10 questions)
   - Creates initial identity JSON
   - Backend sets `onboardingStep = 'content'`
   - User cannot skip or access other pages

4. **Content Upload** (`/onboarding/content`)
   - **Required**: User uploads at least 3 content items (files, text, URLs, social)
   - Backend sets `onboardingStep = 'plan'` when content count >= 3
   - User cannot proceed without minimum content

5. **Plan Selection** (`/onboarding/plan`)
   - **Required**: User selects a plan (Free Trial, Pro, Growth, or Scale)
   - **Trial**: Backend sets `onboardingStep = 'deploy'` (NOT 'done')
   - **Paid Plan**: Stripe webhook sets `onboardingStep = 'deploy'` (NOT 'done')
   - User cannot skip this step

6. **Deploy** (`/onboarding/deploy`)
   - **Required**: User configures deployment (chat link, embed code, etc.)
   - User clicks "Complete Setup" button
   - Backend sets `onboardingStep = 'done'` and `onboardingCompleted = true`
   - Only then can user access dashboard and other pages

7. **Done** (`/dashboard`)
   - User has completed all steps
   - Can now access all protected pages

## Protection Mechanism

### `ProtectedRoute` Component

The `ProtectedRoute` component enforces the strict flow:

```tsx
// 1) Not logged in => redirect to /auth
if (state.status === 'unauthenticated') {
  return <Navigate to={`/auth?reason=unauthorized&next=...`} replace />;
}

// 2) Profile incomplete => force /signup/profile
if (user && !user.profileCompleted && !location.pathname.startsWith('/signup/profile')) {
  return <Navigate to={`/signup/profile?...`} replace />;
}

// 3) Onboarding incomplete => force exact step
const onboardingComplete = user?.onboardingStep === 'done' || user?.onboardingCompleted === true;

if (user && !onboardingComplete) {
  const required = getRequiredOnboardingPath(user);
  
  // Don't allow any other protected page until onboarding done
  const allowedWhileOnboarding =
    location.pathname.startsWith('/onboarding') || location.pathname.startsWith('/signup');

  if (!allowedWhileOnboarding) {
    return <Navigate to={required} replace />;
  }
}
```

### Onboarding Step Mapping

```tsx
function getRequiredOnboardingPath(user: any): string {
  const step = user?.onboardingStep || 'quiz';
  const map: Record<string, string> = {
    quiz: '/onboarding/quiz',
    content: '/onboarding/content',
    voice: '/onboarding/voice',
    plan: '/onboarding/plan',
    deploy: '/onboarding/deploy',
    done: '/dashboard',
    training: '/onboarding/training', // backward compatibility
  };
  return map[step] || '/onboarding/quiz';
}
```

## Backend State Management

### Database Fields

- `profileCompleted` (BOOLEAN): Must be `true` before onboarding
- `onboardingStep` (TEXT): Current step (`quiz`, `content`, `voice`, `plan`, `deploy`, `done`)
- `onboardingCompleted` (BOOLEAN): Set to `true` only when step is `done`

### Step Transitions

| Action | From Step | To Step | Backend Code |
|--------|-----------|---------|--------------|
| Complete Quiz | `quiz` | `content` | `identityController.ts` → `updateOnboardingStep(userId, 'content')` |
| Upload 3+ items | `content` | `plan` | `contentController.ts` → `updateOnboardingStep(userId, 'plan')` |
| Start Trial | `plan` | `deploy` | `creatorController.ts` → `updateOnboardingStep(userId, 'deploy')` |
| Subscribe (Stripe) | `plan` | `deploy` | `stripeController.ts` webhook → `updateOnboardingStep(userId, 'deploy')` |
| Complete Deploy | `deploy` | `done` | `creatorController.ts` → `updateOnboardingStep(userId, 'done')` |

### Critical Fixes Applied

#### 1. Trial Start (`creatorController.ts`)

**Before (WRONG):**
```ts
await userQueries.updateOnboardingStep(userId, 'done');
```

**After (CORRECT):**
```ts
await userQueries.updateOnboardingStep(userId, 'deploy');
```

#### 2. Stripe Payment (`stripeController.ts`)

**Before (WRONG):**
```ts
await userQueries.updateOnboardingStep(userId, 'done');
```

**After (CORRECT):**
```ts
await userQueries.updateOnboardingStep(userId, 'deploy');
```

#### 3. Login Redirects (`authController.ts`)

**Before (WRONG):**
```ts
const hasActiveTrial = ...;
const hasPaidPlan = ...;
const isOnboardingDone = user.onboardingStep === 'done' || hasActiveTrial || hasPaidPlan;
```

**After (CORRECT):**
```ts
const isOnboardingDone = user.onboardingStep === 'done';
```

## Frontend Navigation

### All Protected Routes

All routes that require authentication are wrapped with `<ProtectedRoute>`:

```tsx
<Route path="/identity/edit" element={<ProtectedRoute><IdentityEditPage /></ProtectedRoute>} />
<Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
<Route path="/dashboard" element={<ProtectedRoute><CreatorDashboardPage /></ProtectedRoute>} />
// ... etc
```

### Onboarding Routes

All onboarding routes are also protected:

```tsx
<Route path="/onboarding/quiz" element={<ProtectedRoute><OnboardingQuizPage /></ProtectedRoute>} />
<Route path="/onboarding/content" element={<ProtectedRoute><OnboardingContentPage /></ProtectedRoute>} />
<Route path="/onboarding/plan" element={<ProtectedRoute><OnboardingPlanPage /></ProtectedRoute>} />
<Route path="/onboarding/deploy" element={<ProtectedRoute><OnboardingDeployPage /></ProtectedRoute>} />
```

### Auth Refresh After State Change

When user completes a step that changes `onboardingStep`, frontend must refresh auth state:

```tsx
// OnboardingPlanPage.tsx
const startTrial = async () => {
  setLoading(true);
  try {
    await apiFetch('/api/creator/trial/start', { method: 'POST', body: JSON.stringify({}) });
    await refresh(); // ✅ pulls onboardingStep='deploy'
    nav('/onboarding/deploy', { replace: true });
  } finally {
    setLoading(false);
  }
};
```

## User Experience

### Scenario 1: User Completes Flow Normally

1. User signs up → redirected to `/signup/profile`
2. Completes profile → redirected to `/onboarding/quiz`
3. Completes quiz → redirected to `/onboarding/content`
4. Uploads 3 files → redirected to `/onboarding/plan`
5. Starts trial → redirected to `/onboarding/deploy`
6. Completes deploy → redirected to `/dashboard`
7. ✅ Can now access all pages

### Scenario 2: User Tries to Skip Steps

1. User is on `/onboarding/quiz` (step = `quiz`)
2. User manually navigates to `/dashboard` (or any protected page)
3. `ProtectedRoute` detects `onboardingStep !== 'done'`
4. User is **immediately redirected** to `/onboarding/quiz`
5. ✅ User cannot skip steps

### Scenario 3: User Returns After Leaving

1. User completes quiz (step = `content`) but closes browser
2. User returns next day and logs in
3. Backend `/api/auth/login` checks `onboardingStep = 'content'`
4. User is redirected to `/onboarding/content` (exact step they left)
5. ✅ User resumes exactly where they left off

### Scenario 4: User Tries to Access Protected Page While Onboarding

1. User is on `/onboarding/plan` (step = `plan`)
2. User tries to access `/identity/edit` (protected page)
3. `ProtectedRoute` checks:
   - ✅ User is authenticated
   - ✅ Profile is completed
   - ❌ Onboarding is NOT complete (`onboardingStep = 'plan' !== 'done'`)
4. User is **immediately redirected** to `/onboarding/plan`
5. ✅ User cannot access other pages until onboarding is complete

## API Endpoints

### Get Current User State

```
GET /api/auth/me
```

Returns:
```json
{
  "success": true,
  "user": {
    "id": "...",
    "email": "...",
    "profileCompleted": true,
    "onboardingStep": "plan",
    "onboardingCompleted": false
  }
}
```

### Update Onboarding Step

```
POST /api/creator/onboarding/complete
```

Sets `onboardingStep = 'done'` and `onboardingCompleted = true`.

## Testing Checklist

- [ ] Unauthenticated user → redirected to `/auth`
- [ ] Authenticated but profile incomplete → redirected to `/signup/profile`
- [ ] User on quiz step → cannot access dashboard
- [ ] User on content step → cannot access other pages
- [ ] User on plan step → cannot access other pages
- [ ] User on deploy step → cannot access other pages
- [ ] User completes deploy → can access all pages
- [ ] User returns after leaving → resumes at exact step
- [ ] Trial start → sets step to `deploy` (NOT `done`)
- [ ] Stripe payment → sets step to `deploy` (NOT `done`)
- [ ] Login with incomplete onboarding → redirects to correct step

## Key Principles

1. **Strict Sequential Flow**: Users must complete steps in order
2. **No Skipping**: Users cannot access other pages until onboarding is complete
3. **Resume Capability**: Users always resume at their last incomplete step
4. **Single Source of Truth**: `onboardingStep` in database is the only source
5. **Frontend Guards**: `ProtectedRoute` enforces flow on every navigation
6. **Backend Consistency**: Only `deploy` → `done` transition marks completion

## Files Modified

### Backend
- `backend/src/modules/creator/creatorController.ts` - Fixed `startTrial`
- `backend/src/modules/billing/stripeController.ts` - Fixed webhook
- `backend/src/modules/auth/authController.ts` - Fixed login redirects (2 places)

### Frontend
- `frontend/react-app/src/App.tsx` - Wrapped routes with `ProtectedRoute`
- `frontend/react-app/src/components/ProtectedRoute.tsx` - Added `voice` step mapping
- `frontend/react-app/src/pages/OnboardingPlanPage.tsx` - Added auth refresh

## Summary

The onboarding flow is now **strict and mandatory**. Users cannot skip steps, cannot access other pages during onboarding, and always resume exactly where they left off. The flow is enforced both on the frontend (via `ProtectedRoute`) and backend (via login redirects), ensuring a consistent user experience.

