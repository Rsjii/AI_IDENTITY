import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, CreditCard, User, Shield, Check, FileText, Info, Bell, Eye, EyeOff, Palette, Zap, Globe, Lock, Settings2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter';
import { SpendingDashboard } from '@/components/SpendingDashboard';
import { showToast } from '@/lib/toast';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { apiFetch, apiFetchForm, buildApiUrl } from '@/lib/api';
import { IntegrationsPage } from './Integrations';

type Tab = 'profile' | 'billing' | 'integrations' | 'notifications' | 'security' | 'preferences';

export function SettingsPage() {
  const { state, refresh } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;

  // Determine valid tabs based on user type
  const getValidTabs = (): Tab[] => {
    if (state.status === 'authenticated' && state.user?.userType === 'creator') {
      return ['profile', 'billing', 'integrations', 'notifications', 'security', 'preferences'];
    }
    return ['profile', 'notifications', 'security', 'preferences'];
  };

  const validTabs = getValidTabs();
  const [activeTab, setActiveTab] = useState<Tab>(tabParam && validTabs.includes(tabParam) ? tabParam : 'profile');

  useEffect(() => {
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [timeZone, setTimeZone] = useState('');
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  // Privacy settings (moved to Profile tab)
  const [allowSearchEngineIndexing, setAllowSearchEngineIndexing] = useState(true);
  const [showInPublicDirectory, setShowInPublicDirectory] = useState(true);
  const [allowAnalytics, setAllowAnalytics] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'private' | 'unlisted'>('public');

  // Appearance settings (in Preferences tab)
  const [language, setLanguage] = useState('en');
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [timeFormat, setTimeFormat] = useState('12h');
  const [highContrast, setHighContrast] = useState(false);
  const [reduceAnimations, setReduceAnimations] = useState(false);
  const [largerText, setLargerText] = useState(false);

  // Social links (creators only, in Profile tab)
  const [socialLinks, setSocialLinks] = useState({
    twitter: '',
    instagram: '',
    youtube: '',
    website: '',
  });

  // Payment settings (in Billing tab - creators only)
  const [payPerChatTiers, setPayPerChatTiers] = useState<number[]>([100, 500, 1000, 2500, 5000]);
  const [defaultTierCents, setDefaultTierCents] = useState(500);
  const [customTierInput, setCustomTierInput] = useState('');
  const [enablePayments, setEnablePayments] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [popularQuestions, setPopularQuestions] = useState<string[]>(['']);
  const [paymentTriggerRules, setPaymentTriggerRules] = useState<{
    keywords: string[];
    minLength: number;
    alwaysRequire: boolean;
  }>({ keywords: [], minLength: 0, alwaysRequire: false });
  const payTierOptions = [
    { label: '$1', value: 100 },
    { label: '$5', value: 500 },
    { label: '$10', value: 1000 },
    { label: '$25', value: 2500 },
    { label: '$50', value: 5000 },
  ];

  // Billing (in Billing tab - creators only)
  const [planTier, setPlanTier] = useState('free');
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [earningsBalances, setEarningsBalances] = useState<{
    totalEarningsCents: number;
    availableEarningsCents: number;
    pendingEarningsCents: number;
  } | null>(null);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [stripeConnectStatus, setStripeConnectStatus] = useState<any>(null);
  const [connectingStripe, setConnectingStripe] = useState(false);

  // Active sessions (in Security tab)
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Password management (in Security tab)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Data export and account deletion (in Preferences tab - Danger Zone)
  const [exportingData, setExportingData] = useState(false);
  const [deleteOtpCode, setDeleteOtpCode] = useState('');
  const [deleteOtpSent, setDeleteOtpSent] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');

  // Notification preferences (in Notifications tab)
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [paymentNotifications, setPaymentNotifications] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);

  // A/B Testing (moved to Integrations tab - Scale plan only)
  const [variantGroups, setVariantGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [variantMetrics, setVariantMetrics] = useState<any[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [newVariantName, setNewVariantName] = useState('');
  const [baseVersionId, setBaseVersionId] = useState('');

  useEffect(() => {
    if (state.status === 'authenticated') {
      setName(state.user.name || '');
      setBio(state.user.bio || '');
      setPhone(state.user.phone || '');
      setTimeZone((state.user as any).timeZone || '');
      setPlanTier((state.user as any).planTier || 'free');
      setTrialEndsAt((state.user as any).trialEndsAt || null);

      // Load privacy settings
      const privacy = (state.user as any).privacySettings || {};
      setAllowSearchEngineIndexing(privacy.allowSearchEngineIndexing !== false);
      setShowInPublicDirectory(privacy.showInPublicDirectory !== false);
      setAllowAnalytics(privacy.allowAnalytics !== false);
      setProfileVisibility(privacy.profileVisibility || 'public');

      // Load appearance settings
      const appearance = (state.user as any).appearanceSettings || {};
      setLanguage(appearance.language || 'en');
      setDateFormat(appearance.dateFormat || 'MM/DD/YYYY');
      setTimeFormat(appearance.timeFormat || '12h');
      setHighContrast(appearance.highContrast || false);
      setReduceAnimations(appearance.reduceAnimations || false);
      setLargerText(appearance.largerText || false);

      // Load social links (creators only)
      if (state.user.userType === 'creator') {
        const links = (state.user as any).socialLinks || {};
        setSocialLinks({
          twitter: links.twitter || '',
          instagram: links.instagram || '',
          youtube: links.youtube || '',
          website: links.website || '',
        });
      }

      // Load payment config (creators only)
      if (state.user.userType === 'creator') {
        const config = (state.user as any).priceConfig || {};
        const tiers = Array.isArray(config.payPerChatTiers) && config.payPerChatTiers.length
          ? config.payPerChatTiers
          : [100, 500, 1000, 2500, 5000];

        setPayPerChatTiers(tiers);
        const preferred = Number(config.defaultTierCents || 0);
        setDefaultTierCents(tiers.includes(preferred) ? preferred : tiers[0]);

        setEnablePayments(config.enablePayments || false);
        setWelcomeMessage(config.welcomeMessage || '');
        setPopularQuestions(config.popularQuestions?.length ? config.popularQuestions : ['']);
        setPaymentTriggerRules(config.paymentTriggerRules || { keywords: [], minLength: 0, alwaysRequire: false });

        loadBillingHistory();
        loadStripeConnectStatus();

        // Load variant groups if Scale plan
        if ((state.user as any).planTier === 'scale') {
          loadVariantGroups();
        }
      }
    }
  }, [state]);

  const loadVariantGroups = async () => {
    setLoadingVariants(true);
    try {
      const res = await apiFetch<{ success: boolean; groups: any[] }>('/api/identity/variants/list');
      if (res.success && Array.isArray(res.groups)) {
        setVariantGroups(res.groups);
      } else {
        setVariantGroups([]);
      }
    } catch (e) {
      console.error('Failed to load variant groups:', e);
      setVariantGroups([]);
    } finally {
      setLoadingVariants(false);
    }
  };

  // Load active sessions when Security tab is opened
  useEffect(() => {
    if (state.status !== 'authenticated') return;
    if (activeTab !== 'security') return;

    const loadSessions = async () => {
      setLoadingSessions(true);
      try {
        const res = await apiFetch<{ success: boolean; sessions: any[] }>('/api/auth/sessions');
        if (res.success && Array.isArray(res.sessions)) {
          setActiveSessions(res.sessions);
        } else {
          console.error('Invalid sessions response:', res);
          setActiveSessions([]);
        }
      } catch (e) {
        console.error('Failed to load active sessions:', e);
        setActiveSessions([]);
      } finally {
        setLoadingSessions(false);
      }
    };

    loadSessions().catch(() => {});
  }, [state.status, activeTab]);

  const loadBillingHistory = async () => {
    if (state.status !== 'authenticated') return;
    setLoadingBilling(true);
    try {
      const res = await apiFetch<{ items: any[]; balances?: any }>('/api/creator/earnings');
      setBillingHistory(res.items || []);
      if (res.balances) {
        setEarningsBalances(res.balances);
      }
    } catch (e: any) {
      console.error('Failed to load billing:', e);
    } finally {
      setLoadingBilling(false);
    }
  };

  const loadStripeConnectStatus = async () => {
    if (state.status !== 'authenticated') return;
    try {
      const res = await apiFetch('/api/creator/stripe/status');
      setStripeConnectStatus(res);
    } catch (e: any) {
      console.error('Failed to load Stripe Connect status:', e);
      setStripeConnectStatus({ connected: false });
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await fetch(buildApiUrl('/api/creator/earnings/export'), {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to export CSV');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `earnings-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e: any) {
      setError('Failed to export CSV');
    }
  };

  const handleRequestPayout = async () => {
    setRequestingPayout(true);
    setError('');
    try {
      const res = await apiFetch<{ payoutId: string; amountCents: number; message?: string }>('/api/creator/earnings/payout', {
        method: 'POST',
      });
      showToast(`Payout request submitted! Amount: ${formatCurrency(res.amountCents)}. ${res.message || ''}`, 'success', 5000);
      await loadBillingHistory();
    } catch (e: any) {
      setError(e.message || 'Failed to request payout');
    } finally {
      setRequestingPayout(false);
    }
  };

  const handleConnectStripe = async () => {
    setConnectingStripe(true);
    try {
      const res = await apiFetch<{ url: string }>('/api/creator/stripe/connect', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      window.location.href = res.url;
    } catch (e: any) {
      setError(e.message || 'Failed to start Stripe onboarding');
    } finally {
      setConnectingStripe(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordSaving(true);
    setPasswordError('');
    setPasswordSuccess('');
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
    } catch (e: any) {
      setPasswordError(e.message || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleRequestSetPasswordOTP = async () => {
    setPasswordSaving(true);
    setPasswordError('');
    try {
      await apiFetch('/api/auth/set-password/request-otp', {
        method: 'POST',
      });
      setOtpSent(true);
      setPasswordSuccess('OTP sent to your email!');
    } catch (e: any) {
      setPasswordError(e.message || 'Failed to send OTP');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSetPassword = async () => {
    setPasswordSaving(true);
    setPasswordError('');
    setPasswordSuccess('');
    try {
      await apiFetch('/api/auth/set-password', {
        method: 'POST',
        body: JSON.stringify({ otpCode, newPassword }),
      });
      setPasswordSuccess('Password set successfully! You can now login with email/password.');
      setOtpCode('');
      setNewPassword('');
      setOtpSent(false);
      await refresh(); // Refresh user data to update hasPassword
    } catch (e: any) {
      setPasswordError(e.message || 'Failed to set password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const onSaveProfile = async () => {
    setSaving(true);
    setError('');
    try {
      const socialLinksData: any = {};
      if (state.user?.userType === 'creator') {
        if (socialLinks.twitter) socialLinksData.twitter = socialLinks.twitter;
        if (socialLinks.instagram) socialLinksData.instagram = socialLinks.instagram;
        if (socialLinks.youtube) socialLinksData.youtube = socialLinks.youtube;
        if (socialLinks.website) socialLinksData.website = socialLinks.website;
      }

      await apiFetch('/api/profile/update', {
        method: 'POST',
        body: JSON.stringify({
          name,
          bio: bio || undefined,
          phone: phone || undefined,
          timeZone,
          socialLinks: state.user?.userType === 'creator' && Object.keys(socialLinksData).length > 0 ? socialLinksData : undefined,
        }),
      });
      await refresh();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const onSaveProfileVisibility = async () => {
    setSaving(true);
    setError('');
    try {
      await apiFetch('/api/profile/update', {
        method: 'POST',
        body: JSON.stringify({
          privacySettings: {
            allowSearchEngineIndexing,
            showInPublicDirectory,
            profileVisibility,
          }
        }),
      });
      await refresh();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to save profile visibility settings.');
    } finally {
      setSaving(false);
    }
  };

  const onSavePrivacySettings = async () => {
    setSaving(true);
    setError('');
    try {
      await apiFetch('/api/profile/update', {
        method: 'POST',
        body: JSON.stringify({
          privacySettings: {
            allowAnalytics,
          }
        }),
      });
      await refresh();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to save privacy settings.');
    } finally {
      setSaving(false);
    }
  };

  const onSaveAppearanceSettings = async () => {
    setSaving(true);
    setError('');
    try {
      await apiFetch('/api/profile/update', {
        method: 'POST',
        body: JSON.stringify({
          appearanceSettings: {
            language,
            dateFormat,
            timeFormat,
            highContrast,
            reduceAnimations,
            largerText,
          }
        }),
      });
      await refresh();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to save appearance settings.');
    } finally {
      setSaving(false);
    }
  };

  const onSavePaymentSettings = async () => {
    setSaving(true);
    setError('');
    setSaveSuccess(false);
    try {
      const tiers = payPerChatTiers.length ? payPerChatTiers : [100, 500, 1000, 2500, 5000];
      const safeDefault = tiers.includes(defaultTierCents) ? defaultTierCents : tiers[0];

      const newConfig = {
        enablePayments,
        payPerChatTiers: tiers,
        defaultTierCents: safeDefault,
        premium: { amountCents: tiers[0] },
        vip: { amountCents: tiers[tiers.length - 1] },
        welcomeMessage: welcomeMessage || undefined,
        popularQuestions: popularQuestions.filter(q => q.trim()),
        paymentTriggerRules: paymentTriggerRules,
      };
      await apiFetch('/api/creator/pricing', {
        method: 'POST',
        body: JSON.stringify(newConfig),
      });
      await refresh();
      setError('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to save payment settings.');
    } finally {
      setSaving(false);
    }
  };

  const onSaveNotificationSettings = async () => {
    setSavingNotifications(true);
    setError('');
    try {
      await apiFetch('/api/profile/update', {
        method: 'POST',
        body: JSON.stringify({
          notificationPreferences: {
            emailNotifications,
            paymentNotifications,
            weeklySummary,
          }
        }),
      });
      await refresh();
      showToast('Notification preferences saved!', 'success');
    } catch (e: any) {
      setError(e.message || 'Failed to save notification preferences.');
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleExportData = async () => {
    setExportingData(true);
    setError('');
    try {
      const res = await fetch(buildApiUrl('/api/profile/export'), {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to export data');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `profile-export-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e: any) {
      setError(e.message || 'Failed to export data');
    } finally {
      setExportingData(false);
    }
  };

  const requestDeleteOtp = async () => {
    setDeleteInProgress(true);
    setDeleteError('');
    setDeleteSuccess('');
    try {
      await apiFetch('/api/profile/account/otp', { method: 'POST' });
      setDeleteOtpSent(true);
      setDeleteSuccess('OTP sent to your email.');
    } catch (e: any) {
      setDeleteError(e.message || 'Failed to send OTP');
    } finally {
      setDeleteInProgress(false);
    }
  };

  const confirmDeleteAccount = async () => {
    setDeleteInProgress(true);
    setDeleteError('');
    setDeleteSuccess('');
    try {
      await apiFetch('/api/profile/account', {
        method: 'DELETE',
        body: JSON.stringify({ otpCode: deleteOtpCode }),
      });
      setDeleteSuccess('Account deletion requested. Login will be disabled.');
    } catch (e: any) {
      setDeleteError(e.message || 'Failed to delete account');
    } finally {
      setDeleteInProgress(false);
    }
  };

  const upgradePlan = async (tier: 'pro' | 'growth' | 'scale') => {
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

  const toggleTier = (amount: number) => {
    setPayPerChatTiers((prev) => {
      const next = prev.includes(amount)
        ? prev.filter((x) => x !== amount)
        : [...prev, amount];
      const sorted = next.sort((a, b) => a - b);
      if (!sorted.includes(defaultTierCents)) {
        setDefaultTierCents(sorted[0] || amount);
      }
      return sorted;
    });
  };

  const addCustomTier = () => {
    const dollars = Number(customTierInput);
    if (!Number.isFinite(dollars) || dollars <= 0) return;
    const cents = Math.round(dollars * 100);
    setPayPerChatTiers((prev) => {
      if (prev.includes(cents)) return prev;
      const next = [...prev, cents].sort((a, b) => a - b);
      return next;
    });
    setCustomTierInput('');
  };

  const planNames: Record<string, string> = {
    free: 'Free',
    starter: 'Pro',
    growth: 'Growth',
    scale: 'Scale',
  };

  const planLimits: Record<string, string> = {
    free: '500 chats/month',
    starter: '5,000 chats/month',
    growth: '25,000 chats/month',
    scale: 'Unlimited',
  };

  const isCreator = state.status === 'authenticated' && state.user?.userType === 'creator';

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account, payments, and preferences</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b overflow-x-auto">
          {(isCreator
            ? [
                { id: 'profile' as Tab, label: 'Profile', icon: User },
                { id: 'billing' as Tab, label: 'Billing', icon: CreditCard },
                { id: 'integrations' as Tab, label: 'Integrations', icon: Globe },
                { id: 'notifications' as Tab, label: 'Notifications', icon: Bell },
                { id: 'security' as Tab, label: 'Security', icon: Shield },
                { id: 'preferences' as Tab, label: 'Preferences', icon: Settings2 },
              ]
            : [
                { id: 'profile' as Tab, label: 'Profile', icon: User },
                { id: 'notifications' as Tab, label: 'Notifications', icon: Bell },
                { id: 'security' as Tab, label: 'Security', icon: Shield },
                { id: 'preferences' as Tab, label: 'Preferences', icon: Settings2 },
              ]
          ).map(({ id, label, icon: Icon }) => (
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

        {/* ===== PROFILE TAB ===== */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Manage your public-facing identity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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

                <div className="space-y-2">
                  <label className="text-sm font-medium">Display Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Bio (160 characters)</label>
                  <textarea
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 160))}
                    placeholder="Tell people about yourself..."
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground">{bio.length}/160 characters</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Timezone</label>
                  <Input value={timeZone} onChange={(e) => setTimeZone(e.target.value)} placeholder="UTC-5" />
                </div>

                {isCreator && (
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-lg font-semibold">Social Links</h3>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Twitter/X</label>
                      <Input
                        value={socialLinks.twitter}
                        onChange={(e) => setSocialLinks({ ...socialLinks, twitter: e.target.value })}
                        placeholder="https://twitter.com/yourhandle"
                        type="url"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Instagram</label>
                      <Input
                        value={socialLinks.instagram}
                        onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                        placeholder="https://instagram.com/yourhandle"
                        type="url"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">YouTube</label>
                      <Input
                        value={socialLinks.youtube}
                        onChange={(e) => setSocialLinks({ ...socialLinks, youtube: e.target.value })}
                        placeholder="https://youtube.com/@yourhandle"
                        type="url"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Website</label>
                      <Input
                        value={socialLinks.website}
                        onChange={(e) => setSocialLinks({ ...socialLinks, website: e.target.value })}
                        placeholder="https://yourwebsite.com"
                        type="url"
                      />
                    </div>
                  </div>
                )}

                <Button className="w-full" onClick={onSaveProfile} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : saveSuccess ? (
                    <>
                      <Check className="mr-2 h-4 w-4 animate-scale-in" />
                      Saved!
                    </>
                  ) : (
                    'Save changes'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Profile Visibility (moved from Account > Preferences) */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Profile Visibility</CardTitle>
                <CardDescription>Control how your profile is visible to others</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Search Engine Indexing</label>
                    <p className="text-xs text-muted-foreground">Allow search engines to index your profile</p>
                  </div>
                  <Switch checked={allowSearchEngineIndexing} onCheckedChange={setAllowSearchEngineIndexing} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Public Directory</label>
                    <p className="text-xs text-muted-foreground">Show profile in public directory</p>
                  </div>
                  <Switch checked={showInPublicDirectory} onCheckedChange={setShowInPublicDirectory} />
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-sm font-medium">Profile Visibility</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="visibility"
                        checked={profileVisibility === 'public'}
                        onChange={() => setProfileVisibility('public')}
                      />
                      <div>
                        <div className="text-sm font-medium">Public</div>
                        <div className="text-xs text-muted-foreground">Anyone can view your profile</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="visibility"
                        checked={profileVisibility === 'unlisted'}
                        onChange={() => setProfileVisibility('unlisted')}
                      />
                      <div>
                        <div className="text-sm font-medium">Unlisted</div>
                        <div className="text-xs text-muted-foreground">Only people with the link can view</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="visibility"
                        checked={profileVisibility === 'private'}
                        onChange={() => setProfileVisibility('private')}
                      />
                      <div>
                        <div className="text-sm font-medium">Private</div>
                        <div className="text-xs text-muted-foreground">Only you can view</div>
                      </div>
                    </label>
                  </div>
                </div>

                <Button className="w-full" onClick={onSaveProfileVisibility} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : saveSuccess ? (
                    <>
                      <Check className="mr-2 h-4 w-4 animate-scale-in" />
                      Saved!
                    </>
                  ) : (
                    'Save Visibility Settings'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== BILLING TAB (CREATORS ONLY) ===== */}
        {activeTab === 'billing' && isCreator && (
          <div className="space-y-6">
            {/* Earnings Overview */}
            {earningsBalances && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Earnings Overview</CardTitle>
                  <CardDescription>Your pay-per-chat earnings and payout status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Total Earnings</div>
                      <div className="text-2xl font-bold">{formatCurrency(earningsBalances.totalEarningsCents)}</div>
                    </div>
                    <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                      <div className="text-sm text-muted-foreground mb-1">Available for Payout</div>
                      <div className="text-2xl font-bold text-green-600">{formatCurrency(earningsBalances.availableEarningsCents)}</div>
                      <div className="text-xs text-muted-foreground mt-1">Ready to withdraw (7+ days old)</div>
                    </div>
                    <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                      <div className="text-sm text-muted-foreground mb-1">Pending</div>
                      <div className="text-2xl font-bold text-yellow-600">{formatCurrency(earningsBalances.pendingEarningsCents)}</div>
                      <div className="text-xs text-muted-foreground mt-1">Hold period (last 7 days)</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleRequestPayout}
                      disabled={requestingPayout || earningsBalances.availableEarningsCents < 1000}
                      className="flex-1"
                    >
                      {requestingPayout ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        `Request Payout (Min $10.00)`
                      )}
                    </Button>
                    <Button variant="outline" onClick={handleExportCSV}>
                      <FileText className="mr-2 h-4 w-4" />
                      Export CSV
                    </Button>
                  </div>
                  {earningsBalances.availableEarningsCents < 1000 && (
                    <p className="text-xs text-muted-foreground">
                      Minimum payout is $10.00. You need ${formatCurrency(1000 - earningsBalances.availableEarningsCents)} more to request a payout.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Payout Settings - Stripe Connect */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Payout Settings</CardTitle>
                <CardDescription>Enable marketplace payouts by connecting Stripe</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {stripeConnectStatus?.connected ? (
                  <div className="space-y-2 text-sm text-text-secondary">
                    <div>Connected: {stripeConnectStatus.chargesEnabled ? 'Charges enabled' : 'Charges pending'}</div>
                    <div>Payouts: {stripeConnectStatus.payoutsEnabled ? 'Enabled' : 'Disabled'}</div>
                  </div>
                ) : (
                  <div className="text-sm text-text-secondary">
                    Not connected. Connect to receive marketplace payouts.
                  </div>
                )}
                <Button onClick={handleConnectStripe} disabled={connectingStripe}>
                  {connectingStripe ? 'Connecting…' : stripeConnectStatus?.connected ? 'Update Stripe Info' : 'Connect Stripe'}
                </Button>
              </CardContent>
            </Card>

            {/* Pay-Per-Chat Configuration */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Pay-Per-Chat Configuration</CardTitle>
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
                      <label className="text-sm font-medium">Select tiers</label>
                      <div className="grid grid-cols-2 gap-2">
                        {payTierOptions.map((opt) => (
                          <label key={opt.value} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={payPerChatTiers.includes(opt.value)}
                              onChange={() => toggleTier(opt.value)}
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Input
                          type="number"
                          min={1}
                          step="0.01"
                          value={customTierInput}
                          onChange={(e) => setCustomTierInput(e.target.value)}
                          placeholder="Custom amount (USD)"
                        />
                        <Button type="button" variant="outline" onClick={addCustomTier}>
                          Add
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Default tier</label>
                      <select
                        className="w-full border rounded-md px-3 py-2 bg-background"
                        value={defaultTierCents}
                        onChange={(e) => setDefaultTierCents(Number(e.target.value))}
                      >
                        {payPerChatTiers.map((amount) => (
                          <option key={amount} value={amount}>
                            {formatCurrency(amount)}
                          </option>
                        ))}
                      </select>
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

                    <div className="space-y-4 pt-4 border-t">
                      <label className="text-sm font-medium">Payment Trigger Rules</label>
                      <p className="text-xs text-muted-foreground">
                        Configure when payment should be required (in addition to the 3 free messages limit)
                      </p>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="alwaysRequire"
                          checked={paymentTriggerRules.alwaysRequire}
                          onChange={(e) => setPaymentTriggerRules({ ...paymentTriggerRules, alwaysRequire: e.target.checked })}
                          className="rounded"
                        />
                        <label htmlFor="alwaysRequire" className="text-sm cursor-pointer">
                          Always require payment (after free messages)
                        </label>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Keywords (comma-separated)</label>
                        <Input
                          value={paymentTriggerRules.keywords.join(', ')}
                          onChange={(e) => {
                            const keywords = e.target.value.split(',').map(k => k.trim()).filter(Boolean);
                            setPaymentTriggerRules({ ...paymentTriggerRules, keywords });
                          }}
                          placeholder="consultation, detailed, premium, urgent"
                        />
                        <p className="text-xs text-muted-foreground">
                          Questions containing these keywords will require payment
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Minimum Length (characters)</label>
                        <Input
                          type="number"
                          value={paymentTriggerRules.minLength || 0}
                          onChange={(e) => setPaymentTriggerRules({ ...paymentTriggerRules, minLength: parseInt(e.target.value) || 0 })}
                          min={0}
                          placeholder="0 = disabled"
                        />
                        <p className="text-xs text-muted-foreground">
                          Questions longer than this will require payment (0 to disable)
                        </p>
                      </div>
                    </div>
                  </>
                )}

                <Button className="w-full" onClick={onSavePaymentSettings} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : saveSuccess ? (
                    <>
                      <Check className="mr-2 h-4 w-4 animate-scale-in" />
                      Saved!
                    </>
                  ) : (
                    'Save payment settings'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Spending Dashboard */}
            <SpendingDashboard />

            {/* Billing History */}
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

            {/* Subscription Plans */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Subscription & Plans</CardTitle>
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
                      onClick={() => upgradePlan('pro')}
                      disabled={saving || planTier === 'starter'}
                    >
                      Pro ($49/mo)
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
          </div>
        )}

        {/* ===== INTEGRATIONS TAB (CREATORS ONLY) ===== */}
        {activeTab === 'integrations' && isCreator && (
          <div className="space-y-6">
            <IntegrationsPage embedded />

            {/* A/B Testing (moved from Account tab - Scale plan only) */}
            {planTier === 'scale' && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle>A/B Testing</CardTitle>
                  <CardDescription>Create and manage variant groups (Scale plan feature)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingVariants ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : variantGroups.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No variant groups yet. Create one below.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {variantGroups.map((group: any) => (
                        <div key={group.id} className="p-3 border rounded-lg">
                          <div className="font-medium">{group.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {group.variants?.length || 0} variants
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-4 border-t space-y-4">
                    <h3 className="text-sm font-semibold">Create New Variant</h3>
                    <div>
                      <Label>Base Version ID</Label>
                      <Input
                        value={baseVersionId}
                        onChange={(e) => setBaseVersionId(e.target.value)}
                        placeholder="Enter identity version ID"
                      />
                    </div>
                    <div>
                      <Label>Variant Name</Label>
                      <Input
                        value={newVariantName}
                        onChange={(e) => setNewVariantName(e.target.value)}
                        placeholder="e.g., Variant B"
                      />
                    </div>
                    <Button
                      onClick={async () => {
                        if (!baseVersionId || !newVariantName) {
                          setError('Please fill in all fields');
                          return;
                        }
                        setSaving(true);
                        setError('');
                        try {
                          const res = await apiFetch('/api/identity/variants/create', {
                            method: 'POST',
                            body: JSON.stringify({
                              baseVersionId,
                              variantName: newVariantName,
                            }),
                          });
                          if (res.success) {
                            setNewVariantName('');
                            setBaseVersionId('');
                            const groupsRes = await apiFetch('/api/identity/variants/list');
                            if (groupsRes.success) {
                              setVariantGroups(groupsRes.groups);
                            }
                          }
                        } catch (e: any) {
                          setError(e.message || 'Failed to create variant');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving || !baseVersionId || !newVariantName}
                    >
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Create Variant
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ===== NOTIFICATIONS TAB ===== */}
        {activeTab === 'notifications' && (
          <Card className="glass">
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>Choose what emails you receive and how often</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-3">Chat & Messages</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="font-medium text-sm mb-2">New Chat Messages</div>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="chatNotifications"
                            checked={!emailNotifications}
                            onChange={() => setEmailNotifications(false)}
                          />
                          <span className="text-sm">Off</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="chatNotifications"
                            checked={emailNotifications}
                            onChange={() => setEmailNotifications(true)}
                          />
                          <span className="text-sm">Instant</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer opacity-50">
                          <input type="radio" name="chatNotifications" disabled />
                          <span className="text-sm">Daily digest (Soon)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {isCreator && (
                  <div className="pt-4 border-t">
                    <h3 className="text-sm font-semibold mb-3">Payments & Billing</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="font-medium text-sm mb-2">Payment Received</div>
                        <div className="flex gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="paymentNotifications"
                              checked={!paymentNotifications}
                              onChange={() => setPaymentNotifications(false)}
                            />
                            <span className="text-sm">Off</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="paymentNotifications"
                              checked={paymentNotifications}
                              onChange={() => setPaymentNotifications(true)}
                            />
                            <span className="text-sm">Instant</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer opacity-50">
                            <input type="radio" name="paymentNotifications" disabled />
                            <span className="text-sm">Daily digest (Soon)</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <h3 className="text-sm font-semibold mb-3">Activity & Insights</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Weekly Activity Summary</div>
                      <div className="text-xs text-muted-foreground">Receive weekly stats every Monday</div>
                    </div>
                    <Switch checked={weeklySummary} onCheckedChange={setWeeklySummary} />
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h3 className="text-sm font-semibold mb-3">Product & Features</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="font-medium text-sm mb-2">Product Updates</div>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="productUpdates" defaultChecked />
                          <span className="text-sm">Important only</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="productUpdates" />
                          <span className="text-sm">All updates</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <div className="font-medium text-sm">Security Alerts</div>
                        <div className="text-xs text-muted-foreground">Cannot be disabled</div>
                      </div>
                      <Switch checked={true} disabled />
                    </div>
                  </div>
                </div>
              </div>

              <Button className="w-full" onClick={onSaveNotificationSettings} disabled={savingNotifications}>
                {savingNotifications ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save Notification Preferences'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ===== SECURITY TAB ===== */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Email & Phone</CardTitle>
                <CardDescription>Manage your email and phone for account recovery</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address</label>
                  <Input value={state.user.email} readOnly disabled />
                  <p className="text-xs text-muted-foreground">Contact support to change your email</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone (optional)</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 1234567890" />
                </div>

                <Button className="w-full" onClick={async () => {
                  setSaving(true);
                  setError('');
                  try {
                    await apiFetch('/api/profile/update', {
                      method: 'POST',
                      body: JSON.stringify({ phone: phone || undefined }),
                    });
                    await refresh();
                    setSaveSuccess(true);
                    setTimeout(() => setSaveSuccess(false), 3000);
                  } catch (e: any) {
                    setError(e.message || 'Failed to save.');
                  } finally {
                    setSaving(false);
                  }
                }} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : saveSuccess ? (
                    <>
                      <Check className="mr-2 h-4 w-4 animate-scale-in" />
                      Saved!
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Password Management */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Password Management</CardTitle>
                <CardDescription>Change or set your account password</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {passwordError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{passwordError}</AlertDescription>
                  </Alert>
                )}
                {passwordSuccess && (
                  <Alert>
                    <Check className="h-4 w-4" />
                    <AlertDescription>{passwordSuccess}</AlertDescription>
                  </Alert>
                )}
                {state.user.hasPassword ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Current Password</Label>
                      <div className="relative">
                        <Input
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                        >
                          {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>New Password</Label>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <PasswordStrengthMeter password={newPassword} />
                    </div>
                    <Button
                      onClick={handleChangePassword}
                      disabled={passwordSaving || !currentPassword || !newPassword}
                    >
                      {passwordSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Change Password
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        You're using Google login. Set a password to enable email/password login.
                      </AlertDescription>
                    </Alert>
                    <Button
                      variant="outline"
                      onClick={handleRequestSetPasswordOTP}
                      disabled={passwordSaving || otpSent}
                    >
                      {passwordSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Send OTP to {state.user.email}
                    </Button>
                    {otpSent && (
                      <>
                        <Input
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Enter 6-digit OTP"
                          maxLength={6}
                        />
                        <div className="relative">
                          <Input
                            type={showSetPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSetPassword((v) => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                          >
                            {showSetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <PasswordStrengthMeter password={newPassword} />
                        <Button
                          onClick={handleSetPassword}
                          disabled={passwordSaving || !otpCode || !newPassword || otpCode.length !== 6}
                        >
                          {passwordSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Set Password
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Connected Accounts */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Connected Accounts</CardTitle>
                <CardDescription>Manage third-party account connections</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5" />
                    <div>
                      <div className="font-medium">Google</div>
                      <div className="text-sm text-muted-foreground">
                        {state.user.hasGoogle ? 'Connected' : 'Not connected'}
                      </div>
                    </div>
                  </div>
                  {state.user.hasGoogle ? (
                    <Button variant="outline" size="sm" disabled>
                      Connected
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = buildApiUrl('/api/auth/google')}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Active Sessions */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Active Sessions</CardTitle>
                <CardDescription>Manage your active login sessions across devices</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeSessions.length > 1 && (
                  <div className="flex justify-end mb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await apiFetch('/api/auth/sessions/all-other', { method: 'DELETE' });
                          const res = await apiFetch<{ success: boolean; sessions: any[] }>('/api/auth/sessions');
                          if (res.success && Array.isArray(res.sessions)) {
                            setActiveSessions(res.sessions);
                          }
                        } catch (e) {
                          console.error('Failed to logout all other sessions:', e);
                        }
                      }}
                    >
                      Logout All Other Sessions
                    </Button>
                  </div>
                )}
                {loadingSessions ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : activeSessions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No active login sessions found.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeSessions.map((s: any) => (
                      <div
                        key={s.id}
                        className={`flex items-center justify-between p-3 border rounded-lg ${
                          s.isCurrent ? 'border-primary bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium">
                              {s.device || s.deviceInfo || 'Unknown Device'}
                            </div>
                            {s.isCurrent && (
                              <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded-full">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {s.ipAddress || 'Unknown IP'} • Active {s.lastActiveAt
                              ? new Date(s.lastActiveAt).toLocaleString()
                              : 'Unknown'}
                          </div>
                        </div>
                        {!s.isCurrent && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                await apiFetch(`/api/auth/sessions/${s.id}`, { method: 'DELETE' });
                                setActiveSessions((prev) => prev.filter((x) => x.id !== s.id));
                              } catch (e) {
                                console.error('Failed to end session:', e);
                              }
                            }}
                          >
                            End
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Two-Factor Authentication (Future) */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Two-Factor Authentication</CardTitle>
                <CardDescription>Add an extra layer of security to your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                  <div>
                    <div className="font-medium">Status: Not Enabled</div>
                    <div className="text-sm text-muted-foreground mt-1">Protect your account with 2FA</div>
                  </div>
                  <Lock className="h-8 w-8 text-muted-foreground" />
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Two-factor authentication will be available soon. When enabled, you'll need to enter a code from your authenticator app in addition to your password.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== PREFERENCES TAB ===== */}
        {activeTab === 'preferences' && (
          <div className="space-y-6">
            {/* Appearance */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Theme</CardTitle>
                <CardDescription>Customize the look and feel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <label className="text-sm font-medium">Color Mode</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => {
                        if (theme === 'dark') toggleTheme();
                      }}
                      className={`p-4 border-2 rounded-lg text-center transition-all ${
                        theme === 'light' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="text-2xl mb-2">☀️</div>
                      <div className="text-sm font-medium">Light</div>
                    </button>
                    <button
                      onClick={() => {
                        if (theme === 'light') toggleTheme();
                      }}
                      className={`p-4 border-2 rounded-lg text-center transition-all ${
                        theme === 'dark' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="text-2xl mb-2">🌙</div>
                      <div className="text-sm font-medium">Dark</div>
                    </button>
                    <button
                      disabled
                      className="p-4 border-2 rounded-lg text-center opacity-50 cursor-not-allowed"
                    >
                      <div className="text-2xl mb-2">💻</div>
                      <div className="text-sm font-medium">Auto</div>
                      <div className="text-xs text-muted-foreground mt-1">Soon</div>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Current theme: <span className="font-medium capitalize">{theme}</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Language & Region</CardTitle>
                <CardDescription>Set your preferred language and formats</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Language</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 bg-background"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="en">English</option>
                    <option value="es">Español (Coming soon)</option>
                    <option value="fr">Français (Coming soon)</option>
                    <option value="de">Deutsch (Coming soon)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Date Format</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 bg-background"
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY (Europe)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Time Format</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 bg-background"
                    value={timeFormat}
                    onChange={(e) => setTimeFormat(e.target.value)}
                  >
                    <option value="12h">12-hour (AM/PM)</option>
                    <option value="24h">24-hour</option>
                  </select>
                </div>

                <Button className="w-full" onClick={onSaveAppearanceSettings} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : saveSuccess ? (
                    <>
                      <Check className="mr-2 h-4 w-4 animate-scale-in" />
                      Saved!
                    </>
                  ) : (
                    'Save Preferences'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Accessibility */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Accessibility</CardTitle>
                <CardDescription>Adjust settings for better accessibility</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">High Contrast Mode</label>
                    <p className="text-xs text-muted-foreground">Increase contrast for better visibility</p>
                  </div>
                  <Switch checked={highContrast} onCheckedChange={setHighContrast} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Reduce Animations</label>
                    <p className="text-xs text-muted-foreground">Minimize motion effects</p>
                  </div>
                  <Switch checked={reduceAnimations} onCheckedChange={setReduceAnimations} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Larger Text</label>
                    <p className="text-xs text-muted-foreground">Increase base font size</p>
                  </div>
                  <Switch checked={largerText} onCheckedChange={setLargerText} />
                </div>

                <Button className="w-full" onClick={onSaveAppearanceSettings} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : saveSuccess ? (
                    <>
                      <Check className="mr-2 h-4 w-4 animate-scale-in" />
                      Saved!
                    </>
                  ) : (
                    'Save Accessibility Settings'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Privacy */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Privacy</CardTitle>
                <CardDescription>Control your data and privacy preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Analytics Tracking</label>
                    <p className="text-xs text-muted-foreground">Allow analytics tracking for improvements</p>
                  </div>
                  <Switch checked={allowAnalytics} onCheckedChange={setAllowAnalytics} />
                </div>

                <Button className="w-full" onClick={onSavePrivacySettings} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : saveSuccess ? (
                    <>
                      <Check className="mr-2 h-4 w-4 animate-scale-in" />
                      Saved!
                    </>
                  ) : (
                    'Save Privacy Settings'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="glass border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>Irreversible actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Export Account Data</h3>
                  <p className="text-sm text-muted-foreground">Download your profile, chats, payments, and uploads in a ZIP file.</p>
                  <Button variant="outline" onClick={handleExportData} disabled={exportingData}>
                    {exportingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Download Export
                  </Button>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <h3 className="text-sm font-semibold text-destructive">Delete Account</h3>
                  <p className="text-sm text-muted-foreground">Soft delete with a 30-day grace period. Login will be blocked.</p>
                  {deleteError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{deleteError}</AlertDescription>
                    </Alert>
                  )}
                  {deleteSuccess && (
                    <Alert>
                      <Check className="h-4 w-4" />
                      <AlertDescription>{deleteSuccess}</AlertDescription>
                    </Alert>
                  )}
                  <Button variant="outline" onClick={requestDeleteOtp} disabled={deleteInProgress || deleteOtpSent}>
                    {deleteInProgress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Send OTP
                  </Button>
                  {deleteOtpSent && (
                    <div className="space-y-2 pt-2">
                      <Label>OTP Code</Label>
                      <Input
                        value={deleteOtpCode}
                        onChange={(e) => setDeleteOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Enter 6-digit OTP"
                        maxLength={6}
                      />
                      <Button
                        variant="destructive"
                        onClick={confirmDeleteAccount}
                        disabled={deleteInProgress || deleteOtpCode.length !== 6}
                      >
                        {deleteInProgress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Confirm Delete
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </Layout>
  );
}
