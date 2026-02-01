import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (state.status === 'unauthenticated') {
    return <Navigate to="/auth?reason=unauthorized" replace />;
  }

  // ✅ Enforce profile completion before accessing protected routes
  // Exception: Allow access to /signup/profile page itself
  if (state.user && !state.user.profileCompleted && !location.pathname.startsWith('/signup/profile')) {
    return <Navigate to={`/signup/profile?email=${encodeURIComponent(state.user.email)}`} replace />;
  }

  // ✅ CRITICAL: Enforce onboarding completion before accessing dashboard/protected routes
  // Exception: Allow access to /onboarding/* pages themselves
  const user = state.user as any;
  const onboardingComplete = user?.onboardingStep === 'done' || user?.onboardingCompleted === true;

  if (
    state.user &&
    !onboardingComplete &&
    !location.pathname.startsWith('/onboarding') &&
    !location.pathname.startsWith('/signup')
  ) {
    // Redirect to onboarding gate (will route to correct step)
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}


