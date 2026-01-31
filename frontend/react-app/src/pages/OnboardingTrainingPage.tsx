import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export function OnboardingTrainingPage() {
  const nav = useNavigate();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Processing documents...');
  const [documentsProcessed, setDocumentsProcessed] = useState(0);
  const [totalDocuments, setTotalDocuments] = useState(5);
  const [emailNotification, setEmailNotification] = useState(true);
  const [estimatedTime, setEstimatedTime] = useState(18); // hours

  // ✅ Prevent back navigation to profile page
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    // ✅ Poll for real training status from backend
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/identity/training-status', {
          credentials: 'include',
        });
        
        if (!res.ok) {
          console.error('Failed to fetch training status');
          return;
        }
        
        const data = await res.json();
        const newProgress = data.progress || 0;
        const newStatus = data.status || 'training';
        
        setProgress(newProgress);
        setStatus(data.message || 'Processing...');
        
        if (newStatus === 'ready') {
          clearInterval(pollInterval);
          // Auto-redirect after 2 seconds
          setTimeout(() => {
            nav('/onboarding/plan');
          }, 2000);
        } else if (newStatus === 'error') {
          clearInterval(pollInterval);
          setStatus('Training failed. Please try again.');
        }
      } catch (error) {
        console.error('Training status polling error:', error);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [nav]);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Your AI is Learning...</CardTitle>
            <CardDescription>
              We're training your AI clone based on your content and personality quiz
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{status}</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 flex items-center justify-end pr-2"
                  style={{ width: `${progress}%` }}
                >
                  {progress > 10 && (
                    <Loader2 className="h-3 w-3 text-primary-foreground animate-spin" />
                  )}
                </div>
              </div>
            </div>

            {/* Status Updates */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Processing {documentsProcessed} of {totalDocuments} documents</div>
                  <div className="text-xs text-muted-foreground">Extracting knowledge and patterns</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className={`h-2 w-2 rounded-full ${progress >= 30 ? 'bg-green-500' : 'bg-gray-300'}`} />
                <div className="flex-1">
                  <div className="text-sm font-medium">Analyzing writing style</div>
                  <div className="text-xs text-muted-foreground">Understanding your tone and voice</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className={`h-2 w-2 rounded-full ${progress >= 60 ? 'bg-green-500' : 'bg-gray-300'}`} />
                <div className="flex-1">
                  <div className="text-sm font-medium">Building personality profile</div>
                  <div className="text-xs text-muted-foreground">Creating your unique AI persona</div>
                </div>
              </div>
            </div>

            {/* Estimated Time */}
            <div className="text-center p-4 bg-primary/10 rounded-lg">
              <div className="text-2xl font-bold text-primary">Ready in ~{estimatedTime} hours</div>
              <div className="text-sm text-muted-foreground mt-1">
                We'll send you an email when your AI is ready
              </div>
            </div>

            {/* Email Notification */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="email-notification"
                checked={emailNotification}
                onCheckedChange={(checked) => setEmailNotification(checked as boolean)}
              />
              <Label htmlFor="email-notification" className="cursor-pointer">
                Send me an email when training is complete
              </Label>
            </div>

            {/* Meanwhile Actions */}
            <div className="pt-4 border-t space-y-3">
              <div className="text-sm font-medium">Meanwhile, you can:</div>
              <div className="grid gap-2">
                <Button variant="outline" onClick={() => nav('/integrations')}>
                  Setup Payment & Pricing
                </Button>
                <Button variant="outline" onClick={() => nav('/onboarding/deploy')}>
                  Prepare Deployment Links
                </Button>
                <Button variant="outline" onClick={() => nav('/knowledge')}>
                  Add More Content
                </Button>
              </div>
            </div>

            {/* Continue Button */}
            <Button className="w-full" onClick={() => nav('/dashboard')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}


