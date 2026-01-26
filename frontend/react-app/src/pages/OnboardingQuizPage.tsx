import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api';

export function OnboardingQuizPage() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);

  const [displayName, setDisplayName] = useState('');
  const [primaryUse, setPrimaryUse] = useState('');
  const [vibe, setVibe] = useState('casual');
  const [expertise, setExpertise] = useState('');
  const [audience, setAudience] = useState('');
  const [topics, setTopics] = useState('');
  const [avoid, setAvoid] = useState('');
  const [language, setLanguage] = useState('en');
  const [length, setLength] = useState('short');
  const [goal, setGoal] = useState('');

  const questions = [
    { label: "AI name", node: <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /> },
    { label: "What do you do?", node: <Input value={primaryUse} onChange={(e) => setPrimaryUse(e.target.value)} /> },
    { label: "Describe your vibe", node: <Input value={vibe} onChange={(e) => setVibe(e.target.value)} /> },
    { label: "Your expertise", node: <Input value={expertise} onChange={(e) => setExpertise(e.target.value)} /> },
    { label: "Who are you helping?", node: <Input value={audience} onChange={(e) => setAudience(e.target.value)} /> },
    { label: "Main topics", node: <Textarea value={topics} onChange={(e) => setTopics(e.target.value)} /> },
    { label: "Topics to avoid", node: <Textarea value={avoid} onChange={(e) => setAvoid(e.target.value)} /> },
    { label: "Primary language", node: <Input value={language} onChange={(e) => setLanguage(e.target.value)} /> },
    { label: "Response length", node: <Input value={length} onChange={(e) => setLength(e.target.value)} /> },
    { label: "Your goal", node: <Input value={goal} onChange={(e) => setGoal(e.target.value)} /> },
  ];

  const next = () => setStep((s) => Math.min(s + 1, questions.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    const identityJson = {
      displayName: displayName || 'My AI',
      primaryUse: primaryUse || 'creator',
      defaults: {
        language,
        formality: vibe,
        directness: 'balanced',
        emoji: 'minimal',
        length,
        ctaStyle: 'minimal',
      },
      hardRules: { always: [], never: [] },
      boundaries: { noTopics: avoid.split('\n').map(x => x.trim()).filter(Boolean), noCommitments: [] },
      decisionPolicy: { defaultAction: 'reply', ignoreIf: [], deferIf: [], riskTolerance: 'low' },
      styleAnchors: { signaturePhrases: [], greeting: '', closing: '' },
      settings: { autoReply: true },
      meta: { expertise, audience, topics: topics },
      goal,
    };

    await apiFetch('/api/identity', { method: 'POST', body: JSON.stringify({ identityJson }) });
    nav('/onboarding/content');
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Onboarding Quiz</CardTitle>
            <CardDescription>Step {step + 1} / {questions.length}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm font-medium">{questions[step].label}</div>
            {questions[step].node}

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={prev} disabled={step === 0}>Back</Button>
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