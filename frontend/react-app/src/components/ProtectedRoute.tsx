import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function buildNextUrl(pathname: string, search: string, hash: string) {
  return `${pathname || ''}${search || ''}${hash || ''}`;
}

function getRequiredOnboardingPath(user: any): string {
  const step = user?.onboardingStep || 'start';
  const map: Record<string, string> = {
    // New Onboarding Flow (Industry Standard - Primary)
    start: '/onboarding/start',
    upload: '/onboarding/upload',
    preview: '/onboarding/preview',
    complete: '/onboarding/complete',
    done: '/dashboard',
    
    // Legacy Onboarding Flow (Backward Compatibility)
    quiz: '/onboarding/quiz',
    content: '/onboarding/content',
    pricing: '/onboarding/pricing',
    voice: '/onboarding/voice',
    plan: '/onboarding/plan',
    stripe_connect: '/onboarding/deploy',
    deploy: '/onboarding/deploy',
    
    // Backward compatibility: some older code might use 'training'
    training: '/onboarding/training',
  };
  return map[step] || '/onboarding/start';
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

  // ✅ Clear "post-step2 window" flag when user leaves onboarding (game over for Step3/4)
  // This ensures once user goes to dashboard/setup/etc., they can never return to Step3/4
  if (
    user?.userType === 'creator' &&
    (user?.onboardingCompleted === true || user?.onboardingStep === 'done') &&
    !location.pathname.startsWith('/onboarding')
  ) {
    sessionStorage.removeItem('selflyx_post_step2_window');
    sessionStorage.removeItem('selflyx_allow_preview_once'); // cleanup old key if present
  }

  // ✅ NEW: if profileCompleted is missing/unknown, don't redirect yet (prevents flicker/race)
  if (typeof user?.profileCompleted !== 'boolean') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const isVisitor = user?.userType === 'visitor';

  // ✅ 2.0) Block profile page if already completed (prevent repeat submissions)
  if (location.pathname.startsWith('/signup/profile') && user?.profileCompleted === true) {
    const sp = new URLSearchParams(location.search);
    const nextQ = sp.get('next') || '';
    const safeNextQ =
      nextQ.startsWith('/') && !nextQ.startsWith('/auth') && !nextQ.startsWith('/signup')
        ? nextQ
        : '';

    // If type not chosen, go choose-type
    if (!user.userType) {
      const q = safeNextQ ? `?next=${encodeURIComponent(safeNextQ)}` : '';
      return <Navigate to={`/choose-type${q}`} replace />;
    }

    // Else go to next/fallback
    const fallback = user.userType === 'creator' ? '/dashboard' : '/explore';
    return <Navigate to={safeNextQ || fallback} replace />;
  }

  // 2) Profile incomplete => force /signup/profile, preserve next
  // ✅ CHANGE: redirect ONLY when profileCompleted is explicitly false
  // (don't skip on /choose-type; profile must still be completed first)
  if (user && user.profileCompleted === false && !isVisitor && !location.pathname.startsWith('/signup/profile')) {
    return (
      <Navigate
        to={`/signup/profile?email=${encodeURIComponent(user.email)}&next=${encodeURIComponent(next)}`}
        replace
      />
    );
  }

  // 2.5) User type not chosen yet => force choose-type (preserve next)
  if (user && user.profileCompleted === true && !user.userType && !location.pathname.startsWith('/choose-type')) {
    return <Navigate to={`/choose-type?next=${encodeURIComponent(next)}`} replace />;
  }

  // 3) Onboarding incomplete => force the exact step they are on (only for creators)
  const onboardingComplete =
    user?.userType === 'visitor'
      ? true
      : (user?.onboardingStep === 'done' || user?.onboardingCompleted === true);

  if (user && user?.userType === 'creator' && !onboardingComplete) {
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

    // Don't allow skipping steps inside onboarding routes
    // EXCEPT: Allow deploy page if ?paid=1 (Stripe redirect before webhook processed)
    // EXCEPT: Allow new flow routes if user is on new flow
    const currentStep = user?.onboardingStep || 'start';
    const isNewFlowStep = ['start', 'upload', 'preview', 'complete'].includes(currentStep);
    const isNewFlowRoute = location.pathname.startsWith('/onboarding/start') || 
                           location.pathname.startsWith('/onboarding/upload') ||
                           location.pathname.startsWith('/onboarding/preview') ||
                           location.pathname.startsWith('/onboarding/complete');
    
    if (location.pathname.startsWith('/onboarding') && location.pathname !== required) {
      // Allow if on new flow and route matches new flow (but prevent skipping ahead)
      if (isNewFlowStep && isNewFlowRoute) {
        // Check if they're trying to go backwards in new flow (allow) or skip ahead (block)
        const newFlowOrder = ['start', 'upload', 'preview', 'complete'];
        const currentIndex = newFlowOrder.indexOf(currentStep);
        const routeStep = location.pathname.split('/').pop();
        const routeIndex = newFlowOrder.indexOf(routeStep || '');
        // Block if trying to skip ahead
        if (routeIndex > currentIndex) {
          return <Navigate to={required} replace />;
        }
        // Allow going back or staying on same step
      } else if (!(isDeployPage && justPaid)) {
        return <Navigate to={required} replace />;
      }
    }

    // Don't allow any other protected page until onboarding done
    // ✅ Allow /setup route (optional flow, can be done anytime)
    const allowedWhileOnboarding =
      location.pathname.startsWith('/onboarding') || 
      location.pathname.startsWith('/signup') ||
      location.pathname.startsWith('/setup');

    if (!allowedWhileOnboarding) {
      return <Navigate to={required} replace />;
    }
  }

  return <>{children}</>;
}