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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border bg-card/40 p-4">
                <div className="text-xs text-muted-foreground">Runs</div>
                <div className="text-2xl font-semibold">{overview?.runs ?? 0}</div>
              </div>
              <div className="rounded-xl border bg-card/40 p-4">
                <div className="text-xs text-muted-foreground">Tokens</div>
                <div className="text-2xl font-semibold">{overview?.tokens ?? 0}</div>
              </div>
              <div className="rounded-xl border bg-card/40 p-4">
                <div className="text-xs text-muted-foreground">Trust yes</div>
                <div className="text-2xl font-semibold">{overview?.yes ?? 0}</div>
              </div>
              <div className="rounded-xl border bg-card/40 p-4">
                <div className="text-xs text-muted-foreground">Trust no</div>
                <div className="text-2xl font-semibold">{overview?.no ?? 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Runs</CardTitle>
            <CardDescription>Latest mirror runs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {runs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No runs found for this period.</div>
            ) : (
              runs.map((x: any) => (
                <div key={x.id} className="rounded-xl border bg-card/40 p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-xs text-muted-foreground">{new Date(x.createdAt).toLocaleString()}</div>
                    <div className="flex gap-2 flex-wrap">
                      {x.platform && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {x.platform}
                        </span>
                      )}
                      {x.decisionAction && (
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          x.decisionAction === 'reply' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                          x.decisionAction === 'ignore' ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' :
                          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                        }`}>
                          {x.decisionAction}
                        </span>
                      )}
                      {x.validatorStatus && (
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          x.validatorStatus === 'pass' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                          'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        }`}>
                          {x.validatorStatus === 'pass' ? '✓ Validated' : '⚠ Failed'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-medium">{x.context}</div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{x.incomingMessage}</div>
                  <div className="mt-2 text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{x.outputReply}</div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {x.model && <span>Model: {x.model}</span>}
                    {(x.tokensIn || x.tokensOut) && (
                      <span>Tokens: {(x.tokensIn || 0) + (x.tokensOut || 0)}</span>
                    )}
                    {x.confirmEvent && (
                      <span className={`${x.confirmEvent === 'confirm_yes' ? 'text-green-600' : 'text-red-600'}`}>
                        {x.confirmEvent === 'confirm_yes' ? '✓ Liked' : '✗ Disliked'}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}