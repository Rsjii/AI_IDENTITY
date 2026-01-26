import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function TermsPage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-muted-foreground mt-1">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>1. Acceptance of Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>By accessing or using Selflyx ("the Service"), you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may not access the Service.</p>
            <p>We reserve the right to update these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms.</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>2. Description of Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Selflyx is an identity mirroring service that helps you maintain consistent communication by:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Analyzing incoming messages based on your communication rules</li>
              <li>Generating reply suggestions that match your identity and style</li>
              <li>Providing tools to review and refine suggested replies</li>
            </ul>
            <p className="mt-3">The Service uses artificial intelligence to generate suggestions. You are responsible for reviewing and approving all replies before sending them.</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>3. User Responsibilities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>You agree to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>Review all suggestions:</strong> You must review and approve all generated replies before sending them. The Service provides suggestions only; you are responsible for all messages sent.</li>
              <li><strong>Use responsibly:</strong> Do not use the Service for illegal, harmful, or fraudulent purposes.</li>
              <li><strong>Maintain account security:</strong> Keep your account credentials secure and notify us immediately of any unauthorized access.</li>
              <li><strong>Provide accurate information:</strong> Ensure your identity configuration accurately represents your communication style.</li>
              <li><strong>Respect rate limits:</strong> Abide by the usage limits for your subscription tier.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>4. Prohibited Uses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>You may not use the Service to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Generate or send spam, harassment, or abusive content</li>
              <li>Impersonate others or misrepresent your identity</li>
              <li>Violate any laws or regulations</li>
              <li>Attempt to reverse engineer or compromise the Service</li>
              <li>Use automated tools to abuse rate limits</li>
              <li>Share your account credentials with others</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>5. Subscription and Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>
              <h3 className="font-semibold text-foreground mb-2">Free Tier</h3>
              <p>The free tier includes 10 mirror runs per month. No payment required.</p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Paid Subscriptions</h3>
              <p>Pro and Teams subscriptions are billed monthly. By subscribing, you agree to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                <li>Pay the subscription fee in advance for each billing period</li>
                <li>Automatic renewal unless cancelled before the billing date</li>
                <li>No refunds for partial billing periods</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Cancellation</h3>
              <p>You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period. You will retain access until the period ends.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>6. Intellectual Property</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>The Service and its original content, features, and functionality are owned by Selflyx and are protected by international copyright, trademark, and other intellectual property laws.</p>
            <p>You retain ownership of:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Your identity configuration and rules</li>
              <li>Messages you send</li>
              <li>Content you create using the Service</li>
            </ul>
            <p className="mt-3">By using the Service, you grant us a license to use your data as described in our Privacy Policy.</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>7. Disclaimer of Warranties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>The Service is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Accuracy or completeness of generated replies</li>
              <li>Uninterrupted or error-free operation</li>
              <li>Fitness for a particular purpose</li>
            </ul>
            <p className="mt-3">We do not guarantee that the Service will meet your requirements or that it will be available at all times.</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>8. Limitation of Liability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>To the maximum extent permitted by law, Selflyx shall not be liable for:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Any indirect, incidental, or consequential damages</li>
              <li>Loss of data, profits, or business opportunities</li>
              <li>Damages arising from your use or inability to use the Service</li>
            </ul>
            <p className="mt-3">Our total liability shall not exceed the amount you paid for the Service in the 12 months preceding the claim.</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>9. Indemnification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>You agree to indemnify and hold harmless Selflyx from any claims, damages, or expenses arising from:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Your use of the Service</li>
              <li>Messages you send using suggestions from the Service</li>
              <li>Violation of these Terms or any laws</li>
              <li>Infringement of any third-party rights</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>10. Termination</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>We may terminate or suspend your account immediately, without prior notice, for:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Violation of these Terms</li>
              <li>Fraudulent or illegal activity</li>
              <li>Abuse of the Service</li>
            </ul>
            <p className="mt-3">You may terminate your account at any time by deleting it through your account settings.</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>11. Governing Law</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>These Terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions.</p>
            <p>Any disputes arising from these Terms or the Service shall be subject to the exclusive jurisdiction of the courts in India.</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>12. Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>If you have questions about these Terms, please contact us:</p>
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
