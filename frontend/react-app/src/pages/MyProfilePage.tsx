import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';

type SubItem = {
  id: string;
  listingId: string;
  listingSlug: string;
  status: string;
  subscriptionPriceCents: number;
  currency: string;
  category: string | null;
  description: string;
  creator: { id: string; handle: string; name: string; avatarUrl: string | null };
};

type Tab = 'profile' | 'subscriptions' | 'privacy';

export function MyProfilePage() {
  const nav = useNavigate();
  const { state, refresh } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');
  const [subs, setSubs] = useState<SubItem[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const loadSubs = async () => {
    setLoadingSubs(true);
    try {
      const res = await apiFetch<{ success: boolean; items: SubItem[] }>('/api/user/subscriptions');
      setSubs(res.items || []);
    } catch {
      setSubs([]);
    } finally {
      setLoadingSubs(false);
    }
  };

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    loadSubs().catch(() => {});
  }, [state.status]);

  const cancel = async (listingId: string) => {
    try {
      await apiFetch('/api/marketplace/subscriptions/cancel', {
        method: 'POST',
        body: JSON.stringify({ listingId }),
      });
      showToast('Subscription cancelled.', 'success');
      await loadSubs();
    } catch (e: any) {
      showToast(e.message || 'Failed to cancel subscription', 'error');
    }
  };

  const upgradeToCreator = async () => {
    setUpgradeLoading(true);
    try {
      await apiFetch('/api/auth/set-user-type', {
        method: 'POST',
        body: JSON.stringify({ userType: 'creator' }),
      });
      await refresh();
      // ✅ NEW FLOW: Redirect to new onboarding start
      window.location.replace('/onboarding/start');
    } finally {
      setUpgradeLoading(false);
    }
  };

  if (state.status !== 'authenticated') {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-6 py-10 text-text-secondary">Please sign in.</div>
      </Layout>
    );
  }

  const user = state.user;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">My Profile</h1>
            <p className="text-text-secondary mt-1">Account basics, subscriptions, and privacy.</p>
          </div>
          <Button variant="outline" onClick={() => refresh()}>
            Refresh
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant={tab === 'profile' ? 'default' : 'outline'} onClick={() => setTab('profile')}>
            Profile
          </Button>
          <Button variant={tab === 'subscriptions' ? 'default' : 'outline'} onClick={() => setTab('subscriptions')}>
            Subscriptions
          </Button>
          <Button variant={tab === 'privacy' ? 'default' : 'outline'} onClick={() => setTab('privacy')}>
            Privacy
          </Button>
        </div>

        {tab === 'profile' ? (
          <Card className="bg-bg-secondary border-border-default">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Basic account info.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-text-secondary">
                <strong className="text-text-primary">Email:</strong> {user.email}
              </div>
              <div className="text-sm text-text-secondary">
                <strong className="text-text-primary">Name:</strong> {user.name || '—'}
              </div>
              <div className="text-sm text-text-secondary">
                <strong className="text-text-primary">Handle:</strong> {user.handle || '—'}
              </div>
              {(user as any)?.userType === 'visitor' ? (
                <div className="rounded-xl border border-border-default bg-bg-tertiary p-4">
                  <div className="font-semibold text-text-primary">Want to create your own AI?</div>
                  <div className="text-sm text-text-secondary mt-1">
                    Upgrade your account to Creator. Your chats + subscriptions stay intact.
                  </div>
                  <div className="mt-3">
                    <Button onClick={upgradeToCreator} disabled={upgradeLoading}>
                      {upgradeLoading ? 'Starting…' : '➕ Upgrade to Creator'}
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className="text-xs text-text-tertiary">
                For editing details (avatar, bio, password, etc.) use the Settings page.
              </div>
              <Button variant="outline" onClick={() => (window.location.href = '/settings')}>
                Open Settings
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {tab === 'subscriptions' ? (
          <Card className="bg-bg-secondary border-border-default">
            <CardHeader>
              <CardTitle>My Subscriptions</CardTitle>
              <CardDescription>Monthly subscriptions to creators.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSubs ? (
                <div className="text-sm text-text-secondary">Loading…</div>
              ) : subs.length === 0 ? (
                <div className="text-sm text-text-secondary">No subscriptions yet.</div>
              ) : (
                <div className="space-y-3">
                  {subs.map((s) => (
                    <div key={s.id} className="rounded-xl border border-border-default bg-bg-tertiary p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-text-primary truncate">
                            {s.creator.name || s.creator.handle}
                          </div>
                          <div className="text-xs text-text-tertiary truncate">@{s.creator.handle}</div>
                          <div className="text-xs text-text-tertiary mt-1">
                            Status: <span className="text-text-secondary">{s.status}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-text-primary">
                            ${(s.subscriptionPriceCents / 100).toFixed(2)}/{s.currency || 'USD'}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() => cancel(s.listingId)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                      <div className="text-sm text-text-secondary mt-3 line-clamp-2">
                        {s.description || '—'}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => (window.location.href = `/chat/${encodeURIComponent(s.creator.handle)}`)}
                        >
                          Chat →
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => (window.location.href = `/marketplace/${encodeURIComponent(s.listingSlug)}`)}
                        >
                          View listing
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {tab === 'privacy' ? (
          <Card className="bg-bg-secondary border-border-default">
            <CardHeader>
              <CardTitle>Privacy</CardTitle>
              <CardDescription>Phase 1: informational only.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-text-secondary space-y-2">
              <div>
                <strong className="text-text-primary">Conversation visibility:</strong> creators may review conversations with their AI for quality improvement.
              </div>
              <div className="text-xs text-text-tertiary">
                Phase 2 can add a real toggle + export/delete controls.
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </Layout>
  );
}


