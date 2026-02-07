import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LandingPage } from '@/pages/LandingPage';

/**
 * Phase 2 Feature: Subdomain standalone links
 * Only active if VITE_PUBLIC_BASE_DOMAIN env var is set
 * Falls back to /chat/:slug if not set (Phase 1 behavior)
 */
function getSubdomainHandle(): string | null {
  const baseDomain = (import.meta.env.VITE_PUBLIC_BASE_DOMAIN || '').trim(); // "selflyx.com"
  if (!baseDomain) return null; // Phase 1: no subdomain, use /chat/:slug

  const host = window.location.hostname.toLowerCase();

  if (host === baseDomain) return null;
  if (host === `www.${baseDomain}`) return null;
  if (!host.endsWith(`.${baseDomain}`)) return null;

  const sub = host.slice(0, -(baseDomain.length + 1));
  if (!sub || sub.includes('.')) return null;
  return sub;
}

/**
 * Standard SaaS behavior:
 * - Subdomain: treat as standalone chat link => /chat/:handle
 * - Logged out: show marketing landing page
 * - Logged in: send user to dashboard (product home)
 */
export function HomeRoute() {
  const { state } = useAuth();

  const handle = typeof window !== 'undefined' ? getSubdomainHandle() : null;
  if (handle) {
    return <Navigate to={`/chat/${encodeURIComponent(handle)}`} replace />;
  }

  if (state.status === 'loading') return null;

  if (state.status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  // ✅ Logged-out: show marketing landing (standard SaaS)
  return <LandingPage />;
}















