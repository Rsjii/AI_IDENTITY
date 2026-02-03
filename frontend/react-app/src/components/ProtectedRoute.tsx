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

    // Phase-1: voice/training removed from mandatory flow
    voice: '/onboarding/plan',
    training: '/onboarding/plan',

    plan: '/onboarding/plan',
    deploy: '/onboarding/deploy',
    done: '/dashboard',
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
    const searchParams = new URLSearchParams(location.search);

    // ✅ Allow /onboarding/deploy if user just paid (Stripe success redirect)
    // The webhook may not have processed yet, so auth state is stale
    const justPaid = searchParams.get('paid') === '1';
    const isDeployPage = location.pathname === '/onboarding/deploy';

    // If they hit /onboarding (gate), push them to exact required step
    if (location.pathname === '/onboarding') {
      return <Navigate to={required} replace />;
    }

    // Don't allow skipping *forward* inside onboarding routes.
    // Allow going *back* (earlier steps) freely.
    // EXCEPT: Allow deploy page if ?paid=1 (Stripe redirect before webhook processed)
    if (location.pathname.startsWith('/onboarding') && location.pathname !== required) {
      if (!(isDeployPage && justPaid)) {
        const order = ['/onboarding/quiz', '/onboarding/content', '/onboarding/plan', '/onboarding/deploy'];
        const currentIdx = order.indexOf(location.pathname);
        const requiredIdx = order.indexOf(required);

        // If current is ahead of required => redirect back to required
        if (currentIdx !== -1 && requiredIdx !== -1 && currentIdx > requiredIdx) {
          return <Navigate to={required} replace />;
        }

        // If unknown path inside onboarding, be safe and redirect
        if (currentIdx === -1 || requiredIdx === -1) {
          return <Navigate to={required} replace />;
        }

        // If current is behind required => allow (Back button allowed)
      }
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