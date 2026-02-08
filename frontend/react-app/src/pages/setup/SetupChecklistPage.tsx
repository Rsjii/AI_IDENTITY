import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Check, ChevronRight, DollarSign, CreditCard, Globe, Share2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export function SetupChecklistPage() {
  const navigate = useNavigate();
  const [setupStatus, setSetupStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const data = await apiFetch('/api/creator/setup/status');
      setSetupStatus(data);
    } catch (error) {
      console.error('Failed to fetch setup status', error);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      key: 'pricing',
      title: 'Set Your Pricing',
      description: 'How much visitors will pay',
      icon: DollarSign,
      route: '/setup/pricing',
    },
    {
      key: 'plan',
      title: 'Choose Platform Plan',
      description: 'Free trial or paid plan',
      icon: CreditCard,
      route: '/setup/plan',
    },
    {
      key: 'publish',
      title: 'Publish Your Listing',
      description: 'Make your AI discoverable on marketplace',
      icon: Globe,
      route: '/marketplace/manage',
    },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
        </div>
      </Layout>
    );
  }

  const completed = setupStatus?.setupCompleted || {};
  const completionPercentage = setupStatus?.completionPercentage || 0;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold gradient-text">Complete Your Setup 🎯</h1>
          <p className="text-lg text-muted-foreground">
            Complete these steps to start earning from your AI
          </p>
        </div>

        {/* Progress */}
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-semibold">Progress</span>
                <span className="text-muted-foreground">{completionPercentage}% complete</span>
              </div>
              <Progress value={completionPercentage} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step) => {
            const isComplete = completed[step.key] === true;
            const Icon = step.icon;

            return (
              <Card
                key={step.key}
                className={`glass cursor-pointer transition-all hover:scale-[1.02] ${
                  isComplete ? 'border-green-500/50 bg-green-500/5' : 'border-border-default'
                }`}
                onClick={() => navigate(step.route)}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-3 rounded-lg ${
                          isComplete
                            ? 'bg-green-500/20 text-green-500'
                            : 'bg-accent-primary/20 text-accent-primary'
                        }`}
                      >
                        {isComplete ? <Check className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
                      </div>
                      <div>
                        <CardTitle className="text-xl">{step.title}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-6 w-6 text-muted-foreground" />
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        {/* Optional Share Link */}
        <Card className="glass border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Share2 className="h-6 w-6 text-muted-foreground" />
              <div className="flex-1">
                <CardTitle className="text-lg">Share Your AI (Optional)</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Get your link and start sharing</p>
              </div>
              <Button variant="outline" onClick={() => navigate('/setup/share')}>
                Share →
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate('/dashboard')}
          >
            Skip for Now
          </Button>
          {completionPercentage === 100 ? (
            <Button
              className="flex-1 bg-gradient-to-r from-accent-primary to-accent-secondary"
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard →
            </Button>
          ) : (
            <Button
              className="flex-1 bg-gradient-to-r from-accent-primary to-accent-secondary"
              onClick={() => {
                const nextStep = steps.find((s) => !completed[s.key]);
                if (nextStep) navigate(nextStep.route);
              }}
            >
              Continue Setup →
            </Button>
          )}
        </div>
      </div>
    </Layout>
  );
}
