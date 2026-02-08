import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';

/**
 * Hook to prevent access to onboarding pages after onboarding is complete
 * Allows Step 3/4 (preview/complete) only while "post-step2 window" is active
 * Window is cleared when user leaves onboarding (dashboard/setup/etc.) or kills app
 */
export function useOnboardingGuard() {
  const { state } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (state.status === 'loading') return;

    const user = state.status === 'authenticated' ? state.user : null;
    const completed =
      (user as any)?.onboardingCompleted === true || user?.onboardingStep === 'done';

    if (!completed) return;

    const path = location.pathname;
    const isOnboarding = path.startsWith('/onboarding');

    if (!isOnboarding) return;

    const windowActive = sessionStorage.getItem('selflyx_post_step2_window') === '1';
    const isPreviewOrComplete =
      path.startsWith('/onboarding/preview') || path.startsWith('/onboarding/complete');

    // ✅ Allow optional steps only in same-session window
    if (windowActive && isPreviewOrComplete) return;

    // ✅ If user tries to access Step3/4 without window (kill/reopen or returning later),
    // persist "skip optional" on server so it stays skipped forever.
    if (isPreviewOrComplete) {
      (async () => {
        try {
          await apiFetch('/api/creator/onboarding/step', {
            method: 'POST',
            body: JSON.stringify({ step: 'done' }),
          });
        } catch {}

        sessionStorage.removeItem('selflyx_post_step2_window');
        sessionStorage.removeItem('selflyx_allow_preview_once');
      })();
    }

    navigate('/dashboard', { replace: true });
  }, [state, navigate, location.pathname]);
}

/**
 * Hook to prevent back navigation
 * Use this on pages where back button should be blocked
 * @param enabled - Whether to enable back prevention (default: true)
 */
export function usePreventBack(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [enabled]);
}

/**
 * Hook to redirect back navigation to a specific route (e.g., dashboard)
 * Use this on pages where back button should go to dashboard instead of previous page
 * @param redirectTo - Route to redirect to on back button
 * @param opts - Options including markOnboardingDone to persist skip on back
 */
export function useRedirectBack(
  redirectTo: string = '/dashboard',
  opts?: { markOnboardingDone?: boolean }
) {
  const navigate = useNavigate();

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();

      (async () => {
        const path = window.location.pathname;
        const isPreviewOrComplete =
          path.startsWith('/onboarding/preview') || path.startsWith('/onboarding/complete');

        // ✅ Back from Step3/4 = SKIP optional steps forever
        if (opts?.markOnboardingDone && isPreviewOrComplete) {
          try {
            await apiFetch('/api/creator/onboarding/step', {
              method: 'POST',
              body: JSON.stringify({ step: 'done' }),
            });
          } catch {}

          sessionStorage.removeItem('selflyx_post_step2_window');
          sessionStorage.removeItem('selflyx_allow_preview_once');
        }

        navigate(redirectTo, { replace: true });
      })();
    };

    // Push a dummy state so back button triggers popstate
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate, redirectTo, opts?.markOnboardingDone]);
}
