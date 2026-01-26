import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';

export function CreatorDashboardPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    apiFetch('/api/creator/dashboard').then(setData).catch(() => setData(null));
  }, []);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="glass">
          <CardHeader><CardTitle>Creator Dashboard</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><div className="text-2xl font-bold">{data?.chats?.today ?? '-'}</div><div className="text-sm text-muted-foreground">Today</div></div>
            <div><div className="text-2xl font-bold">{data?.chats?.week ?? '-'}</div><div className="text-sm text-muted-foreground">Week</div></div>
            <div><div className="text-2xl font-bold">{data?.chats?.month ?? '-'}</div><div className="text-sm text-muted-foreground">Month</div></div>
            <div><div className="text-2xl font-bold">{data?.revenue?.thisMonthCents ?? '-'}</div><div className="text-sm text-muted-foreground">Revenue (cents)</div></div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}