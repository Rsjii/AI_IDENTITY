import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';

interface ListingForm {
  isPublic: boolean;
  isFeatured: boolean;
  category: string;
  subscriptionPriceCents: number;
  currency: string;
  freeTrialQuestions: number;
  description: string;
  tags: string;
}

export function MarketplaceManagePage() {
  const [form, setForm] = useState<ListingForm>({
    isPublic: false,
    isFeatured: false,
    category: '',
    subscriptionPriceCents: 999,
    currency: 'USD',
    freeTrialQuestions: 0,
    description: '',
    tags: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/api/marketplace/my-listing')
      .then((data) => {
        if (data.item) {
          setForm({
            isPublic: data.item.isPublic ?? false,
            isFeatured: data.item.isFeatured ?? false,
            category: data.item.category || '',
            subscriptionPriceCents: data.item.subscriptionPriceCents || 999,
            currency: data.item.currency || 'USD',
            freeTrialQuestions: data.item.freeTrialQuestions || 0,
            description: data.item.description || '',
            tags: (data.item.tags || []).join(','),
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
          category: form.category,
          subscriptionPriceCents: form.subscriptionPriceCents,
          currency: form.currency,
          freeTrialQuestions: form.freeTrialQuestions,
          description: form.description,
          tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      });
      showToast('Listing saved', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save listing', 'error');
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

        {!form.isPublic && (
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
            />
            <span>Make listing public</span>
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
            placeholder="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <Input
            placeholder="Price (cents)"
            value={String(form.subscriptionPriceCents)}
            onChange={(e) => setForm({ ...form, subscriptionPriceCents: Number(e.target.value || 0) })}
          />
          <Input
            placeholder="Currency"
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          />
          <Input
            placeholder="Free trial questions"
            value={String(form.freeTrialQuestions)}
            onChange={(e) => setForm({ ...form, freeTrialQuestions: Number(e.target.value || 0) })}
          />
          <textarea
            className="w-full min-h-[120px] border rounded-md px-3 py-2 bg-background"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Input
            placeholder="Tags (comma separated)"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
          />
        </div>

        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Listing'}
        </Button>
      </div>
    </Layout>
  );
}

