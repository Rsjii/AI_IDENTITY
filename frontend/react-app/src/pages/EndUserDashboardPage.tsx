import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { showToast } from '@/lib/toast';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import {
  MessageSquare, DollarSign, Clock, Sparkles, ArrowRight, CreditCard
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface ActiveSubscription {
  id: string;
  creatorName: string;
  creatorUsername: string;
  creatorAvatar?: string;
  priceCents: number;
  currency: string;
  renewsAt: string;
  status: 'active' | 'cancelled';
  listingId: string;
}

interface PayPerChatAccess {
  id: string;
  creatorName: string;
  creatorUsername: string;
  creatorAvatar?: string;
  priceCents: number;
  currency: string;
  expiresAt: string;
  purchasedAt: string;
}

interface EndUserDashboardData {
  subscriptions: ActiveSubscription[];
  payPerChatAccess: PayPerChatAccess[];
  totalSpentThisMonthCents: number;
  totalSpentAllTimeCents: number;
  activeAccessCount: number;
}

export function EndUserDashboardPage() {
  const nav = useNavigate();
  const { state } = useAuth();
  const user = state.status === 'authenticated' ? state.user : null;

  const [data, setData] = useState<EndUserDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const result = await apiFetch<EndUserDashboardData>('/api/user/dashboard', {
        method: 'GET',
      });
      setData(result);
    } catch (e: any) {
      showToast(e.message || 'Failed to load dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();

    if (diff < 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  const formatRenewalDate = (renewsAt: string) => {
    const date = new Date(renewsAt);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatPrice = (cents: number, currency: string) => {
    const symbol = currency === 'INR' ? '₹' : '$';
    return `${symbol}${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </Layout>
    );
  }

  const activeSubscriptions = data?.subscriptions?.filter(s => s.status === 'active') || [];
  const activePayPerChat = data?.payPerChatAccess?.filter(p => new Date(p.expiresAt) > new Date()) || [];

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              👋 Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </h1>
            <p className="text-muted-foreground mt-1">Your AI subscriptions and access</p>
          </div>
          <Button onClick={() => nav('/marketplace')} size="lg">
            <Sparkles className="w-4 h-4 mr-2" />
            Explore Marketplace
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeSubscriptions.length}</div>
              <p className="text-xs text-muted-foreground">
                {activeSubscriptions.length === 1 ? '1 active subscription' : `${activeSubscriptions.length} active subscriptions`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">24h Access</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activePayPerChat.length}</div>
              <p className="text-xs text-muted-foreground">
                {activePayPerChat.length === 1 ? '1 active access' : `${activePayPerChat.length} active accesses`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Spent This Month</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatPrice(data?.totalSpentThisMonthCents || 0, 'USD')}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatPrice(data?.totalSpentAllTimeCents || 0, 'USD')} all time
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Active Subscriptions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Your Subscriptions {activeSubscriptions.length > 0 && `(${activeSubscriptions.length} active)`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeSubscriptions.length === 0 ? (
              <EmptyState
                title="No active subscriptions"
                description="Subscribe to creators for unlimited access to their AI"
                action={
                  <Button onClick={() => nav('/marketplace')}>
                    Explore Marketplace
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {activeSubscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {sub.creatorAvatar ? (
                        <img
                          src={sub.creatorAvatar}
                          alt={sub.creatorName}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Sparkles className="w-6 h-6 text-primary" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{sub.creatorName}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {formatPrice(sub.priceCents, sub.currency)}/mo • Renews {formatRenewalDate(sub.renewsAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => nav(`/chat/${sub.creatorUsername}`)}
                        size="sm"
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Chat
                      </Button>
                      <Button
                        onClick={() => nav(`/subscriptions/${sub.id}/manage`)}
                        variant="outline"
                        size="sm"
                      >
                        Manage
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 24h Access */}
        {activePayPerChat.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Chats (24h access)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activePayPerChat.map((access) => (
                  <div
                    key={access.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {access.creatorAvatar ? (
                        <img
                          src={access.creatorAvatar}
                          alt={access.creatorName}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Sparkles className="w-6 h-6 text-primary" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{access.creatorName}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {getTimeRemaining(access.expiresAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => nav(`/chat/${access.creatorUsername}`)}
                        size="sm"
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Chat
                      </Button>
                      <Button
                        onClick={() => nav(`/marketplace/${access.creatorUsername}`)}
                        variant="outline"
                        size="sm"
                      >
                        Extend
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Become a Creator CTA */}
        {!(user as any)?.creatorTitle && (
          <Alert className="border-primary/50 bg-primary/5">
            <Sparkles className="h-4 w-4 text-primary" />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <div className="font-semibold">💡 Become a Creator</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Create your own AI clone and start earning. No technical skills required.
                </div>
              </div>
              <Button onClick={() => nav('/onboarding/quiz')} className="ml-4">
                Start Creating
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Discover More AIs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Discover More AIs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Sparkles className="w-16 h-16 mx-auto text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Explore the Marketplace</h3>
              <p className="text-muted-foreground mb-4">
                Discover AI clones from experts in fitness, business, tech, and more
              </p>
              <Button onClick={() => nav('/marketplace')} size="lg">
                Browse Marketplace
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
