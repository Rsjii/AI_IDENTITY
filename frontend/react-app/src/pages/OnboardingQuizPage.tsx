import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { QuizQuestion } from '@/components/QuizQuestion';

export function OnboardingQuizPage() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);

  const [displayName, setDisplayName] = useState('');
  const [primaryUse, setPrimaryUse] = useState('');
  const [vibe, setVibe] = useState('');
  const [expertise, setExpertise] = useState<string[]>([]);
  const [audience, setAudience] = useState('');
  const [topics, setTopics] = useState('');
  const [avoid, setAvoid] = useState<string[]>([]);
  const [language, setLanguage] = useState('en');
  const [length, setLength] = useState(50);
  const [goal, setGoal] = useState<string[]>([]);

  const questions = [
    {
      label: "What should your AI be called?",
      type: 'text' as const,
      value: displayName,
      onChange: setDisplayName,
      placeholder: "e.g., John's Fitness AI",
      skipable: false,
    },
    {
      label: "What do you do?",
      type: 'select' as const,
      value: primaryUse,
      onChange: setPrimaryUse,
      options: ['Fitness coach', 'Tech creator', 'Business coach', 'Artist', 'Writer', 'Other'],
      skipable: false,
    },
    {
      label: "Describe your vibe",
      type: 'radio' as const,
      value: vibe,
      onChange: setVibe,
      options: ['Casual', 'Professional', 'Funny'],
      skipable: false,
    },
    {
      label: "Your expertise (add tags)",
      type: 'tags' as const,
      value: expertise,
      onChange: setExpertise,
      suggestions: ['#fitness', '#nutrition', '#gym', '#wellness', '#health'],
      skipable: true,
    },
    {
      label: "Who are you helping?",
      type: 'radio' as const,
      value: audience,
      onChange: setAudience,
      options: ['Beginners', 'Advanced', 'Everyone'],
      skipable: false,
    },
    {
      label: "Main topics you discuss",
      type: 'textarea' as const,
      value: topics,
      onChange: setTopics,
      placeholder: "List the main topics you want your AI to discuss...",
      skipable: false,
    },
    {
      label: "Topics to avoid",
      type: 'checkbox' as const,
      value: avoid,
      onChange: setAvoid,
      options: ['Politics', 'Religion', 'Competitors', 'Personal life'],
      skipable: true,
    },
    {
      label: "Primary language",
      type: 'select' as const,
      value: language,
      onChange: setLanguage,
      options: ['English', 'Hindi', 'Hinglish', 'Spanish', 'Other'],
      skipable: false,
    },
    {
      label: "Response length preference",
      type: 'slider' as const,
      value: length,
      onChange: setLength,
      skipable: false,
    },
    {
      label: "Your goal",
      type: 'multiselect' as const,
      value: goal,
      onChange: setGoal,
      options: ['Scale coaching', 'Monetize audience', 'Save time', 'Build community'],
      skipable: false,
    },
  ];

  const next = () => setStep((s) => Math.min(s + 1, questions.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    const identityJson = {
      displayName: displayName || 'My AI',
      primaryUse: primaryUse || 'creator',
      defaults: {
        language,
        formality: vibe || 'casual',
        directness: 'balanced',
        emoji: 'minimal',
        length: length < 33 ? 'short' : length < 66 ? 'medium' : 'detailed',
        ctaStyle: 'minimal',
      },
      hardRules: { always: [], never: [] },
      boundaries: {
        noTopics: avoid,
        noCommitments: [],
      },
      decisionPolicy: { defaultAction: 'reply', ignoreIf: [], deferIf: [], riskTolerance: 'low' },
      styleAnchors: { signaturePhrases: [], greeting: '', closing: '' },
      settings: { autoReply: true },
      meta: {
        expertise: expertise.join(', '),
        audience,
        topics: topics,
      },
      goal: goal.join(', '),
    };

    await apiFetch('/api/identity', { method: 'POST', body: JSON.stringify({ identityJson }) });
    nav('/onboarding/content');
  };

  const currentQuestion = questions[step];
  const progress = ((step + 1) / questions.length) * 100;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Step {step + 1} of {questions.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Create Your AI Clone</CardTitle>
            <CardDescription>
              Answer a few questions to personalize your AI's personality and behavior
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <QuizQuestion
              label={currentQuestion.label}
              type={currentQuestion.type}
              value={currentQuestion.value}
              onChange={currentQuestion.onChange}
              placeholder={currentQuestion.placeholder}
              options={currentQuestion.options}
              suggestions={currentQuestion.suggestions}
              skipable={currentQuestion.skipable}
              onSkip={next}
            />

            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={prev} disabled={step === 0}>
                Back
              </Button>
              {step < questions.length - 1 ? (
                <Button onClick={next}>Next</Button>
              ) : (
                <Button onClick={submit}>Continue</Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
