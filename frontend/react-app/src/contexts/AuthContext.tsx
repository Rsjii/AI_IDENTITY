import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

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
        // Show warning (you can integrate with toast library)
        console.warn('Your session will expire in 5 minutes. Please save your work.');
        // TODO: Integrate with toast library for better UX
        // toast.warning('Your session will expire in 5 minutes. Please save your work.');
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


