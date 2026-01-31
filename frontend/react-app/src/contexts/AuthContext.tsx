import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { clearCSRFToken } from '@/lib/csrf';

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
  onboardingStep?: 'quiz' | 'content' | 'voice' | 'plan' | 'deploy' | 'done';
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
  const didInit = useRef(false);

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
      // ✅ Clear CSRF token cache on logout (session destroyed on backend)
      clearCSRFToken();
      setState({ status: 'unauthenticated', user: null });
    }
  };

  useEffect(() => {
    // ✅ Dev noise reduction: React StrictMode can mount effects twice.
    // Keep auth state updated primarily via real API usage (401 handling),
    // not background polling, to avoid unnecessary traffic in all envs.
    if (didInit.current) return;
    didInit.current = true;

    refresh();
    
    // Listen for session expired events from api.ts
    const handleSessionExpired = () => {
      setState({ status: 'unauthenticated', user: null });
    };
    window.addEventListener('auth:session-expired', handleSessionExpired);
    
    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  // ✅ F2: Session timeout warning with countdown and extend button
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (state.status !== 'authenticated') return;

    // Check session expiry (7 days default, 30 days if rememberMe)
    const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // Default 7 days
    const WARNING_TIME = 5 * 60 * 1000; // Warn 5 minutes before expiry
    let modalElement: HTMLElement | null = null;
    let countdownInterval: NodeJS.Timeout | null = null;

    const checkSession = () => {
      // Track last activity
      const lastActivity = localStorage.getItem('lastActivity');
      if (!lastActivity) {
        localStorage.setItem('lastActivity', Date.now().toString());
        return;
      }

      const timeSinceActivity = Date.now() - parseInt(lastActivity);
      const timeUntilExpiry = SESSION_DURATION - timeSinceActivity;

      if (timeUntilExpiry < WARNING_TIME && timeUntilExpiry > 0 && !modalElement) {
        // Auto-save user work before session expires
        try {
          // Save any form data in localStorage
          const formData = document.querySelectorAll('input, textarea, select');
          formData.forEach((el: any) => {
            if (el.value && el.id) {
              localStorage.setItem(`autosave_${el.id}`, el.value);
            }
          });
        } catch {
          // Silently fail
        }

        // Show warning modal with countdown
        const minutesLeft = Math.ceil(timeUntilExpiry / (60 * 1000));
        const secondsLeft = Math.floor((timeUntilExpiry % (60 * 1000)) / 1000);
        
        modalElement = document.createElement('div');
        modalElement.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';
        modalElement.innerHTML = `
          <div class="bg-bg-secondary border border-border-default rounded-lg p-6 max-w-md w-full mx-4">
            <h3 class="text-lg font-semibold text-text-primary mb-2">Session Expiring Soon</h3>
            <p class="text-text-secondary mb-4">
              Your session will expire in <strong id="countdown">${minutesLeft}:${secondsLeft.toString().padStart(2, '0')}</strong>.
              Please save your work.
            </p>
            <div class="flex gap-2">
              <button id="extend-btn" class="flex-1 px-4 py-2 bg-accent-primary text-white rounded hover:opacity-90">
                Extend Session
              </button>
              <button id="dismiss-btn" class="px-4 py-2 bg-bg-tertiary text-text-primary rounded hover:bg-bg-elevated">
                Dismiss
              </button>
            </div>
          </div>
        `;
        document.body.appendChild(modalElement);

        // Update countdown
        const countdownEl = modalElement.querySelector('#countdown');
        countdownInterval = setInterval(() => {
          const newTimeLeft = SESSION_DURATION - (Date.now() - parseInt(lastActivity));
          if (newTimeLeft <= 0) {
            if (countdownInterval) clearInterval(countdownInterval);
            if (modalElement) modalElement.remove();
            modalElement = null;
            refresh(); // This will log out if session expired
            return;
          }
          const mins = Math.ceil(newTimeLeft / (60 * 1000));
          const secs = Math.floor((newTimeLeft % (60 * 1000)) / 1000);
          if (countdownEl) {
            countdownEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
          }
        }, 1000);

        // Extend session button
        modalElement.querySelector('#extend-btn')?.addEventListener('click', () => {
          localStorage.setItem('lastActivity', Date.now().toString());
          if (countdownInterval) clearInterval(countdownInterval);
          if (modalElement) modalElement.remove();
          modalElement = null;
          showToast('Session extended', 'success');
        });

        // Dismiss button
        modalElement.querySelector('#dismiss-btn')?.addEventListener('click', () => {
          if (countdownInterval) clearInterval(countdownInterval);
          if (modalElement) modalElement.remove();
          modalElement = null;
        });
      } else if (timeUntilExpiry >= WARNING_TIME && modalElement) {
        // Remove modal if time is extended
        if (countdownInterval) clearInterval(countdownInterval);
        if (modalElement) modalElement.remove();
        modalElement = null;
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
  }, [state.status, refresh]);

  const value = useMemo(() => ({ state, refresh, logout }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}


