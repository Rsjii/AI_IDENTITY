import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function TermsPage() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-muted-foreground mt-1">MVP draft. Replace with your legal text.</p>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>- Don’t use for illegal or harmful content.</p>
            <p>- You are responsible for messages you send.</p>
            <p>- Service is provided “as is” during MVP.</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}