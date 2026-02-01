import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to prevent access to onboarding pages after onboarding is complete
 * Redirects to dashboard if onboarding is marked as done
 */
export function useOnboardingGuard() {
  const { state } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for auth to load
    if (state.status === 'loading') return;

    const user = state.status === 'authenticated' ? state.user : null;
    // If onboarding is done (check both flags for safety), redirect to dashboard
    if (user?.onboardingStep === 'done' || (user as any)?.onboardingCompleted === true) {
      console.log('[useOnboardingGuard] Onboarding complete, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [state, navigate]);
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
