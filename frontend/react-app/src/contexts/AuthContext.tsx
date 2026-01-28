import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';

export type MeUser = {
  id: string;
  publicId?: string;
  email: string;
  handle?: string;
  name?: string;
  bio?: string;
  dob?: string;
  phone?: string;
  profileImage?: string;
  profileCompleted?: boolean;
  active?: boolean;
  isAdmin?: boolean;
  hasPassword?: boolean;
  hasGoogle?: boolean;
};

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: MeUser }
  | { status: 'unauthenticated'; user: null };

type AuthCtx = {
  state: AuthState;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  const refresh = async () => {
    try {
      const res = await apiFetch<{ success: true; user: MeUser }>('/api/auth/me');
      setState({ status: 'authenticated', user: res.user });
    } catch {
      setState({ status: 'unauthenticated', user: null });
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
    } finally {
      setState({ status: 'unauthenticated', user: null });
    }
  };

  useEffect(() => {
    refresh();
    
    // Set up periodic refresh (every 5 minutes) to check session validity
    const refreshInterval = setInterval(() => {
      refresh().catch(() => {
        // If refresh fails, user is logged out
      });
    }, 5 * 60 * 1000); // 5 minutes
    
    // Refresh on window focus
    const handleFocus = () => {
      refresh().catch(() => {});
    };
    window.addEventListener('focus', handleFocus);
    
    // Listen for session expired events from api.ts
    const handleSessionExpired = () => {
      setState({ status: 'unauthenticated', user: null });
    };
    window.addEventListener('auth:session-expired', handleSessionExpired);
    
    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  // Session timeout warning
  useEffect(() => {
    if (state.status !== 'authenticated') return;

    // Check session expiry (7 days default, 30 days if rememberMe)
    const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // Default 7 days
    const WARNING_TIME = 5 * 60 * 1000; // Warn 5 minutes before expiry

    const checkSession = () => {
      // Track last activity
      const lastActivity = localStorage.getItem('lastActivity');
      if (!lastActivity) {
        localStorage.setItem('lastActivity', Date.now().toString());
        return;
      }

      const timeSinceActivity = Date.now() - parseInt(lastActivity);
      const timeUntilExpiry = SESSION_DURATION - timeSinceActivity;

      if (timeUntilExpiry < WARNING_TIME && timeUntilExpiry > 0) {
        // Show warning toast
        const minutesLeft = Math.ceil(timeUntilExpiry / (60 * 1000));
        showToast(
          `Your session will expire in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}. Please save your work.`,
          'warning',
          10000 // Show for 10 seconds
        );
      }
    };

    // Update last activity on user interaction
    const updateActivity = () => {
      localStorage.setItem('lastActivity', Date.now().toString());
    };

    // Listen for user activity
    window.addEventListener('mousedown', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('scroll', updateActivity);

    const interval = setInterval(checkSession, 60000); // Check every minute

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousedown', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, [state.status]);

  const value = useMemo(() => ({ state, refresh, logout }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}


