import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PrivacyPage() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground mt-1">MVP draft. Replace with your legal text.</p>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>What we store</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>- Account info (email, username, profile fields)</p>
            <p>- Identity configuration (your rules/style JSON)</p>
            <p>- Mirror runs (incoming text + generated reply) for history & quality</p>
            <p>- Feedback events (“This is me / Not me”)</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}