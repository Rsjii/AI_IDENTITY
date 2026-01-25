import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export function IdentityEditPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [versionId, setVersionId] = useState<string>('');
  const [identityJsonText, setIdentityJsonText] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const me = await apiFetch<any>('/api/identity/me');
        const v = me?.identity?.activeVersion;
        if (!v?.id) {
          navigate('/identity/setup');
          return;
        }
        setVersionId(v.id);
        setIdentityJsonText(JSON.stringify(v.identityJson, null, 2));
      } catch (err: any) {
        setError(err.message || 'Failed to load identity.');
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const onSave = async () => {
    setSaving(true);
    setError('');
    try {
      const parsed = JSON.parse(identityJsonText);

      const res = await apiFetch<any>('/api/identity/version', {
        method: 'POST',
        body: JSON.stringify({ identityJson: parsed }),
      });

      // Update local versionId to new active version
      if (res?.activeVersionId) {
        setVersionId(res.activeVersionId);
      }
    } catch (err: any) {
      setError(err.message || 'Save failed (invalid JSON?).');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit identity</h1>
          <p className="text-muted-foreground mt-1">Fine-tune rules + style to make the mirror feel like you.</p>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Identity JSON</CardTitle>
            <CardDescription>For now editing raw JSON. Next we’ll make a clean UI editor.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Textarea
              className="min-h-[420px] font-mono text-xs"
              value={identityJsonText}
              onChange={(e) => setIdentityJsonText(e.target.value)}
              disabled={loading}
            />

            <div className="flex gap-3">
              <Button onClick={onSave} disabled={loading || saving || !versionId}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save'
                )}
              </Button>

              <Button variant="outline" onClick={() => navigate('/mirror')}>
                Go to mirror
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}