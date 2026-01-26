import { useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';

export function OnboardingDeployPage() {
  const { state } = useAuth();
  const user: any = state.status === 'authenticated' ? state.user : null;

  const slug = user?.publicSlug || user?.handle || '';
  const standalone = useMemo(() => (slug ? `${window.location.origin}/chat/${slug}` : ''), [slug]);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Deploy</CardTitle>
            <CardDescription>Website widget is already available in Integrations. This page gives your share link.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm font-medium">Standalone link</div>
            <div className="flex gap-2">
              <Input value={standalone} readOnly />
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(standalone)} disabled={!standalone}>Copy</Button>
            </div>

            <div className="pt-2">
              <Button className="w-full" onClick={() => (window.location.href = '/integrations')}>Go to Integrations</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}