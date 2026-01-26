import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PrivacyPage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground mt-1">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>1. Information We Collect</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div>
              <h3 className="font-semibold text-foreground mb-2">Account Information</h3>
              <p>When you create an account, we collect:</p>
              <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                <li>Email address (required for authentication)</li>
                <li>Name and profile information (optional)</li>
                <li>Phone number (optional)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Identity Configuration</h3>
              <p>We store your communication identity settings, including:</p>
              <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                <li>Communication rules and boundaries</li>
                <li>Style preferences (formality, tone, etc.)</li>
                <li>Signature phrases and greeting/closing styles</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Usage Data</h3>
              <p>We collect information about how you use the service:</p>
              <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                <li>Mirror runs (incoming messages and generated replies) for quality improvement</li>
                <li>Feedback events ("This is me" / "Not me") to improve accuracy</li>
                <li>Technical data (IP address, browser type, device information)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>2. How We Use Your Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>We use your information to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Provide and improve our identity mirroring service</li>
              <li>Generate replies that match your communication style</li>
              <li>Analyze usage patterns to enhance accuracy</li>
              <li>Send important service updates (account-related only)</li>
              <li>Prevent fraud and ensure security</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>3. Data Storage and Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>We take data security seriously:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>All data is encrypted in transit (HTTPS) and at rest</li>
              <li>We use secure authentication methods (JWT tokens, OTP verification)</li>
              <li>Database access is restricted and monitored</li>
              <li>We regularly audit our security practices</li>
            </ul>
            <p className="mt-3">Your data is stored on secure servers and is not shared with third parties except as described in this policy.</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>4. Your Rights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>You have the right to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Access your personal data</li>
              <li>Update or correct your information</li>
              <li>Delete your account and all associated data</li>
              <li>Export your identity configuration</li>
              <li>Opt out of non-essential communications</li>
            </ul>
            <p className="mt-3">To exercise these rights, contact us at the email address provided in your account settings.</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>5. Data Retention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>We retain your data for as long as your account is active. When you delete your account:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>All personal information is permanently deleted within 30 days</li>
              <li>Mirror run history is anonymized (removed of personal identifiers)</li>
              <li>Aggregated analytics data may be retained for service improvement</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>6. Third-Party Services</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>We use the following third-party services:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>LLM Providers (Groq, OpenAI):</strong> To generate replies. Your messages are sent to these services but are not stored by them.</li>
              <li><strong>Email Service (Resend):</strong> To send authentication emails and notifications.</li>
              <li><strong>Payment Processor (Razorpay):</strong> To process subscription payments. Payment data is handled by Razorpay and subject to their privacy policy.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>7. Changes to This Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>We may update this privacy policy from time to time. We will notify you of any significant changes by:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Posting the updated policy on this page</li>
              <li>Sending an email notification (for material changes)</li>
              <li>Updating the "Last updated" date at the top of this page</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>8. Contact Us</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>If you have questions about this privacy policy or our data practices, please contact us:</p>
            <ul className="list-none space-y-1 ml-4">
              <li>Email: support@selflyx.com</li>
              <li>Through your account settings page</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
