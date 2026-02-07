import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

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

    // After core onboarding is complete, only allow Step 3/4 *if* the window is active.
    const windowActive = sessionStorage.getItem('selflyx_post_step2_window') === '1';
    const isPreviewOrComplete =
      path.startsWith('/onboarding/preview') || path.startsWith('/onboarding/complete');

    if (windowActive && isPreviewOrComplete) return;

    // Otherwise, never show onboarding again
    navigate('/dashboard', { replace: true });
  }, [state, navigate, location.pathname]);
}

/**
 * Hook to prevent back navigation
 * Use this on pages where back button should be blocked
 */
export function usePreventBack() {
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);
}

/**
 * Hook to redirect back navigation to a specific route (e.g., dashboard)
 * Use this on pages where back button should go to dashboard instead of previous page
 */
export function useRedirectBack(redirectTo: string = '/dashboard') {
  const navigate = useNavigate();

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      navigate(redirectTo, { replace: true });
    };

    // Push a dummy state so back button triggers popstate
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate, redirectTo]);
}
