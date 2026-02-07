import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ArrowUp } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface ListingForm {
  isPublic: boolean;
  isFeatured: boolean;
  title: string;
  shortPitch: string;
  thumbnailUrl: string;
  category: string;
  subscriptionPriceCents: number;
  currency: string;
  freeTrialQuestions: number;
  description: string;
  tags: string;
  enableSubscriptions: boolean;
  enablePayPerChat: boolean;
  enableFreeChat: boolean;
  payPerChatPriceCents: number;
  freeMessageLimit: number;
}

export function MarketplaceManagePage() {
  const { state } = useAuth();
  const nav = useNavigate();
  const user = state.status === 'authenticated' ? state.user : null;
  const planTier = (user as any)?.planTier || 'free';
  const trialEndsAt = (user as any)?.trialEndsAt;
  const isTrialActive = trialEndsAt && new Date(trialEndsAt) > new Date();
  const isFreeTier = planTier === 'free' && !isTrialActive;

  const [form, setForm] = useState<ListingForm>({
    isPublic: false,
    isFeatured: false,
    title: '',
    shortPitch: '',
    thumbnailUrl: '',
    category: '',
    subscriptionPriceCents: 999,
    currency: 'USD',
    freeTrialQuestions: 0,
    description: '',
    tags: '',
    enableSubscriptions: false,
    enablePayPerChat: false,
    enableFreeChat: true,
    payPerChatPriceCents: 1000,
    freeMessageLimit: 3,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/api/marketplace/my-listing')
      .then((data) => {
        if (data.item) {
          setForm({
            isPublic: data.item.isPublic ?? false,
            isFeatured: data.item.isFeatured ?? false,
            title: data.item.title || '',
            shortPitch: data.item.shortPitch || '',
            thumbnailUrl: data.item.thumbnailUrl || '',
            category: data.item.category || '',
            subscriptionPriceCents: data.item.subscriptionPriceCents || 999,
            currency: data.item.currency || 'USD',
            freeTrialQuestions: data.item.freeTrialQuestions || 0,
            description: data.item.description || '',
            tags: (data.item.tags || []).join(','),
            enableSubscriptions: data.item.enableSubscriptions ?? false,
            enablePayPerChat: data.item.enablePayPerChat ?? false,
            enableFreeChat: data.item.enableFreeChat ?? true,
            payPerChatPriceCents: data.item.payPerChatPriceCents || 1000,
            freeMessageLimit: data.item.freeMessageLimit || 3,
          });
        }
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/marketplace/listings', {
        method: 'POST',
        body: JSON.stringify({
          isPublic: form.isPublic,
          isFeatured: form.isFeatured,
          title: form.title,
          shortPitch: form.shortPitch,
          thumbnailUrl: form.thumbnailUrl,
          category: form.category,
          subscriptionPriceCents: form.subscriptionPriceCents,
          currency: form.currency,
          freeTrialQuestions: form.freeTrialQuestions,
          description: form.description,
          tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
          enableSubscriptions: form.enableSubscriptions,
          enablePayPerChat: form.enablePayPerChat,
          enableFreeChat: form.enableFreeChat,
          payPerChatPriceCents: form.payPerChatPriceCents,
          freeMessageLimit: form.freeMessageLimit,
          publishStatus: form.isPublic ? 'published' : 'draft',
        }),
      });
      showToast('Listing saved', 'success');
    } catch (err: any) {
      if (err.status === 403 && err.errorCode === 'UPGRADE_REQUIRED') {
        showToast('Upgrade to Starter plan to publish on marketplace', 'error');
        nav('/pricing');
      } else if (err.status === 400 && err.errorCode === 'PUBLISH_PREREQ_FAILED') {
        const missing = err.missing || [];
        const missingLabels: Record<string, string> = {
          title: 'Title',
          thumbnail: 'Thumbnail',
          category: 'Category',
          description: 'Description',
          choose_monetization: 'Enable monetization (Subscription or Pay-per-chat)',
          subscription_price: 'Subscription price',
          pay_per_chat_price: 'Pay-per-chat price',
          stripe_connect_verified: 'Stripe Connect (details + payouts enabled)',
        };
        const errorMsg = missing.map((m: string) => missingLabels[m] || m).join(', ');
        showToast(`Cannot publish. Missing: ${errorMsg}`, 'error', 7000);
      } else {
        showToast(err.message || 'Failed to save listing', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Marketplace Listing</h1>
          <p className="text-text-secondary">Manage your public listing and pricing.</p>
        </div>

        {/* Phase 2: Free tier upgrade banner */}
        {isFreeTier && (
          <Alert className="border-orange-500/30 bg-orange-500/10">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div>
                  <strong>Upgrade to list on marketplace</strong>
                  <p className="text-sm mt-1">
                    Free tier creators cannot list on the marketplace. Upgrade to Starter plan ($49/month) 
                    to make your AI discoverable and start earning from visitors.
                  </p>
                </div>
                <Button onClick={() => nav('/pricing')} size="sm" className="ml-4">
                  <ArrowUp className="h-4 w-4 mr-2" />
                  Upgrade Now
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {!form.isPublic && !isFreeTier && (
          <Alert className="border-yellow-500/30 bg-yellow-500/10">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <AlertDescription>
              <strong>Your listing is currently private.</strong> Turn on "Make listing public" 
              below to make it visible in the marketplace. Users won't be able to find your AI 
              clone until you make it public.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
              disabled={isFreeTier}
            />
            <span className={isFreeTier ? 'text-muted-foreground' : ''}>
              Make listing public {isFreeTier && '(Upgrade required)'}
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
            />
            <span>Feature on homepage</span>
          </label>

          <Input
            placeholder="Title *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <Input
            placeholder="Thumbnail URL *"
            value={form.thumbnailUrl}
            onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })}
            required
          />
          <Input
            placeholder="Short pitch (optional)"
            value={form.shortPitch}
            onChange={(e) => setForm({ ...form, shortPitch: e.target.value })}
          />
          <Input
            placeholder="Category *"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            required
          />
          <textarea
            className="w-full min-h-[120px] border rounded-md px-3 py-2 bg-background"
            placeholder="Description *"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
          />
          <Input
            placeholder="Tags (comma separated)"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
          />

          <div className="border-t pt-4 space-y-3">
            <h3 className="font-semibold">Monetization</h3>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.enableSubscriptions}
                onChange={(e) => setForm({ ...form, enableSubscriptions: e.target.checked })}
              />
              <span>Enable Subscriptions</span>
            </label>
            {form.enableSubscriptions && (
              <Input
                placeholder="Subscription price (cents)"
                value={String(form.subscriptionPriceCents)}
                onChange={(e) => setForm({ ...form, subscriptionPriceCents: Number(e.target.value || 0) })}
              />
            )}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.enablePayPerChat}
                onChange={(e) => setForm({ ...form, enablePayPerChat: e.target.checked })}
              />
              <span>Enable Pay-per-chat</span>
            </label>
            {form.enablePayPerChat && (
              <>
                <Input
                  placeholder="Pay-per-chat price (cents)"
                  value={String(form.payPerChatPriceCents)}
                  onChange={(e) => setForm({ ...form, payPerChatPriceCents: Number(e.target.value || 0) })}
                />
                <Input
                  placeholder="Free message limit"
                  value={String(form.freeMessageLimit)}
                  onChange={(e) => setForm({ ...form, freeMessageLimit: Number(e.target.value || 0) })}
                />
              </>
            )}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.enableFreeChat}
                onChange={(e) => setForm({ ...form, enableFreeChat: e.target.checked })}
              />
              <span>Enable Free Chat Preview</span>
            </label>
          </div>
        </div>

        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Listing'}
        </Button>
      </div>
    </Layout>
  );
}

