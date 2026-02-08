import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, ArrowUp, Eye } from 'lucide-react';
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

const CATEGORY_OPTIONS = [
  'Business',
  'Creator / Influencer',
  'Coaching',
  'Marketing',
  'Sales',
  'Fitness',
  'Education',
  'Tech',
  'Finance',
  'Spirituality',
  'Other',
];

function dollarsToCents(v: string) {
  const n = Number.parseFloat(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100));
}
function centsToDollars(cents: number) {
  const n = Number(cents || 0) / 100;
  return n.toFixed(2);
}

export function MarketplaceManagePage() {
  const { state } = useAuth();
  const nav = useNavigate();
  const user = state.status === 'authenticated' ? state.user : null;

  const planTier = (user as any)?.planTier || 'free';
  const trialEndsAt = (user as any)?.trialEndsAt;
  const isTrialActive = trialEndsAt && new Date(trialEndsAt) > new Date();
  const isFreeTier = planTier === 'free' && !isTrialActive;

  const isAdmin = Boolean((user as any)?.isAdmin);

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
            tags: (data.item.tags || []).join(', '),
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

  const tagsList = useMemo(() => {
    return form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);
  }, [form.tags]);

  const publishMissing = useMemo(() => {
    const missing: string[] = [];
    if (!form.title.trim()) missing.push('Title');
    if (!form.thumbnailUrl.trim()) missing.push('Thumbnail');
    if (!form.category.trim()) missing.push('Category');
    if (!form.description.trim()) missing.push('Description');

    if (!form.enableSubscriptions && !form.enablePayPerChat) missing.push('Monetization (Subscription or Pay‑per‑chat)');

    if (form.enableSubscriptions && form.subscriptionPriceCents <= 0) missing.push('Subscription price');
    if (form.enablePayPerChat && form.payPerChatPriceCents <= 0) missing.push('Pay‑per‑chat price');

    return missing;
  }, [form]);

  const save = async () => {
    if (isFreeTier && form.isPublic) {
      showToast('Upgrade to Starter plan to publish on marketplace', 'error');
      nav('/pricing');
      return;
    }

    // Client-side publish prereq (so UX doesn’t feel random)
    if (form.isPublic && publishMissing.length > 0) {
      showToast(`Cannot publish yet. Missing: ${publishMissing.join(', ')}`, 'error', 7000);
      return;
    }

    setSaving(true);
    try {
      await apiFetch('/api/marketplace/listings', {
        method: 'POST',
        body: JSON.stringify({
          isPublic: form.isPublic,
          isFeatured: isAdmin ? form.isFeatured : false,
          title: form.title.trim(),
          shortPitch: form.shortPitch.trim(),
          thumbnailUrl: form.thumbnailUrl.trim(),
          category: form.category.trim(),
          subscriptionPriceCents: form.subscriptionPriceCents,
          currency: form.currency,
          freeTrialQuestions: form.freeTrialQuestions,
          description: form.description.trim(),
          tags: tagsList,
          enableSubscriptions: form.enableSubscriptions,
          enablePayPerChat: form.enablePayPerChat,
          enableFreeChat: form.enableFreeChat,
          payPerChatPriceCents: form.payPerChatPriceCents,
          freeMessageLimit: form.freeMessageLimit,
          publishStatus: form.isPublic ? 'published' : 'draft',
        }),
      });
      showToast(form.isPublic ? 'Listing published' : 'Listing saved as draft', 'success');
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
          choose_monetization: 'Enable monetization (Subscription or Pay‑per‑chat)',
          subscription_price: 'Subscription price',
          pay_per_chat_price: 'Pay‑per‑chat price',
          stripe_connect_verified: 'Payout setup (currently unavailable)',
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

  const thumbOk = form.thumbnailUrl.trim().length > 6;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Marketplace listing</h1>
            <p className="text-text-secondary">
              Create a clean public page for your AI. Save as draft anytime, publish when ready.
            </p>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Button variant="outline" onClick={() => nav('/marketplace')} disabled={saving}>
              <Eye className="h-4 w-4 mr-2" />
              View marketplace
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : form.isPublic ? 'Publish' : 'Save draft'}
            </Button>
          </div>
        </div>

        {isFreeTier && (
          <Alert className="border-orange-500/30 bg-orange-500/10">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <AlertDescription>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <strong>Upgrade to publish</strong>
                  <p className="text-sm mt-1">
                    Free tier creators can edit drafts, but publishing requires Starter plan (or active trial).
                  </p>
                </div>
                <Button onClick={() => nav('/pricing')} size="sm">
                  <ArrowUp className="h-4 w-4 mr-2" />
                  Upgrade
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-[1fr_380px] gap-6">
          {/* LEFT: Form */}
          <div className="space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Status</CardTitle>
                <CardDescription>Draft is private. Publish when you’re ready.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label className={isFreeTier ? 'text-muted-foreground' : ''}>Make listing public</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      When public, your AI appears in marketplace search.
                    </p>
                  </div>
                  <Switch
                    checked={form.isPublic}
                    onCheckedChange={(checked) => setForm({ ...form, isPublic: checked })}
                    disabled={isFreeTier}
                  />
                </div>

                {isAdmin && (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label>Feature on homepage</Label>
                      <p className="text-xs text-muted-foreground mt-1">Admin-only. Boost visibility.</p>
                    </div>
                    <Switch
                      checked={form.isFeatured}
                      onCheckedChange={(checked) => setForm({ ...form, isFeatured: checked })}
                    />
                  </div>
                )}

                {form.isPublic && publishMissing.length > 0 && (
                  <Alert className="border-yellow-500/30 bg-yellow-500/10">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <AlertDescription>
                      <strong>Almost there.</strong> Add: {publishMissing.join(', ')}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Listing details</CardTitle>
                <CardDescription>Keep it crisp. People skim.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g., Growth Mentor AI for SaaS Founders"
                  />
                  <p className="text-xs text-muted-foreground">Aim for 40–60 characters.</p>
                </div>

                <div className="space-y-2">
                  <Label>Short pitch</Label>
                  <Input
                    value={form.shortPitch}
                    onChange={(e) => setForm({ ...form, shortPitch: e.target.value })}
                    placeholder="1 line: what can visitors achieve?"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm({ ...form, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent className="mt-2 w-full">
                      {CATEGORY_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Description *</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder={`What this AI helps with:\n- Who it's for\n- What it can do\n- What it can't do\n- Example questions`}
                    className="min-h-[140px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tags</Label>
                  <Input
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    placeholder="e.g., marketing, startup, copywriting"
                  />
                  <p className="text-xs text-muted-foreground">Comma-separated. Keep it to 5–10.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Thumbnail</CardTitle>
                <CardDescription>Square image works best (1:1). Use a clean face/logo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Thumbnail URL *</Label>
                  <Input
                    value={form.thumbnailUrl}
                    onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })}
                    placeholder="https://…"
                  />
                </div>

                {thumbOk && (
                  <div className="flex items-center gap-3">
                    <img
                      src={form.thumbnailUrl}
                      onError={(e) => ((e.currentTarget.style.display = 'none'))}
                      alt="Thumbnail preview"
                      className="h-16 w-16 rounded-md object-cover border"
                    />
                    <p className="text-xs text-muted-foreground">
                      Preview shown on the right. If image doesn’t load, check the URL.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Monetization</CardTitle>
                <CardDescription>Choose at least one to publish.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Enable pay‑per‑chat</Label>
                    <p className="text-xs text-muted-foreground mt-1">Charge for 24h access.</p>
                  </div>
                  <Switch
                    checked={form.enablePayPerChat}
                    onCheckedChange={(checked) => setForm({ ...form, enablePayPerChat: checked })}
                  />
                </div>

                {form.enablePayPerChat && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Pay‑per‑chat price (USD) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={centsToDollars(form.payPerChatPriceCents)}
                        onChange={(e) =>
                          setForm({ ...form, payPerChatPriceCents: dollarsToCents(e.target.value) })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Free preview messages</Label>
                      <Input
                        type="number"
                        min="0"
                        max="20"
                        value={String(form.freeMessageLimit)}
                        onChange={(e) =>
                          setForm({ ...form, freeMessageLimit: Math.max(0, Number(e.target.value || 0)) })
                        }
                        disabled={!form.enableFreeChat}
                      />
                      <p className="text-xs text-muted-foreground">
                        How many messages users can send before payment (if free preview is enabled).
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Enable subscriptions</Label>
                    <p className="text-xs text-muted-foreground mt-1">Monthly access for superfans.</p>
                  </div>
                  <Switch
                    checked={form.enableSubscriptions}
                    onCheckedChange={(checked) => setForm({ ...form, enableSubscriptions: checked })}
                  />
                </div>

                {form.enableSubscriptions && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Subscription price (USD/month) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={centsToDollars(form.subscriptionPriceCents)}
                        onChange={(e) =>
                          setForm({ ...form, subscriptionPriceCents: dollarsToCents(e.target.value) })
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-4 pt-2 border-t">
                  <div>
                    <Label>Enable free chat preview</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Let users try a few messages before paying.
                    </p>
                  </div>
                  <Switch
                    checked={form.enableFreeChat}
                    onCheckedChange={(checked) => setForm({ ...form, enableFreeChat: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="md:hidden">
              <Button onClick={save} disabled={saving} className="w-full">
                {saving ? 'Saving…' : form.isPublic ? 'Publish' : 'Save draft'}
              </Button>
            </div>
          </div>

          {/* RIGHT: Preview */}
          <div className="space-y-6">
            <Card className="glass sticky top-6">
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>How it roughly looks in the marketplace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-16 w-16 rounded-md border bg-bg-secondary overflow-hidden flex items-center justify-center">
                    {thumbOk ? (
                      <img
                        src={form.thumbnailUrl}
                        alt="Preview"
                        className="h-full w-full object-cover"
                        onError={(e) => ((e.currentTarget.style.display = 'none'))}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">No image</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{form.title.trim() || 'Your listing title'}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {form.shortPitch.trim() || 'Short pitch goes here…'}
                    </div>
                    {form.category ? (
                      <div className="text-xs mt-2">
                        <Badge variant="outline">{form.category}</Badge>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {form.enablePayPerChat && <Badge>Pay‑per‑chat</Badge>}
                  {form.enableSubscriptions && <Badge>Subscription</Badge>}
                  {form.enableFreeChat && <Badge variant="outline">Free preview</Badge>}
                  {!form.enablePayPerChat && !form.enableSubscriptions && (
                    <Badge variant="outline">No monetization selected</Badge>
                  )}
                </div>

                {tagsList.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tagsList.map((t) => (
                      <Badge key={t} variant="outline">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="pt-3 border-t text-xs text-muted-foreground">
                  Status: <strong>{form.isPublic ? 'Public' : 'Draft (private)'}</strong>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}