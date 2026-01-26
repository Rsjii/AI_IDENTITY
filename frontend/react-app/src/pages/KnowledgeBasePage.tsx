import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

export function KnowledgeBasePage() {
  const [items, setItems] = useState<any[]>([]);

  const refresh = async () => {
    const r = await apiFetch<{ items: any[] }>('/api/content/list');
    setItems(r.items || []);
  };

  useEffect(() => { refresh().catch(() => {}); }, []);

  const remove = async (id: string) => {
    await apiFetch(`/api/content/${id}`, { method: 'DELETE' });
    await refresh();
  };

  return (
    <Layout>
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
    </Layout>
  );
}