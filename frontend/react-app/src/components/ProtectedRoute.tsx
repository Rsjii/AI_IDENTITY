import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function buildNextUrl(pathname: string, search: string, hash: string) {
  return `${pathname || ''}${search || ''}${hash || ''}`;
}

function getRequiredOnboardingPath(user: any): string {
  const step = user?.onboardingStep || 'quiz';
  const map: Record<string, string> = {
    quiz: '/onboarding/quiz',
    content: '/onboarding/content',
    voice: '/onboarding/voice',
    plan: '/onboarding/plan',
    deploy: '/onboarding/deploy',
    done: '/dashboard',
    // Backward compatibility: some older code might use 'training'
    training: '/onboarding/training',
  };
  return map[step] || '/onboarding/quiz';
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

  const next = buildNextUrl(location.pathname, location.search, location.hash);

  // 1) Not logged in => go to auth, but preserve next
  if (state.status === 'unauthenticated') {
    return <Navigate to={`/auth?reason=unauthorized&next=${encodeURIComponent(next)}`} replace />;
  }

  const user = state.user as any;

  // 2) Profile incomplete => force /signup/profile, preserve next
  if (user && !user.profileCompleted && !location.pathname.startsWith('/signup/profile')) {
    return (
      <Navigate
        to={`/signup/profile?email=${encodeURIComponent(user.email)}&next=${encodeURIComponent(next)}`}
        replace
      />
    );
  }

  // 3) Onboarding incomplete => force the exact step they are on
  const onboardingComplete = user?.onboardingStep === 'done' || user?.onboardingCompleted === true;

  if (user && !onboardingComplete) {
    const required = getRequiredOnboardingPath(user);

    // If they hit /onboarding (gate), push them to exact required step
    if (location.pathname === '/onboarding') {
      return <Navigate to={required} replace />;
    }

    // Don’t allow skipping steps inside onboarding routes
    if (location.pathname.startsWith('/onboarding') && location.pathname !== required) {
      return <Navigate to={required} replace />;
    }

    // Don’t allow any other protected page until onboarding done
    const allowedWhileOnboarding =
      location.pathname.startsWith('/onboarding') || location.pathname.startsWith('/signup');

    if (!allowedWhileOnboarding) {
      return <Navigate to={required} replace />;
    }
  }

  return <>{children}</>;
}