import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type Range = 'today' | '7d' | '30d';

export function HistoryPage() {
  const [range, setRange] = useState<Range>('7d');
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setError('');
      try {
        const o = await apiFetch<any>(`/api/history/overview?range=${range}`);
        const r = await apiFetch<any>(`/api/history/runs?range=${range}&limit=50&offset=0`);
        setOverview(o?.data || null);
        setRuns(r?.rows || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load history.');
      }
    })();
  }, [range]);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">History</h1>
          <p className="text-muted-foreground mt-1">Your mirror runs and token usage.</p>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex gap-2">
          {(['today','7d','30d'] as Range[]).map((r) => (
            <Button key={r} size="sm" variant={range === r ? 'default' : 'outline'} onClick={() => setRange(r)}>
              {r}
            </Button>
          ))}
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>Summary for selected range.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto">{JSON.stringify(overview, null, 2)}</pre>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Runs</CardTitle>
            <CardDescription>Latest mirror runs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {runs.map((x: any) => (
              <div key={x.id} className="rounded-xl border bg-card/40 p-4">
                <div className="text-xs text-muted-foreground mb-2">{x.createdAt}</div>
                <div className="text-sm font-medium mb-1">{x.context}</div>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">{x.incomingMessage}</div>
                <div className="mt-3 text-sm whitespace-pre-wrap">{x.outputReply}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}