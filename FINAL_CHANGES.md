Plan: I’ll (1) scan the repo for the exact places referenced in `FINAL_CHANGES.md` + your `KANA_HAI.md` items, (2) locate the type that’s rejecting `"signup"` and fix it safely, then (3) output **file-wise + line-wise** copy/paste patches (only the changed snippets) so you can apply them in Ask mode.

[8 tools called]

Nice—repo already has `User.onboardingStep` in DB schema and auth redirect reads it, so we mainly need to **persist step updates** (backend) + make frontend gate **trust `/api/auth/me`** first. Next I’ll open `eventLogger` types to fix the `"signup"` union error, then patch the onboarding + KANA_HAI UX items file-by-file with exact line ranges.

[31 tools called]

Aha: OTP resend backend endpoint already exists (`POST /api/auth/resend-otp`), but the verify pages don’t expose it yet. Also `ProtectedRoute` redirects unauth users silently—so we can add a clear error message (toast + redirect param) without touching backend auth. Next I’ll locate the request logger in `backend/src/app.ts`, `creatorController.startTrial`, `contentController.upload`, and then I’ll output the exact file-wise patches.

[39 tools called]

### 1) `backend/src/modules/auth/authController.ts`

#### A) Fix TS error: `"signup"` not assignable to `"landing" | "referral" | "direct"` (lines **195-202**)
Replace `source: 'signup'` with a non-typed meta key (keeps `source` semantics clean):

```ts
// ... existing code ...
// Log signup event (for password linking)
try {
  await EventLogger.logUserEvent(user.id, EVENT_TYPES.PASSWORD_LINKED, {
    flow: 'signup', // ✅ was: source: 'signup'
  });
} catch (eventError) {
  logger.warn({ err: eventError }, 'Failed to log password linking event');
}
// ... existing code ...
```

#### B) Resume exactly where left: don’t treat `deploy` as “done” (login redirect lines **979-986**)
```ts
// ... existing code ...
if (user.profileCompleted) {
  // Check onboarding step
  if (user.onboardingStep === 'done') { // ✅ removed: || user.onboardingStep === 'deploy'
    nextRedirect = await getPostLoginRedirect(user.id);
  } else {
    nextRedirect = `/onboarding/${user.onboardingStep || 'quiz'}`;
  }
} else {
  nextRedirect = '/onboarding/quiz';
}
// ... existing code ...
```

#### C) Same fix for login verify redirect (lines **1153-1160**)
```ts
// ... existing code ...
if (user.profileCompleted) {
  if (user.onboardingStep === 'done') { // ✅ removed: || user.onboardingStep === 'deploy'
    nextRedirect = await getPostLoginRedirect(user.id);
  } else {
    nextRedirect = `/onboarding/${user.onboardingStep || 'quiz'}`;
  }
} else {
  nextRedirect = '/onboarding/quiz';
}
// ... existing code ...
```

#### D) `/api/auth/me` must return onboardingStep (lines **1495-1513**)
Add `onboardingStep` into response:

```ts
return res.json({
  success: true,
  user: {
    id: user.id,
    publicId: tokenizeId(user.id, 'user'),
    email: user.email,
    handle: user.handle,
    name: user.name,
    bio: user.bio,
    dob: user.dob,
    phone: user.phone,
    profileImage: user.profileImage,
    profileCompleted: user.profileCompleted,
    active: user.active,
    onboardingStep: (user as any).onboardingStep, // ✅ ADD
    isAdmin,
    hasPassword: Boolean(user.passwordHash),
    hasGoogle: Boolean(user.googleId),
    timeZone: (user as any).timeZone || null,
  },
});
```

---

### 2) `backend/src/config/database.ts` (add DB helper)

Add this inside `export const userQueries = { ... }` **before** the closing `};` at line **958** (right after `startTrial` at **947-957**):

```ts
// ... existing code ...
startTrial: async (userId: string, days = 7) => {
  const r = await db.query(
    `UPDATE "User"
     SET "trialEndsAt" = (now() + ($1 || ' days')::interval),
         "updatedAt"=CURRENT_TIMESTAMP
     WHERE id=$2
     RETURNING *`,
    [String(days), userId]
  );
  return r.rows[0];
},

// ✅ ADD: only ADVANCE step (never regress)
updateOnboardingStep: async (
  userId: string,
  step: 'quiz' | 'content' | 'voice' | 'plan' | 'deploy' | 'done'
) => {
  await db.query(
    `
    UPDATE "User"
    SET "onboardingStep" = $1,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = $2
      AND (
        CASE "onboardingStep"
          WHEN 'quiz' THEN 0
          WHEN 'content' THEN 1
          WHEN 'voice' THEN 2
          WHEN 'plan' THEN 3
          WHEN 'deploy' THEN 4
          WHEN 'done' THEN 5
          ELSE 0
        END
      ) < (
        CASE $1
          WHEN 'quiz' THEN 0
          WHEN 'content' THEN 1
          WHEN 'voice' THEN 2
          WHEN 'plan' THEN 3
          WHEN 'deploy' THEN 4
          WHEN 'done' THEN 5
          ELSE 0
        END
      )
    `,
    [step, userId]
  );
},
// ... existing code ...
```

---

### 3) `backend/src/modules/identity/identityController.ts` (createIdentity → step = content)

In `createIdentity` after line **68** (after service success) and before `res.json(...)`:

```ts
// Create identity using service
const { identity, version } = await createIdentityService(req.user.id, identityJson);

// ✅ ADD: advance onboarding step
try {
  const { userQueries } = await import('../../config/database');
  await userQueries.updateOnboardingStep(req.user.id, 'content');
} catch {}

// ... existing res.json ...
```

---

### 4) `backend/src/modules/content/contentController.ts` (content added → step content/plan)

#### A) For `paste` (lines **35-42**)
```ts
const { title, text } = pasteSchema.parse(req.body);
const source = await createPasteSource(userId, title, text);

// ✅ ADD: advance step safely
try {
  const { userQueries } = await import('../../config/database');
  await userQueries.updateOnboardingStep(userId, 'content');
  const items = await knowledgeSourceQueries.listByUserId(userId);
  if ((items?.length || 0) >= 3) await userQueries.updateOnboardingStep(userId, 'plan');
} catch {}

return res.json({ success: true, source });
```

#### B) For `youtube` (lines **44-51**) and `url` (lines **53-60**)
Same block after `createYoutubeSource(...)` / `createUrlSource(...)` and before `res.json(...)`.

#### C) For `upload` (after line **469** before `return res.json(...)`)
```ts
const source = await createFileSource(userId, file, title);

// ✅ ADD: advance step safely
try {
  const { userQueries } = await import('../../config/database');
  await userQueries.updateOnboardingStep(userId, 'content');
  const items = await knowledgeSourceQueries.listByUserId(userId);
  if ((items?.length || 0) >= 3) await userQueries.updateOnboardingStep(userId, 'plan');
} catch {}

return res.json({
  success: true,
  source,
  message: 'File uploaded successfully. Processing embeddings...',
});
```

---

### 5) `backend/src/modules/creator/creatorController.ts` (trial start → step deploy)

In `startTrial` (lines **433-439**) add after line **437**:

```ts
const u = await userQueries.startTrial(userId, 7);

// ✅ ADD
await userQueries.updateOnboardingStep(userId, 'deploy');

return res.json({ success: true, trialEndsAt: u.trialEndsAt });
```

---

### 6) `backend/src/app.ts` (404 shouldn’t log as error)

Change line **462**:

```ts
// was: const logLevel = res.statusCode >= 400 ? 'error' : 'info';
const logLevel =
  res.statusCode >= 500 ? 'error'
  : res.statusCode >= 400 ? 'warn'
  : 'info';
```

---

## Frontend changes (FINAL_CHANGES + KANA_HAI)

### 7) `frontend/react-app/src/contexts/AuthContext.tsx` (MeUser includes onboardingStep)

Add in `MeUser` type (near lines **5-20**):

```ts
export type MeUser = {
  // ... existing fields ...
  onboardingStep?: 'quiz' | 'content' | 'voice' | 'plan' | 'deploy' | 'done'; // ✅ ADD
};
```

---

### 8) `frontend/react-app/src/pages/OnboardingGatePage.tsx` (single entry; use onboardingStep first)

Replace the `useEffect` body (lines **18-59**) with:

```ts
useEffect(() => {
  (async () => {
    try {
      // ✅ Step 0: trust server onboardingStep first
      try {
        const me = await apiFetch<{ success: true; user: { onboardingStep?: string } }>('/api/auth/me');
        const step = me?.user?.onboardingStep;

        if (step) {
          if (step === 'done') {
            nav('/dashboard', { replace: true });
          } else {
            nav(`/onboarding/${step}`, { replace: true });
          }
          return;
        }
      } catch {
        // ignore; fallback to heuristic below
      }

      // Step 1: Check if identity exists
      try {
        await apiFetch('/api/identity/me');
      } catch (err: any) {
        if (err?.status === 404) {
          nav('/onboarding/quiz', { replace: true });
          return;
        }
        nav('/dashboard', { replace: true });
        return;
      }

      // Step 2: Check content count
      try {
        const content = await apiFetch<{ items: any[] }>('/api/content/list');
        const count = content?.items?.length || 0;

        if (count < 3) nav('/onboarding/content', { replace: true });
        else nav('/onboarding/plan', { replace: true });
      } catch {
        nav('/onboarding/content', { replace: true });
      }
    } catch {
      nav('/dashboard', { replace: true });
    }
  })();
}, [nav]);
```

---

### 9) `frontend/react-app/src/pages/OnboardingQuizPage.tsx` (remove duplicate identity check)

Delete this whole block (lines **105-119**):

```ts
// Check if identity already exists on page load - if yes, skip quiz
useEffect(() => {
  (async () => {
    try {
      await apiFetch('/api/identity/me'); // if 200 => identity exists
      nav('/onboarding/content', { replace: true });
    } catch (err: any) {
      if (err?.status === 404) return;
      console.warn('Identity check failed:', err);
    }
  })();
}, [nav]);
```

---

### 10) `frontend/react-app/src/components/ProtectedRoute.tsx` (unauth user → show proper error)

Change line **20**:

```tsx
if (state.status === 'unauthenticated') {
  return <Navigate to="/auth?reason=unauthorized" replace />;
}
```

---

### 11) `frontend/react-app/src/pages/AuthPage.tsx`

#### A) Show “unauthorized” error properly
- In `useQuery()` logic area, include `reason` and set error.
Change initial `error` state (lines **47-50**) to:

```ts
const [error, setError] = useState<string>(() => {
  const reason = q.get('reason');
  if (reason === 'unauthorized') return 'Please sign in to continue.';
  const code = q.get('error');
  return code ? oauthErrorMessage(code) : '';
});
```

#### B) Password eye icon (login + signup)
- Update imports (line **10**) to include `Eye`, `EyeOff`.
- Add states near login/signup state:
```ts
const [showLoginPassword, setShowLoginPassword] = useState(false);
const [showSignupPassword, setShowSignupPassword] = useState(false);
```

- Replace login password `<Input ... type="password" ... />` (lines **240-248**) with:

```tsx
<div className="relative">
  <Input
    id="login-password"
    type={showLoginPassword ? 'text' : 'password'}
    placeholder="••••••••"
    value={loginPassword}
    onChange={(e) => setLoginPassword(e.target.value)}
    required
    disabled={loading}
    className="pr-10"
  />
  <button
    type="button"
    onClick={() => setShowLoginPassword((v) => !v)}
    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
  >
    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
  </button>
</div>
```

- Replace signup password `<Input ... type="password" ... />` (lines **304-313**) similarly using `showSignupPassword`.

---

### 12) `frontend/react-app/src/pages/SignupVerifyPage.tsx` + `LoginVerifyPage.tsx` (OTP resend option)

Add import:
```ts
import { showToast } from '@/lib/toast';
```

Add state + handler:
```ts
const [resendLoading, setResendLoading] = useState(false);
const [cooldown, setCooldown] = useState(0);

useEffect(() => {
  if (cooldown <= 0) return;
  const t = setInterval(() => setCooldown((s) => s - 1), 1000);
  return () => clearInterval(t);
}, [cooldown]);

const resend = async () => {
  if (!email) return;
  setResendLoading(true);
  try {
    await apiFetch('/api/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email, type: 'signup' }), // in LoginVerifyPage use type: 'login'
    });
    showToast('OTP sent to your email', 'success', 4000);
    setCooldown(30);
  } catch (e: any) {
    showToast(e.message || 'Failed to resend OTP', 'error', 5000);
  } finally {
    setResendLoading(false);
  }
};
```

Add button under Verify/Continue button:
```tsx
<Button
  type="button"
  variant="outline"
  className="w-full"
  onClick={resend}
  disabled={loading || resendLoading || cooldown > 0}
>
  {cooldown > 0 ? `Resend OTP (${cooldown}s)` : 'Resend OTP'}
</Button>
```

---

### 13) Replace default JS popups (`alert`) with your custom toast (`showToast`) — KANA_HAI #2

#### A) `frontend/react-app/src/pages/OnboardingPlanPage.tsx` (lines **28, 36, 38**)
- Add: `import { showToast } from '@/lib/toast';`
- Replace alerts:

```ts
showToast('Failed to create checkout session. Please try again.', 'error');
showToast('Stripe account setup required. Please complete Stripe setup and try again.', 'warning', 6000);
showToast(error.message || 'Failed to start checkout. Please try again.', 'error');
```

#### B) `frontend/react-app/src/pages/OnboardingContentPage.tsx` (alerts at **128,133,172,193,262,265,275,284,288,293**)
- Add: `import { showToast } from '@/lib/toast';`
- Replace each `alert(...)` with `showToast(..., 'error'|'success'|'info')`:
  - File type/size/Upload fail → `'error'`
  - “YouTube channel saved…” → `'success'`
  - Info messages (LinkedIn/coming soon) → `'info'`

#### C) `frontend/react-app/src/pages/SettingsPage.tsx` (line **254**)
- Ensure it imports `showToast` (it already uses alerts; add import if missing)
- Replace:
```ts
showToast(`Payout request submitted! Amount: ${formatCurrency(res.amountCents)}. ${res.message || ''}`, 'success', 5000);
```

#### D) `frontend/react-app/src/components/VoiceRecorder.tsx` (line **78**)
```ts
showToast('Failed to access microphone. Please check permissions.', 'error', 5000);
```

#### E) `frontend/react-app/src/pages/VoiceManagePage.tsx` (lines **46,60,75**)
Replace with `showToast(...)` error.

#### F) `frontend/react-app/src/pages/PhoneSetupPage.tsx` (lines **25,37**)
Replace with `showToast(err.message || 'Failed to connect', 'error')`, etc.

#### G) `frontend/react-app/src/pages/MarketplaceManagePage.tsx` (lines **62,64**)
Replace with success/error toast.

#### H) `frontend/react-app/src/pages/MarketplaceListingPage.tsx` (lines **71,73**)
Replace with success/error toast.

#### I) `frontend/react-app/src/pages/Integrations.tsx` (alerts at **81,83,148,163,172,184,196,208,210**)
Replace all with `showToast(...)` (success/info/error as appropriate).

---

### 14) Password eye icon — KANA_HAI #1 (extra places)

You also have password inputs in `frontend/react-app/src/pages/SettingsPage.tsx` (lines **1079, 1088, 1138**) — apply the same `Eye/EyeOff` pattern there for:
- Current Password
- New Password
- New Password (set-password flow)

---

## Concise verification checklist (what this fixes)
- **Resume exact step**: backend now **stores and advances** `onboardingStep` (`quiz → content → plan → deploy`) and frontend gate routes using `/api/auth/me` first.
- **No deploy skip bug**: login/loginVerify no longer treat `deploy` as done.
- **Type error fixed**: `"signup"` removed from typed `source` union usage.
- **KANA_HAI**: password eye icon + all `alert()` replaced with your custom `showToast` + unauth redirect shows proper error + OTP resend added.

If you switch to **Agent mode**, I can apply all patches and do an end-to-end run (signup → verify → quiz → identity → content → plan → deploy, refresh page at each step).