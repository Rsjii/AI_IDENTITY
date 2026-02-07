import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Loader2 } from 'lucide-react';

/**
 * OnboardingGatePage - Entry point for onboarding
 * 
 * ✅ New flow: ProtectedRoute already enforces the exact required step.
 * If user hits /onboarding, send them to /onboarding/start as the entry.
 */
export function OnboardingGatePage() {
  const nav = useNavigate();

  useEffect(() => {
    // ✅ New flow: ProtectedRoute already enforces the exact required step.
    // If user hits /onboarding, send them to /onboarding/start as the entry.
    nav('/onboarding/start', { replace: true });
  }, [nav]);

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

