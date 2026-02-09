import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, ArrowUp, Eye, CheckCircle2, Clock } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PublishPrerequisitesModal } from '@/components/PublishPrerequisitesModal';
import { TooltipIcon } from '@/components/ui/tooltip';

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
  const [showPrereqModal, setShowPrereqModal] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState<'not_started' | 'training' | 'ready'>('ready');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

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

    if (trainingStatus !== 'ready') missing.push('AI Training');

    return missing;
  }, [form, trainingStatus]);

  // Check training status on mount
  useEffect(() => {
    apiFetch<{ status: any }>('/api/identity/training-status')
      .then((data) => {
        setTrainingStatus(data.status || 'ready');
      })
      .catch(() => {
        setTrainingStatus('ready');
      });
  }, []);

  const save = async () => {
    if (isFreeTier && form.isPublic) {
      showToast('Upgrade to Starter plan to publish on marketplace', 'error');
      nav('/pricing');
      return;
    }

    // Client-side publish prereq (so UX doesn't feel random)
    if (form.isPublic && publishMissing.length > 0) {
      setShowPrereqModal(true);
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file', 'error');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size must be less than 5MB', 'error');
      return;
    }

    setImageFile(file);
    setUploadingImage(true);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('image', file);

      // Upload to backend (placeholder - needs backend implementation)
      const response = await apiFetch('/api/upload/image', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - browser will set it with boundary
        headers: undefined,
      });

      // Update thumbnail URL with uploaded image URL
      setForm({ ...form, thumbnailUrl: response.url });
      showToast('Image uploaded successfully!', 'success');
    } catch (error: any) {
      // Fallback to data URL for preview (until backend is ready)
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setForm({ ...form, thumbnailUrl: dataUrl });
        showToast('Image loaded as preview (upload endpoint not available)', 'info');
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingImage(false);
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

        {/* Publishing Prerequisites Progress Banner */}
        {!isFreeTier && publishMissing.length > 0 && (
          <Alert className="border-accent-primary/30 bg-accent-primary/5">
            <Clock className="h-4 w-4 text-accent-primary" />
            <AlertTitle className="text-sm font-semibold mb-2">
              Almost ready to publish! {publishMissing.length} step{publishMissing.length > 1 ? 's' : ''} remaining
            </AlertTitle>
            <AlertDescription>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="h-2 w-full bg-bg-tertiary rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-accent-primary transition-all duration-300"
                      style={{
                        width: `${Math.round(((8 - publishMissing.length) / 8) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-text-secondary">
                    Complete: {form.title.trim() ? '✓ Title' : ''} {form.thumbnailUrl.trim() ? '✓ Thumbnail' : ''}{' '}
                    {form.category ? '✓ Category' : ''} {form.description.trim() ? '✓ Description' : ''}
                  </p>
                </div>
                <Button onClick={() => setShowPrereqModal(true)} size="sm" variant="outline">
                  View Details
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {publishMissing.length === 0 && !isFreeTier && (
          <Alert className="border-green-500/30 bg-green-500/10">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription>
              <strong>Ready to publish!</strong> Your listing meets all requirements and can go live.
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
                  <Label className="flex items-center gap-1">
                    Title *
                    <TooltipIcon content="Give your AI a clear, descriptive name. This is the first thing users see in search results. Example: 'Marketing Expert AI' or 'Fitness Coach Sarah'." />
                  </Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g., Growth Mentor AI for SaaS Founders"
                  />
                  <p className="text-xs text-muted-foreground">Aim for 40–60 characters.</p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    Short pitch
                    <TooltipIcon content="A one-line hook that explains the value. This shows up in preview cards. Example: 'Get personalized workout plans and nutrition advice'." />
                  </Label>
                  <Input
                    value={form.shortPitch}
                    onChange={(e) => setForm({ ...form, shortPitch: e.target.value })}
                    placeholder="1 line: what can visitors achieve?"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    Category *
                    <TooltipIcon content="Choose the category that best fits your AI. This helps users discover you through category filters in the marketplace." />
                  </Label>
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
                  <Label className="flex items-center gap-1">
                    Description *
                    <TooltipIcon content="Explain what your AI does, who it's for, and what makes it special. Include example questions users can ask. This is your sales pitch!" />
                  </Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder={`What this AI helps with:\n- Who it's for\n- What it can do\n- What it can't do\n- Example questions`}
                    className="min-h-[140px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    Tags
                    <TooltipIcon content="Keywords that help users find your AI in search. Use 5-10 relevant tags. Example: marketing, copywriting, social media, content strategy." />
                  </Label>
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
                <CardTitle>Thumbnail Image *</CardTitle>
                <CardDescription>Square format (1:1 ratio) works best. Min 400×400px recommended.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* File Upload Option */}
                <div className="space-y-2">
                  <Label htmlFor="imageUpload">
                    Upload Image
                    <span className="text-xs text-muted-foreground ml-2">(Recommended)</span>
                  </Label>
                  <div className="flex items-center gap-3">
                    <input
                      id="imageUpload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('imageUpload')?.click()}
                      disabled={uploadingImage}
                      className="flex-1"
                    >
                      {uploadingImage ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-primary mr-2"></div>
                          Uploading...
                        </>
                      ) : imageFile ? (
                        <>✓ {imageFile.name}</>
                      ) : (
                        <>📤 Choose Image File</>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, or GIF • Max 5MB • Square images work best
                  </p>
                </div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                {/* URL Input Option */}
                <div className="space-y-2">
                  <Label htmlFor="thumbnailUrl">
                    Image URL
                    <span className="text-xs text-muted-foreground ml-2">(Alternative)</span>
                  </Label>
                  <Input
                    id="thumbnailUrl"
                    value={form.thumbnailUrl}
                    onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste a direct link to an image hosted elsewhere
                  </p>
                </div>

                {/* Image Preview */}
                {thumbOk && (
                  <div className="border rounded-lg p-4 bg-bg-secondary/30">
                    <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
                    <div className="flex items-start gap-4">
                      <img
                        src={form.thumbnailUrl}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            parent.innerHTML = '<div class="h-24 w-24 rounded-md border bg-red-500/10 flex items-center justify-center text-xs text-red-500">Failed to load</div>';
                          }
                        }}
                        alt="Thumbnail preview"
                        className="h-24 w-24 rounded-md object-cover border"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Looking good! ✓</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          This is how your thumbnail will appear in marketplace listings
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!thumbOk && (
                  <div className="border border-dashed rounded-lg p-4 bg-yellow-500/5">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      ⚠️ Thumbnail required to publish. Upload an image or paste an image URL.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass border-accent-primary/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Pricing & Monetization</CardTitle>
                    <CardDescription>Configured in Creator Setup</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => nav('/setup/pricing')}>
                    Edit Pricing →
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Display current settings as READ-ONLY */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Current Pricing Options</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {form.enablePayPerChat && (
                        <Badge className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30">
                          💰 Pay-per-chat: ${centsToDollars(form.payPerChatPriceCents)}
                        </Badge>
                      )}
                      {form.enableSubscriptions && (
                        <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30">
                          📅 Subscription: ${centsToDollars(form.subscriptionPriceCents)}/mo
                        </Badge>
                      )}
                      {form.enableFreeChat && (
                        <Badge variant="outline">
                          🎁 Free preview: {form.freeMessageLimit} {form.freeMessageLimit === 1 ? 'message' : 'messages'}
                        </Badge>
                      )}
                      {!form.enablePayPerChat && !form.enableSubscriptions && (
                        <Badge variant="outline" className="border-yellow-500/50 text-yellow-600">
                          ⚠️ No monetization enabled
                        </Badge>
                      )}
                    </div>
                  </div>

                  {(!form.enablePayPerChat && !form.enableSubscriptions) && (
                    <Alert className="border-yellow-500/30 bg-yellow-500/10">
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                      <AlertDescription>
                        <strong>Monetization required to publish.</strong> Go to{' '}
                        <button
                          onClick={() => nav('/setup/pricing')}
                          className="underline font-semibold hover:text-accent-primary"
                        >
                          Creator Setup
                        </button>{' '}
                        to enable Pay-per-chat or Subscriptions.
                      </AlertDescription>
                    </Alert>
                  )}

                  <Alert>
                    <AlertDescription className="text-xs">
                      💡 To change pricing, payment options, or free preview limits, visit the{' '}
                      <button
                        onClick={() => nav('/setup/pricing')}
                        className="underline font-semibold hover:text-accent-primary"
                      >
                        Creator Setup
                      </button>{' '}
                      page.
                    </AlertDescription>
                  </Alert>
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

        {/* Publish Prerequisites Modal */}
        <PublishPrerequisitesModal
          open={showPrereqModal}
          onClose={() => setShowPrereqModal(false)}
          prerequisites={[
            {
              id: 'title',
              label: 'Basic Info',
              status: form.title.trim() && form.category && form.description.trim() ? 'complete' : 'incomplete',
              description: 'Title, Description, and Category are required',
              action: {
                label: 'Add Info',
                onClick: () => {
                  setShowPrereqModal(false);
                  // Scroll to form
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                },
              },
            },
            {
              id: 'thumbnail',
              label: 'Thumbnail',
              status: form.thumbnailUrl.trim() ? 'complete' : 'incomplete',
              description: 'Profile image for your AI listing',
              action: {
                label: 'Add Thumbnail',
                onClick: () => {
                  setShowPrereqModal(false);
                  window.scrollTo({ top: 300, behavior: 'smooth' });
                },
              },
            },
            {
              id: 'monetization',
              label: 'Monetization',
              status:
                form.enableSubscriptions || form.enablePayPerChat ? 'complete' : 'incomplete',
              description: 'Enable at least one monetization option',
              action: {
                label: 'Set Pricing',
                onClick: () => {
                  setShowPrereqModal(false);
                  nav('/setup');
                },
              },
            },
            {
              id: 'training',
              label: 'AI Training',
              status: trainingStatus === 'ready' ? 'complete' : trainingStatus === 'training' ? 'in_progress' : 'incomplete',
              description:
                trainingStatus === 'ready'
                  ? 'Your AI is ready'
                  : trainingStatus === 'training'
                  ? 'Your AI is still being built. Est. 2-3 minutes remaining'
                  : 'Your AI needs to complete training',
              action:
                trainingStatus !== 'ready'
                  ? {
                      label: 'View Progress',
                      onClick: () => {
                        setShowPrereqModal(false);
                        nav('/dashboard');
                      },
                    }
                  : undefined,
            },
          ]}
        />
      </div>
    </Layout>
  );
}