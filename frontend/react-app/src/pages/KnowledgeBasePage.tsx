import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { useRedirectBack } from '@/hooks/useOnboardingGuard';

export function KnowledgeBasePage({ embedded = false }: { embedded?: boolean }) {
  const location = useLocation();
  const [items, setItems] = useState<any[]>([]);

  // ✅ Clear history stack - replace current entry to prevent going back to onboarding
  useEffect(() => {
    // Replace current history entry so back button goes to dashboard
    if (location.key !== 'default') {
      window.history.replaceState(
        { from: 'knowledge' },
        '',
        window.location.pathname
      );
    }
  }, [location.key]);

  // ✅ Redirect back button to dashboard instead of allowing navigation to onboarding
  useRedirectBack('/dashboard');

  const refresh = async () => {
    const r = await apiFetch<{ items: any[] }>('/api/content/list');
    setItems(r.items || []);
  };

  useEffect(() => { refresh().catch(() => {}); }, []);

  const remove = async (id: string) => {
    await apiFetch(`/api/content/${id}`, { method: 'DELETE' });
    await refresh();
  };

  const content = (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card className="glass">
        <CardHeader><CardTitle>Knowledge Base</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.map((x) => (
            <div key={x.id} className="border rounded-md p-2 flex justify-between items-center">
              <div className="text-sm">{x.title || x.type}</div>
              <Button variant="outline" size="sm" onClick={() => remove(x.id)}>Delete</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  return embedded ? content : <Layout>{content}</Layout>;
}