import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { Layout } from '@/components/Layout';
import { Loader2 } from 'lucide-react';

/**
 * OnboardingGatePage - Smart routing for onboarding flow
 * 
 * Determines where user should be in onboarding:
 * - No identity → /onboarding/quiz
 * - Identity but < 3 content items → /onboarding/content
 * - Enough content → /onboarding/plan
 */
export function OnboardingGatePage() {
  const nav = useNavigate();

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

  // Show loading while determining next step
  return (
    <Layout>
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-accent-primary" />
          <p className="text-text-secondary">Loading your onboarding progress...</p>
        </div>
      </div>
    </Layout>
  );
}

