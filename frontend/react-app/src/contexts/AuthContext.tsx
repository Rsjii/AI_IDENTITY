import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

export type MeUser = {
  id: string;
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

  const value = useMemo(() => ({ state, refresh, logout }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

