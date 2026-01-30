import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LandingPage } from '@/pages/LandingPage';

/**
 * Standard SaaS behavior:
 * - Logged out: show marketing landing
 * - Logged in: send user to dashboard (product home)
 */
export function HomeRoute() {
  const { state } = useAuth();

  if (state.status === 'loading') return null;

  if (state.status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  return <LandingPage />;
}



