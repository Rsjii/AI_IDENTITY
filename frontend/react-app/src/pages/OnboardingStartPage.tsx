import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingGuard, usePreventBack } from '@/hooks/useOnboardingGuard';
import { Loader2, Sparkles, User, Tag, Target } from 'lucide-react';

const CATEGORY_OPTIONS = [
  { value: 'business', label: 'Business & Entrepreneurship', emoji: '💼' },
  { value: 'tech', label: 'Technology & Programming', emoji: '💻' },
  { value: 'creative', label: 'Creative Arts & Design', emoji: '🎨' },
  { value: 'marketing', label: 'Marketing & Sales', emoji: '📈' },
  { value: 'health', label: 'Health & Wellness', emoji: '🏥' },
  { value: 'education', label: 'Education & Teaching', emoji: '📚' },
  { value: 'finance', label: 'Finance & Investment', emoji: '💰' },
  { value: 'personal', label: 'Personal Development', emoji: '🎯' },
  { value: 'other', label: 'Other', emoji: '✨' },
];

export function OnboardingStartPage() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [purpose, setPurpose] = useState('');

  // Redirect to dashboard if onboarding is already complete
  useOnboardingGuard();

  // Prevent back navigation
  usePreventBack();

  const handleContinue = async () => {
    // Validation
    if (!name.trim()) {
      showToast('Please enter your name', 'error');
      return;
    }
    if (!category) {
      showToast('Please select a category', 'error');
      return;
    }
    if (!purpose.trim() || purpose.trim().length < 20) {
      showToast('Please describe your AI purpose (at least 20 characters)', 'error');
      return;
    }

    setLoading(true);
    try {
      // Save to identity
      await apiFetch('/api/identity/setup', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          category,
          purpose: purpose.trim(),
        }),
      });

      // Update onboarding step to 'upload'
      await apiFetch('/api/creator/onboarding/step', {
        method: 'POST',
        body: JSON.stringify({ step: 'upload' }),
      });

      await refresh();
      nav('/onboarding/upload', { replace: true });
    } catch (error: any) {
      showToast(error.message || 'Failed to save. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl glass">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-accent-primary/10 flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-accent-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">Welcome to AI Identity</CardTitle>
          <CardDescription className="text-base mt-2">
            Let's create your AI clone in 3 quick steps
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress indicator */}
          <div className="flex gap-2">
            {['Start', 'Upload', 'Preview', 'Complete'].map((step, i) => (
              <div
                key={step}
                className={`h-2 flex-1 rounded transition-colors ${
                  i === 0 ? 'bg-accent-primary' : 'bg-bg-tertiary'
                }`}
              />
            ))}
          </div>

          {/* Question 1: Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-base font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              What's your name?
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sarah Johnson"
              className="bg-bg-secondary border-border-default text-text-primary"
              maxLength={100}
            />
            <p className="text-xs text-text-tertiary">
              This is how your AI will introduce itself
            </p>
          </div>

          {/* Question 2: Category */}
          <div className="space-y-2">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Tag className="h-4 w-4" />
              What's your expertise category?
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setCategory(option.value)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    category === option.value
                      ? 'border-accent-primary bg-accent-primary/10'
                      : 'border-border-default bg-bg-secondary hover:border-accent-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{option.emoji}</span>
                    <span className="text-sm font-medium">{option.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Question 3: AI Purpose */}
          <div className="space-y-2">
            <Label htmlFor="purpose" className="text-base font-semibold flex items-center gap-2">
              <Target className="h-4 w-4" />
              What will your AI help people with?
            </Label>
            <Textarea
              id="purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g., I help entrepreneurs validate their business ideas, create go-to-market strategies, and navigate early-stage challenges..."
              className="min-h-[120px] bg-bg-secondary border-border-default text-text-primary resize-none"
              maxLength={500}
            />
            <div className="flex justify-between text-xs text-text-tertiary">
              <span>Describe your AI's purpose and expertise</span>
              <span>{purpose.length}/500</span>
            </div>
          </div>

          {/* Continue Button */}
          <Button
            onClick={handleContinue}
            disabled={loading || !name.trim() || !category || purpose.trim().length < 20}
            className="w-full bg-accent-gradient hover:opacity-90 text-white"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Continue to Upload'
            )}
          </Button>

          <p className="text-xs text-text-tertiary text-center">
            Step 1 of 4 - This takes less than 5 minutes
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
