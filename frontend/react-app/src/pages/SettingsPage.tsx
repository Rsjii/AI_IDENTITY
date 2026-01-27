import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, CreditCard, User, Shield, DollarSign, Check, Copy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch, apiFetchForm } from '@/lib/api';

type Tab = 'profile' | 'payment' | 'billing' | 'security';

export function SettingsPage() {
  const { state, refresh } = useAuth();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(tabParam && ['profile', 'payment', 'billing', 'security'].includes(tabParam) ? tabParam : 'profile');
  
  useEffect(() => {
    if (tabParam && ['profile', 'payment', 'billing', 'security'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [timeZone, setTimeZone] = useState('');
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Payment settings
  const [priceConfig, setPriceConfig] = useState<any>(null);
  const [premiumPrice, setPremiumPrice] = useState(500);
  const [vipPrice, setVipPrice] = useState(5000);
  const [enablePayments, setEnablePayments] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [popularQuestions, setPopularQuestions] = useState<string[]>(['']);

  // Billing
  const [planTier, setPlanTier] = useState('free');
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [loadingBilling, setLoadingBilling] = useState(false);

  useEffect(() => {
    if (state.status === 'authenticated') {
      setName(state.user.name || '');
      setPhone(state.user.phone || '');
      setTimeZone((state.user as any).timeZone || '');
      setPlanTier((state.user as any).planTier || 'free');
      setTrialEndsAt((state.user as any).trialEndsAt || null);
      
      const config = (state.user as any).priceConfig || {};
      setPriceConfig(config);
      setPremiumPrice(config.premium?.amountCents || 500);
      setVipPrice(config.vip?.amountCents || 5000);
      setEnablePayments(config.enablePayments || false);
      setWelcomeMessage(config.welcomeMessage || '');
      setPopularQuestions(config.popularQuestions?.length ? config.popularQuestions : ['']);

      loadBillingHistory();
    }
  }, [state]);

  const loadBillingHistory = async () => {
    if (state.status !== 'authenticated') return;
    setLoadingBilling(true);
    try {
      const res = await apiFetch<{ items: any[] }>('/api/creator/earnings');
      setBillingHistory(res.items || []);
    } catch (e: any) {
      console.error('Failed to load billing:', e);
    } finally {
      setLoadingBilling(false);
    }
  };

  const onSaveProfile = async () => {
    setSaving(true);
    setError('');
    try {
      await apiFetch('/api/profile/update', {
        method: 'POST',
        body: JSON.stringify({ name, phone: phone || undefined, timeZone }),
      });
      await refresh();
    } catch (e: any) {
      setError(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const onSavePaymentSettings = async () => {
    setSaving(true);
    setError('');
    try {
      const newConfig = {
        enablePayments,
        premium: { amountCents: premiumPrice },
        vip: { amountCents: vipPrice },
        welcomeMessage: welcomeMessage || undefined,
        popularQuestions: popularQuestions.filter(q => q.trim()),
      };
      await apiFetch('/api/profile/update', {
        method: 'POST',
        body: JSON.stringify({ priceConfig: newConfig }),
      });
      await refresh();
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to save payment settings.');
    } finally {
      setSaving(false);
    }
  };

  const upgradePlan = async (tier: 'starter' | 'growth' | 'scale') => {
    setSaving(true);
    setError('');
    try {
      const r = await apiFetch<{ url: string }>('/api/billing/stripe/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ tier, returnUrl: '/settings?tab=billing' }),
      });
      if (r.url) {
        window.location.href = r.url;
      } else {
        setError('Failed to create checkout session. Please try again.');
        setSaving(false);
      }
    } catch (e: any) {
      // Handle specific Stripe setup errors
      if (e.errorCode === 'STRIPE_ACCOUNT_SETUP_REQUIRED') {
        setError('Stripe account setup required! Please set your business name in Stripe Dashboard: https://dashboard.stripe.com/account');
      } else {
        setError(e.message || 'Failed to start checkout. Please try again.');
      }
      setSaving(false);
    }
  };

  if (state.status === 'loading') {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Loading…</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  if (state.status === 'unauthenticated') {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Sign in required</CardTitle>
              <CardDescription>Please login to manage your settings.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  };

  const planNames: Record<string, string> = {
    free: 'Free',
    starter: 'Starter',
    growth: 'Growth',
    scale: 'Scale',
  };

  const planLimits: Record<string, string> = {
    free: '500 chats/month',
    starter: '5,000 chats/month',
    growth: '25,000 chats/month',
    scale: 'Unlimited',
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account, payments, and preferences</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          {([
            { id: 'profile' as Tab, label: 'Profile', icon: User },
            { id: 'payment' as Tab, label: 'Payment', icon: DollarSign },
            { id: 'billing' as Tab, label: 'Billing', icon: CreditCard },
            { id: 'security' as Tab, label: 'Security', icon: Shield },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setActiveTab(id);
                setSearchParams({ tab: id });
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <Card className="glass">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input value={state.user.email} readOnly disabled />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Phone (optional)</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 1234567890" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Timezone</label>
                <Input value={timeZone} onChange={(e) => setTimeZone(e.target.value)} placeholder="Asia/Kolkata" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Avatar</label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setProfileImageFile(e.target.files?.[0] || null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!profileImageFile || saving}
                  onClick={async () => {
                    if (!profileImageFile) return;
                    setSaving(true);
                    setError('');
                    try {
                      const fd = new FormData();
                      fd.append('profileImageFile', profileImageFile);
                      await apiFetchForm('/api/profile/update', { method: 'POST', body: fd });
                      await refresh();
                      setProfileImageFile(null);
                    } catch (e: any) {
                      setError(e.message || 'Upload failed.');
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  Upload avatar
                </Button>
              </div>

              <Button className="w-full" onClick={onSaveProfile} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Payment Tab */}
        {activeTab === 'payment' && (
          <div className="space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Pay-Per-Chat Settings</CardTitle>
                <CardDescription>Configure pricing for detailed answers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="enablePayments"
                    checked={enablePayments}
                    onChange={(e) => setEnablePayments(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="enablePayments" className="text-sm font-medium cursor-pointer">
                    Enable pay-per-chat
                  </label>
                </div>

                {enablePayments && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Premium Answer Price (cents)</label>
                      <Input
                        type="number"
                        value={premiumPrice}
                        onChange={(e) => setPremiumPrice(parseInt(e.target.value) || 500)}
                        min={100}
                        step={100}
                      />
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(premiumPrice)} per detailed answer
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">VIP Consultation Price (cents)</label>
                      <Input
                        type="number"
                        value={vipPrice}
                        onChange={(e) => setVipPrice(parseInt(e.target.value) || 5000)}
                        min={1000}
                        step={500}
                      />
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(vipPrice)} per full consultation
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Welcome Message</label>
                      <Input
                        value={welcomeMessage}
                        onChange={(e) => setWelcomeMessage(e.target.value)}
                        placeholder="Hey! I'm here to help. Ask me anything!"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Popular Questions</label>
                      {popularQuestions.map((q, i) => (
                        <Input
                          key={i}
                          value={q}
                          onChange={(e) => {
                            const newQs = [...popularQuestions];
                            newQs[i] = e.target.value;
                            setPopularQuestions(newQs);
                          }}
                          placeholder={`Question ${i + 1}`}
                          className="mb-2"
                        />
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPopularQuestions([...popularQuestions, ''])}
                      >
                        Add Question
                      </Button>
                    </div>
                  </>
                )}

                <Button className="w-full" onClick={onSavePaymentSettings} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save payment settings'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Current Plan</CardTitle>
                <CardDescription>Your subscription and usage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-semibold text-lg">{planNames[planTier] || 'Free'}</div>
                    <div className="text-sm text-muted-foreground">{planLimits[planTier] || '500 chats/month'}</div>
                    {trialEndsAt && new Date(trialEndsAt) > new Date() && (
                      <div className="text-xs text-primary mt-1">
                        Trial ends: {new Date(trialEndsAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  {planTier === 'free' && (
                    <Button onClick={() => nav('/onboarding/plan')}>Upgrade</Button>
                  )}
                </div>

                {planTier !== 'free' && (
                  <div className="grid grid-cols-3 gap-4">
                    <Button
                      variant={planTier === 'starter' ? 'default' : 'outline'}
                      onClick={() => upgradePlan('starter')}
                      disabled={saving || planTier === 'starter'}
                    >
                      Starter ($49/mo)
                    </Button>
                    <Button
                      variant={planTier === 'growth' ? 'default' : 'outline'}
                      onClick={() => upgradePlan('growth')}
                      disabled={saving || planTier === 'growth'}
                    >
                      Growth ($149/mo)
                    </Button>
                    <Button
                      variant={planTier === 'scale' ? 'default' : 'outline'}
                      onClick={() => upgradePlan('scale')}
                      disabled={saving || planTier === 'scale'}
                    >
                      Scale ($499/mo)
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Billing History</CardTitle>
                <CardDescription>Your payment transactions</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingBilling ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : billingHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No transactions yet</div>
                ) : (
                  <div className="space-y-3">
                    {billingHistory.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{item.type || 'Payment'}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(item.amount || 0)}</div>
                          <div className="text-xs text-muted-foreground capitalize">{item.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <Card className="glass">
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Manage your account security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <p className="text-sm text-muted-foreground">Password changes are not yet available. Contact support.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Two-Factor Authentication</label>
                <p className="text-sm text-muted-foreground">2FA is coming soon.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Active Sessions</label>
                <p className="text-sm text-muted-foreground">Session management coming soon.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

