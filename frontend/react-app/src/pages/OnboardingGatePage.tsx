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
        // Step 1: Check if identity exists
        try {
          await apiFetch('/api/identity/me');
          // Identity exists, check content
        } catch (err: any) {
          // No identity found (404) → start with quiz
          if (err?.status === 404) {
            nav('/onboarding/quiz', { replace: true });
            return;
          }
          // Other error → go to dashboard
          console.error('Failed to check identity:', err);
          nav('/dashboard', { replace: true });
          return;
        }

        // Step 2: Check content count
        try {
          const content = await apiFetch<{ items: any[] }>('/api/content/list');
          const count = content?.items?.length || 0;

          if (count < 3) {
            // Not enough content → go to content upload
            nav('/onboarding/content', { replace: true });
          } else {
            // Enough content → go to plan selection
            nav('/onboarding/plan', { replace: true });
          }
        } catch (err: any) {
          // If content check fails, assume no content and go to content page
          console.warn('Failed to check content, assuming no content:', err);
          nav('/onboarding/content', { replace: true });
        }
      } catch (err: any) {
        // Fallback: go to dashboard if everything fails
        console.error('Onboarding gate error:', err);
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

