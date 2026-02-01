# Auth/Onboarding Gating & Session Isolation Fix

## Problem Statement

Three critical issues were identified:

1. **Unauthenticated users accessing protected pages** → No proper redirect with return URL preservation
2. **Onboarding/profile gating incomplete** → Users could skip steps or access wrong pages
3. **Same PC multi-user session leakage** → localStorage keys were global, causing user data to leak between accounts
4. **Anonymous chat access** → Public chat was accessible without authentication

---

## Root Causes Identified

### 1. Auth Redirect Missing `next` Parameter
- `ProtectedRoute` redirected unauthenticated users to `/auth` but didn't preserve the originally requested URL
- After login, users were sent to default redirect instead of where they originally wanted to go

### 2. Onboarding/Profile Gating Partial
- `ProtectedRoute` only checked if onboarding was incomplete, but didn't enforce the **exact step** user should be on
- Users could access `/onboarding/plan` even if they were on `/onboarding/content` step
- No strict enforcement of step sequence

### 3. Same PC Multi-User localStorage Leak
- Onboarding quiz progress stored in global key: `onboarding-quiz-answers`
- Session activity tracked in global key: `lastActivity`
- Autosave keys were global: `autosave_${elementId}`
- **Result:** User B logging in on same PC would see User A's onboarding state

### 4. Anonymous Chat Access
- `/chat/:slug` route was public (not behind `ProtectedRoute`)
- Backend `/api/public/chat` didn't require authentication
- Anonymous users could chat without logging in

---

## Solution Overview

### 1. ProtectedRoute Enhancement
- ✅ Preserve original URL in `next` parameter
- ✅ Enforce exact onboarding step (no skipping)
- ✅ Strict profile completion check

### 2. Auth Flow with Return URL
- ✅ `AuthPage` respects `next` parameter after login/signup
- ✅ `SignupProfilePage` preserves `next` and returns user to original destination

### 3. User-Scoped localStorage
- ✅ All localStorage keys now include userId: `key:${userId}`
- ✅ Cleanup on logout to prevent leakage
- ✅ Separate storage per user on same device

### 4. Chat Authentication Required
- ✅ Backend requires JWT for chat/history/feedback endpoints
- ✅ Frontend shows login prompt for unauthenticated users
- ✅ Chat sessions now tracked by userId (not just visitorId)

---

## File-by-File Changes

### Frontend Changes

#### 1. `frontend/react-app/src/components/ProtectedRoute.tsx`

**Changes:**
- Added `buildNextUrl()` helper to preserve full URL (pathname + search + hash)
- Added `getRequiredOnboardingPath()` to map onboarding step to exact route
- Enhanced redirect logic:
  - Unauthenticated → `/auth?reason=unauthorized&next=${originalUrl}`
  - Profile incomplete → `/signup/profile?email=...&next=${originalUrl}`
  - Onboarding incomplete → Redirects to **exact step** (quiz/content/plan/deploy)

**Key Logic:**
```typescript
// 1) Not logged in => go to auth, but preserve next
if (state.status === 'unauthenticated') {
  return <Navigate to={`/auth?reason=unauthorized&next=${encodeURIComponent(next)}`} replace />;
}

// 2) Profile incomplete => force /signup/profile, preserve next
if (user && !user.profileCompleted && !location.pathname.startsWith('/signup/profile')) {
  return <Navigate to={`/signup/profile?email=${encodeURIComponent(user.email)}&next=${encodeURIComponent(next)}`} replace />;
}

// 3) Onboarding incomplete => force the exact step they are on
const required = getRequiredOnboardingPath(user);
if (location.pathname.startsWith('/onboarding') && location.pathname !== required) {
  return <Navigate to={required} replace />;
}
```

---

#### 2. `frontend/react-app/src/pages/AuthPage.tsx`

**Changes:**
- Extract `next` parameter from URL query
- Validate `next` is internal path (starts with `/`)
- After successful login/signup, navigate to `next` if present (before backend redirect)

**Key Logic:**
```typescript
const nextParam = q.get('next') || '';
const safeNext = useMemo(() => {
  return nextParam.startsWith('/') ? nextParam : '';
}, [nextParam]);

// In handleLogin:
if (safeNext) {
  navigate(safeNext, { replace: true });
  return; // ProtectedRoute will still validate profile/onboarding
}
```

---

#### 3. `frontend/react-app/src/pages/SignupProfilePage.tsx`

**Changes:**
- Extract `next` parameter from URL query
- After profile completion, navigate to `next` (or default to `/onboarding/quiz`)

**Key Logic:**
```typescript
const nextParam = q.get('next') || '';
const safeNext = nextParam.startsWith('/') ? nextParam : '';

// After profile save:
navigate(safeNext || '/onboarding/quiz', { replace: true });
```

---

#### 4. `frontend/react-app/src/pages/OnboardingQuizPage.tsx`

**Changes:**
- Changed from global key `onboarding-quiz-answers` to user-scoped: `onboarding-quiz-answers:${userId}`
- Added `useAuth()` hook to get current userId
- Storage key now includes userId to prevent cross-user leakage

**Key Logic:**
```typescript
function quizStorageKey(userId: string) {
  return `onboarding-quiz-answers:${userId}`;
}

const userId = useMemo(() => {
  return state.status === 'authenticated' ? state.user.id : 'anon';
}, [state.status, state.user?.id]);

const key = useMemo(() => quizStorageKey(userId), [userId]);

// Save/load using user-scoped key
localStorage.setItem(key, JSON.stringify({ answers, lastStep: currentStep }));
```

---

#### 5. `frontend/react-app/src/contexts/AuthContext.tsx`

**Changes:**
- User-scoped `lastActivity` key: `lastActivity:${userId}`
- User-scoped autosave keys: `autosave:${userId}:${elementId}`
- Enhanced logout cleanup:
  - Remove legacy global keys
  - Remove all autosave keys (legacy + new format)

**Key Logic:**
```typescript
// Session tracking (user-scoped)
const userId = state.user.id;
const LAST_ACTIVITY_KEY = `lastActivity:${userId}`;

// Autosave (user-scoped)
localStorage.setItem(`autosave:${userId}:${el.id}`, el.value);

// Logout cleanup
localStorage.removeItem('lastActivity');
localStorage.removeItem('onboarding-quiz-answers');
// Remove all autosave keys
```

---

#### 6. `frontend/react-app/src/pages/PublicChatPage.tsx`

**Changes:**
- Added `useAuth()` hook to check authentication status
- Added login prompt banner when not authenticated
- Disabled input/button when not logged in
- Added `credentials: 'include'` to all API calls
- Check auth before sending messages

**Key Logic:**
```typescript
const { state } = useAuth();
const isAuthed = state.status === 'authenticated';

const send = async () => {
  if (!isAuthed) {
    nav(`/auth?reason=unauthorized&next=${encodeURIComponent(`/chat/${slug}`)}`, { replace: true });
    return;
  }
  // ... send message
};

// UI: Login banner
{!isAuthed && (
  <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
    <div>Login required to chat.</div>
    <Link to={`/auth?reason=unauthorized&next=${encodeURIComponent(`/chat/${slug}`)}`}>
      Login
    </Link>
  </div>
)}

// Disabled input
<textarea
  disabled={!isAuthed || typing}
  placeholder={isAuthed ? 'Type your message...' : 'Login to start chatting...'}
/>
```

---

### Backend Changes

#### 7. `backend/src/modules/public/publicRoutes.ts`

**Changes:**
- Added `requireJWTFromCookie` middleware to chat/history/feedback routes
- Creator lookup remains public (for displaying profile)

**Key Logic:**
```typescript
import { requireJWTFromCookie } from '../../middleware/jwtCookie';

// ✅ require login for chat + history (+ feedback)
router.get('/history', requireJWTFromCookie, asyncHandler(publicHistory));
router.post('/chat', requireJWTFromCookie, publicChatRateLimit, asyncHandler(publicChat));
router.post('/feedback', requireJWTFromCookie, asyncHandler(publicFeedback));

// Creator profile remains public
router.get('/creator/:slug', asyncHandler(getCreator));
```

---

#### 8. `backend/src/modules/public/publicController.ts`

**Changes:**
- `publicChat()` now requires `req.user.id` (from JWT middleware)
- Chat sessions now track `userId` (not just `visitorId`)
- `publicHistory()` now uses userId-based access control (removed anonymous visitor-only access)

**Key Logic:**
```typescript
export async function publicChat(req: any, res: Response) {
  const viewerUserId = req.user?.id;
  if (!viewerUserId) return res.status(401).json({ error: 'Unauthorized', errorCode: 'UNAUTHORIZED' });

  // Create session with userId tracked
  const s = await chatSessionQueries.create({
    creatorId: u.id,
    visitorId: visitorId || null, // optional
    userId: viewerUserId,          // ✅ now tracked
    platform: 'web',
  });
}

export async function publicHistory(req: any, res: Response) {
  const viewerUserId = req.user?.id;
  if (!viewerUserId) return res.status(401).json({ error: 'Unauthorized', errorCode: 'UNAUTHORIZED' });

  // ✅ auth-based access control
  if (session.userId && session.userId !== viewerUserId) {
    return res.status(403).json({ error: 'Session access denied' });
  }
}
```

---

#### 9. `backend/src/modules/auth/authController.ts`

**Changes:**
- `logout()` now revokes the current auth session in database
- Extracts `sessionId` from JWT token before clearing cookies

**Key Logic:**
```typescript
export const logout = async (req: any, res: Response, next: NextFunction) => {
  const token = req.cookies?.['jwtToken'];
  let decoded: any = null;

  if (token) {
    try {
      decoded = verifyJWT(token);
    } catch {
      decoded = null;
    }
  }

  const userId = decoded?.userId || req.session?.userId || null;
  const sessionId = decoded?.sessionId || null;

  // ✅ Revoke current auth_session (so "active sessions" stays correct)
  if (userId && sessionId) {
    const { revokeAuthSession } = await import('../../services/authSessionService');
    revokeAuthSession(sessionId, userId).catch(() => {});
  }

  // Clear cookies and session
  res.clearCookie('jwtToken', { ... });
  res.clearCookie('refreshToken', { ... });
  if (req.session) req.session.destroy(() => {});
};
```

---

## Final Flow Diagrams

### Flow 1: Unauthenticated User Accessing Protected Page

```
User tries to access /dashboard
    ↓
ProtectedRoute checks: state.status === 'unauthenticated'
    ↓
Redirect to: /auth?reason=unauthorized&next=/dashboard
    ↓
User logs in successfully
    ↓
AuthPage checks: safeNext exists? → Yes
    ↓
Navigate to: /dashboard
    ↓
ProtectedRoute checks again:
  - ✅ Authenticated? Yes
  - ✅ Profile complete? Check
  - ✅ Onboarding complete? Check
    ↓
If all checks pass → Show /dashboard
If profile incomplete → Redirect to /signup/profile?next=/dashboard
If onboarding incomplete → Redirect to exact step (e.g., /onboarding/content)
```

---

### Flow 2: Onboarding Step Enforcement

```
User on /onboarding/content (step: content)
    ↓
User tries to access /onboarding/plan (step: plan)
    ↓
ProtectedRoute checks:
  - onboardingStep = 'content'
  - required = '/onboarding/content'
  - current path = '/onboarding/plan'
    ↓
location.pathname !== required → Redirect to /onboarding/content
    ↓
User cannot skip steps
```

---

### Flow 3: Same PC Multi-User Session Isolation

```
User A logs in
    ↓
OnboardingQuizPage: userId = 'user-a-id'
    ↓
localStorage key: 'onboarding-quiz-answers:user-a-id'
    ↓
User A completes quiz, saves answers
    ↓
User A logs out
    ↓
AuthContext.logout():
  - Clears 'lastActivity'
  - Clears 'onboarding-quiz-answers'
  - Clears all autosave keys
    ↓
User B logs in (same PC)
    ↓
OnboardingQuizPage: userId = 'user-b-id'
    ↓
localStorage key: 'onboarding-quiz-answers:user-b-id'
    ↓
✅ User B sees empty quiz (no User A data)
```

---

### Flow 4: Anonymous Chat Block

```
Anonymous user visits /chat/creator-slug
    ↓
PublicChatPage renders
    ↓
isAuthed = false (state.status === 'unauthenticated')
    ↓
UI shows:
  - Login banner: "Login required to chat"
  - Disabled input: "Login to start chatting..."
  - Disabled send button
    ↓
User clicks "Login" button
    ↓
Navigate to: /auth?reason=unauthorized&next=/chat/creator-slug
    ↓
User logs in
    ↓
Navigate back to: /chat/creator-slug
    ↓
isAuthed = true
    ↓
User can now chat
    ↓
Backend /api/public/chat requires JWT (requireJWTFromCookie)
    ↓
Chat session created with userId tracked
```

---

## Testing Checklist

### ✅ Test 1: Unauthenticated Access
1. Logout (or clear cookies)
2. Try to access `/dashboard`
3. **Expected:** Redirect to `/auth?reason=unauthorized&next=/dashboard`
4. Login
5. **Expected:** Redirect back to `/dashboard` (or appropriate step if incomplete)

### ✅ Test 2: Onboarding Step Enforcement
1. Login as user with `onboardingStep = 'content'`
2. Try to access `/onboarding/plan` directly
3. **Expected:** Redirect to `/onboarding/content`
4. Complete content step
5. **Expected:** Can now access `/onboarding/plan`

### ✅ Test 3: Multi-User Session Isolation
1. Login as User A
2. Start onboarding quiz, fill some answers
3. Logout
4. Login as User B (same browser/PC)
5. Go to onboarding quiz
6. **Expected:** Empty quiz (no User A's answers)

### ✅ Test 4: Anonymous Chat Block
1. Logout
2. Visit `/chat/creator-slug`
3. **Expected:** 
   - Login banner visible
   - Input disabled
   - Send button disabled
4. Click "Login"
5. **Expected:** Redirect to auth page with `next=/chat/creator-slug`
6. Login
7. **Expected:** Redirect back to chat, can now send messages

### ✅ Test 5: Profile Completion Flow
1. New user signs up
2. **Expected:** Redirect to `/signup/profile`
3. Complete profile
4. **Expected:** Redirect to `/onboarding/quiz` (or `next` if provided)

---

## Key Improvements Summary

| Issue | Before | After |
|-------|--------|-------|
| **Unauthenticated redirect** | Lost original URL | Preserved in `next` parameter |
| **Onboarding step enforcement** | Could skip steps | Exact step enforced, no skipping |
| **Multi-user localStorage** | Global keys, data leaked | User-scoped keys, isolated |
| **Anonymous chat** | Allowed without login | Requires authentication |
| **Session tracking** | Only visitorId | userId + visitorId tracked |
| **Logout cleanup** | Only cookies cleared | Cookies + localStorage + DB session revoked |

---

## Security Benefits

1. **No unauthorized access** → All protected routes require authentication
2. **No step skipping** → Users must complete onboarding in order
3. **No data leakage** → User data isolated per account
4. **No anonymous chat** → All chat interactions require authentication
5. **Proper session management** → Sessions revoked on logout, tracked in DB

---

## Notes

- All localStorage keys are now user-scoped to prevent cross-account leakage
- `next` parameter is validated to only accept internal paths (starts with `/`)
- Onboarding steps are strictly enforced - users cannot access future steps
- Chat sessions now track both `userId` (authenticated) and `visitorId` (optional, for analytics)
- Backend middleware `requireJWTFromCookie` ensures all chat operations are authenticated

---

## Related Files

- `frontend/react-app/src/components/ProtectedRoute.tsx`
- `frontend/react-app/src/pages/AuthPage.tsx`
- `frontend/react-app/src/pages/SignupProfilePage.tsx`
- `frontend/react-app/src/pages/OnboardingQuizPage.tsx`
- `frontend/react-app/src/contexts/AuthContext.tsx`
- `frontend/react-app/src/pages/PublicChatPage.tsx`
- `backend/src/modules/public/publicRoutes.ts`
- `backend/src/modules/public/publicController.ts`
- `backend/src/modules/auth/authController.ts`

---

**Date:** 2024
**Status:** ✅ Implemented and Tested

