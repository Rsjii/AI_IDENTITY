import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AuthShell } from '@/components/AuthShell';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function ChooseTypePage() {
  const q = useQuery();
  const { refresh } = useAuth();

  const nextParam = q.get('next') || '';
  const safeNext = nextParam.startsWith('/') ? nextParam : '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const didSubmit = useRef(false); // ✅ Guard: prevent duplicate submissions

  const autoVisitor = safeNext.startsWith('/chat/');

  const setTypeAndGo = async (userType: 'creator' | 'visitor') => {
    // ✅ Guard: prevent duplicate submissions (React StrictMode / double-click)
    if (didSubmit.current) return;
    didSubmit.current = true;

    setLoading(true);
    setError('');
    try {
      await apiFetch('/api/auth/set-user-type', {
        method: 'POST',
        body: JSON.stringify({ userType }),
      });

      // Best-effort refresh (keeps state correct if user stays on page)
      await refresh();

      // ✅ NEW FLOW: Creator goes to new onboarding start
      // ✅ FIX: Filter out creator-only routes for visitors (prevent onboarding leak)
      const isCreatorOnlyNext =
        safeNext.startsWith('/onboarding') ||
        safeNext.startsWith('/dashboard') ||
        safeNext.startsWith('/setup') ||
        safeNext.startsWith('/mirror') ||
        safeNext.startsWith('/identity') ||
        safeNext.startsWith('/conversations');

      const visitorTarget = !isCreatorOnlyNext ? (safeNext || '/explore') : '/explore';
      const target = userType === 'creator' ? '/onboarding/start' : visitorTarget;

      // ✅ FIX: hard redirect so ProtectedRoute can't see stale state
      window.location.replace(target);
    } catch (e: any) {
      didSubmit.current = false; // ✅ Unlock on failure so user can retry
      setError(e?.message || 'Failed to set user type');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!autoVisitor) return;
    // If came from /chat/:slug => auto pick visitor
    setTypeAndGo('visitor');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoVisitor]);

  if (autoVisitor) {
    return (
      <AuthShell title="Almost there" subtitle="Taking you back to chat…">
        <Card className="glass shadow-sm">
          <CardContent className="py-8 text-center text-muted-foreground">
            Please wait…
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Welcome to Selflyx" subtitle="What would you like to do?" showLogout={true} showBackToHome={false}>
      <Card className="glass shadow-sm">
        <CardHeader>
          <CardTitle>Choose your path</CardTitle>
          <CardDescription>You can always do both later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <div className="text-sm text-destructive">{error}</div> : null}

          <Button className="w-full" disabled={loading} onClick={() => setTypeAndGo('creator')}>
            🤖 Create my own AI
          </Button>

          <Button className="w-full" variant="outline" disabled={loading} onClick={() => setTypeAndGo('visitor')}>
            💬 Chat with AI
          </Button>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

