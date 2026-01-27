import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  Briefcase, Code, Palette, TrendingUp, Heart, GraduationCap, 
  DollarSign, Target, Sparkles
} from 'lucide-react';

// Question types based on spec
interface QuizAnswers {
  expertise: string;
  expertiseOther?: string; // For "Other" option
  communicationStyle: {
    casualVsProfessional: number;
    briefVsDetailed: number;
    directVsWarm: number;
  };
  targetAudience: string[];
  topics: string;
  avoidTopics: string;
  language: string;
  exampleQuestions: [string, string, string];
  responseLength: 'short' | 'medium' | 'long';
  emojiUsage: 'never' | 'rarely' | 'moderately' | 'frequently';
  personalityWords: [string, string, string];
}

const EXPERTISE_OPTIONS = [
  { id: 'business', label: 'Business & Entrepreneurship', icon: Briefcase, emoji: '💼' },
  { id: 'tech', label: 'Technology & Programming', icon: Code, emoji: '💻' },
  { id: 'creative', label: 'Creative Arts & Design', icon: Palette, emoji: '🎨' },
  { id: 'marketing', label: 'Marketing & Sales', icon: TrendingUp, emoji: '📈' },
  { id: 'health', label: 'Health & Wellness', icon: Heart, emoji: '🏥' },
  { id: 'education', label: 'Education & Teaching', icon: GraduationCap, emoji: '📚' },
  { id: 'finance', label: 'Finance & Investment', icon: DollarSign, emoji: '💰' },
  { id: 'personal', label: 'Personal Development', icon: Target, emoji: '🎯' },
  { id: 'other', label: 'Other', icon: Sparkles, emoji: '✏️' },
];

const AUDIENCE_OPTIONS = [
  'Beginners / Students',
  'Intermediate Practitioners',
  'Advanced Professionals',
  'Business Owners',
  'Developers / Engineers',
  'Creators / Artists',
  'General Public',
];

const LANGUAGE_OPTIONS = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
];

function loadQuizState() {
  const saved = localStorage.getItem('onboarding-quiz-answers');
  if (!saved) {
    return {
      lastStep: 0,
      answers: {
        communicationStyle: {
          casualVsProfessional: 50,
          briefVsDetailed: 50,
          directVsWarm: 50,
        },
        targetAudience: [],
        exampleQuestions: ['', '', ''],
        responseLength: 'medium',
        emojiUsage: 'moderately',
        personalityWords: ['', '', ''],
      },
    };
  }
  try {
    const parsed = JSON.parse(saved);
    return { lastStep: parsed.lastStep || 0, answers: parsed.answers || {} };
  } catch {
    return { lastStep: 0, answers: {} };
  }
}

export function OnboardingQuizPage() {
  const nav = useNavigate();
  const saved = loadQuizState();
  const [currentStep, setCurrentStep] = useState(saved.lastStep);
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>(saved.answers);

  const TOTAL_STEPS = 10;
  const progress = ((currentStep + 1) / TOTAL_STEPS) * 100;

  // Auto-save to localStorage
  useEffect(() => {
    localStorage.setItem('onboarding-quiz-answers', JSON.stringify({
      answers,
      lastStep: currentStep,
    }));
  }, [answers, currentStep]);

  const updateAnswer = <K extends keyof QuizAnswers>(key: K, value: QuizAnswers[K]) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const next = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep((prev: number) => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const prev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev: number) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    // Trigger confetti with multiple bursts
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    }, 250);

    // Convert answers to API format
    const expertiseValue = answers.expertise === 'other' ? (answers.expertiseOther || 'Other') : answers.expertise;
    const identityJson = {
      displayName: answers.personalityWords?.join(' ') || 'My AI',
      primaryUse: expertiseValue || 'creator',
      defaults: {
        language: answers.language || 'en',
        formality: (answers.communicationStyle?.casualVsProfessional ?? 50) < 50 ? 'casual' : 'professional',
        directness: (answers.communicationStyle?.directVsWarm ?? 50) < 50 ? 'direct' : 'warm',
        emoji: answers.emojiUsage || 'moderately',
        length: answers.responseLength || 'medium',
        ctaStyle: 'minimal',
      },
      hardRules: { always: [], never: [] },
      boundaries: {
        noTopics: answers.avoidTopics ? answers.avoidTopics.split(',').map(t => t.trim()) : [],
        noCommitments: [],
      },
      decisionPolicy: { defaultAction: 'reply', ignoreIf: [], deferIf: [], riskTolerance: 'low' },
      styleAnchors: { 
        signaturePhrases: [], 
        greeting: '', 
        closing: '',
        exampleQuestions: answers.exampleQuestions || [],
      },
      settings: { autoReply: true },
      meta: {
        expertise: answers.expertise || '',
        audience: answers.targetAudience?.join(', ') || '',
        topics: answers.topics || '',
        personalityWords: answers.personalityWords?.join(', ') || '',
      },
    };

    await apiFetch('/api/identity', { method: 'POST', body: JSON.stringify({ identityJson }) });
    localStorage.removeItem('onboarding-quiz-answers');
    nav('/onboarding/content');
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: 
        return !!answers.expertise && (answers.expertise !== 'other' || (answers.expertiseOther?.trim().length || 0) > 0);
      case 1: return true; // Sliders always have values
      case 2: return (answers.targetAudience?.length || 0) >= 1 && (answers.targetAudience?.length || 0) <= 3;
      case 3: return (answers.topics?.length || 0) >= 10 && (answers.topics?.length || 0) <= 200;
      case 4: return true; // Optional
      case 5: return !!answers.language;
      case 6: return answers.exampleQuestions?.every(q => q.length >= 10) || false;
      case 7: return !!answers.responseLength;
      case 8: return !!answers.emojiUsage;
      case 9: return answers.personalityWords?.every(w => w.length >= 3 && w.length <= 15) && 
                    new Set(answers.personalityWords).size === 3 || false;
      default: return false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg-primary flex items-center justify-center">
      {/* Full-screen modal */}
      <div className="w-full h-full flex flex-col">
        {/* Progress Bar - Top */}
        <div className="w-full px-6 pt-6 pb-4">
          <div className="max-w-4xl mx-auto space-y-2">
            <div className="flex justify-between text-sm text-text-secondary">
              <span>Question {currentStep + 1} of {TOTAL_STEPS}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 w-full bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-gradient transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question Content - Center */}
        <div className="flex-1 flex items-center justify-center px-6 py-8 overflow-hidden">
          <div className="max-w-4xl w-full">
            <div 
              key={currentStep}
              className="animate-slide-in-from-right-200"
            >
              {renderQuestion()}
            </div>
          </div>
        </div>

        {/* Navigation - Bottom */}
        <div className="w-full px-6 pb-6">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <Button
              variant="ghost"
              onClick={prev}
              disabled={currentStep === 0}
              className="text-text-secondary hover:text-text-primary"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={next}
              disabled={!canProceed()}
              className="bg-accent-gradient hover:opacity-90 text-white px-8"
            >
              {currentStep === TOTAL_STEPS - 1 ? 'Complete' : 'Next'}
              {currentStep < TOTAL_STEPS - 1 && <ArrowRight className="h-4 w-4 ml-2" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  function renderQuestion() {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary text-center" style={{ fontSize: '24px' }}>
              What's your primary expertise?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              {EXPERTISE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = answers.expertise === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => updateAnswer('expertise', opt.id)}
                    className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${
                      isSelected
                        ? 'border-accent-primary bg-accent-primary/10 transform scale-105 shadow-accent-glow'
                        : 'border-border-default bg-bg-secondary hover:border-accent-primary/50 hover:transform hover:scale-[1.02]'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{opt.emoji}</span>
                      <Icon className="h-5 w-5 text-accent-primary" />
                    </div>
                    <div className="text-text-primary font-semibold">{opt.label}</div>
                  </button>
                );
              })}
            </div>
            {answers.expertise === 'other' && (
              <div className="mt-4 max-w-md mx-auto">
                <input
                  type="text"
                  value={answers.expertiseOther || ''}
                  onChange={(e) => updateAnswer('expertiseOther', e.target.value)}
                  placeholder="Please specify your expertise..."
                  className="w-full p-3 rounded-lg bg-bg-secondary border border-accent-primary text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary"
                  autoFocus
                />
              </div>
            )}
          </div>
        );

      case 1:
        return (
          <div className="space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary text-center" style={{ fontSize: '24px' }}>
              How would you describe your communication style?
            </h2>
            <div className="space-y-6">
              {[
                { key: 'casualVsProfessional' as const, label: 'Casual & Fun', vs: 'Professional & Formal', left: '😊', right: '💼' },
                { key: 'briefVsDetailed' as const, label: 'Brief & Concise', vs: 'Detailed & Thorough', left: '⚡', right: '📚' },
                { key: 'directVsWarm' as const, label: 'Direct & Blunt', vs: 'Warm & Friendly', left: '🎯', right: '🤗' },
              ].map((slider) => {
                const value = answers.communicationStyle?.[slider.key] || 50;
                return (
                  <div key={slider.key} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{slider.left}</span>
                        <span className="text-text-secondary">{slider.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-text-secondary">{slider.vs}</span>
                        <span className="text-xl">{slider.right}</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={value}
                      onChange={(e) => {
                        const currentStyle = answers.communicationStyle || {
                          casualVsProfessional: 50,
                          briefVsDetailed: 50,
                          directVsWarm: 50,
                        };
                        const newStyle = { ...currentStyle };
                        newStyle[slider.key] = parseInt(e.target.value);
                        updateAnswer('communicationStyle', newStyle);
                      }}
                      className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-accent-primary"
                    />
                    <div className="text-center text-sm text-text-tertiary">
                      {value}% {value < 50 ? slider.label : slider.vs}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary text-center" style={{ fontSize: '24px' }}>
              Who is your target audience?
            </h2>
            <p className="text-text-secondary text-center">Select 1-3 options</p>
            <div className="flex flex-wrap gap-3 justify-center mt-8">
              {AUDIENCE_OPTIONS.map((audience) => {
                const isSelected = answers.targetAudience?.includes(audience) || false;
                return (
                  <button
                    key={audience}
                    onClick={() => {
                      const current = answers.targetAudience || [];
                      if (isSelected) {
                        updateAnswer('targetAudience', current.filter(a => a !== audience));
                      } else if (current.length < 3) {
                        updateAnswer('targetAudience', [...current, audience]);
                      }
                    }}
                    className={`px-4 py-2 rounded-full border-2 transition-all duration-200 ${
                      isSelected
                        ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                        : 'border-border-default bg-bg-secondary text-text-secondary hover:border-accent-primary/50'
                    }`}
                  >
                    {audience}
                  </button>
                );
              })}
            </div>
            {answers.targetAudience && answers.targetAudience.length > 0 && (
              <p className="text-center text-sm text-text-tertiary mt-4">
                {answers.targetAudience.length} selected
              </p>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary text-center" style={{ fontSize: '24px' }}>
              What topics do you primarily talk about?
            </h2>
            <textarea
              value={answers.topics || ''}
              onChange={(e) => updateAnswer('topics', e.target.value)}
              placeholder="E.g., React.js, startup funding, fitness routines..."
              className="w-full min-h-[120px] p-4 rounded-lg bg-bg-secondary border border-border-default text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
              maxLength={200}
            />
            <div className="flex justify-between text-sm text-text-tertiary">
              <span>Min 10 characters</span>
              <span>{(answers.topics?.length || 0)} / 200</span>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary text-center" style={{ fontSize: '24px' }}>
              Are there any topics you want to avoid?
            </h2>
            <p className="text-text-secondary text-center">(Optional)</p>
            <textarea
              value={answers.avoidTopics || ''}
              onChange={(e) => updateAnswer('avoidTopics', e.target.value)}
              placeholder="E.g., politics, controversial opinions..."
              className="w-full min-h-[100px] p-4 rounded-lg bg-bg-secondary border border-border-default text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
              maxLength={200}
            />
            <div className="text-right text-sm text-text-tertiary">
              {(answers.avoidTopics?.length || 0)} / 200
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6 max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary text-center" style={{ fontSize: '24px' }}>
              What languages do you communicate in?
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-8">
              {LANGUAGE_OPTIONS.map((lang) => {
                const isSelected = answers.language === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => updateAnswer('language', lang.code)}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                      isSelected
                        ? 'border-accent-primary bg-accent-primary/10'
                        : 'border-border-default bg-bg-secondary hover:border-accent-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{lang.flag}</span>
                      <span className="text-text-primary">{lang.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6 max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary text-center" style={{ fontSize: '24px' }}>
              Give 3 examples of questions your audience asks you
            </h2>
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="space-y-2">
                <label className="text-text-secondary">Example {idx + 1}</label>
                <input
                  type="text"
                  value={answers.exampleQuestions?.[idx] || ''}
                  onChange={(e) => {
                    const newQuestions = [...(answers.exampleQuestions || ['', '', ''])];
                    newQuestions[idx] = e.target.value;
                    updateAnswer('exampleQuestions', newQuestions as [string, string, string]);
                  }}
                  placeholder={`Example ${idx + 1}: How do I...`}
                  className="w-full p-3 rounded-lg bg-bg-secondary border border-border-default text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
                />
              </div>
            ))}
            <p className="text-sm text-text-tertiary text-center mt-4">
              Each question should be at least 10 characters
            </p>
          </div>
        );

      case 7:
        return (
          <div className="space-y-6 max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary text-center" style={{ fontSize: '24px' }}>
              Your ideal response length?
            </h2>
            <div className="flex flex-col md:flex-row gap-4 mt-8">
              {[
                { value: 'short' as const, label: 'Short', desc: '1-2 sentences - Twitter-style', emoji: '🔹' },
                { value: 'medium' as const, label: 'Medium', desc: '3-5 sentences - Email-style', emoji: '🔸' },
                { value: 'long' as const, label: 'Long', desc: 'Paragraph+ - Blog-style', emoji: '🔶' },
              ].map((opt) => {
                const isSelected = answers.responseLength === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => updateAnswer('responseLength', opt.value)}
                    className={`flex-1 p-6 rounded-xl border-2 transition-all duration-200 ${
                      isSelected
                        ? 'border-accent-primary bg-accent-primary/10 shadow-accent-glow'
                        : 'border-border-default bg-bg-secondary hover:border-accent-primary/50'
                    }`}
                  >
                    <div className="text-3xl mb-2">{opt.emoji}</div>
                    <div className="text-text-primary font-semibold text-lg mb-1">{opt.label}</div>
                    <div className="text-text-secondary text-sm">{opt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 8:
        return (
          <div className="space-y-6 max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary text-center" style={{ fontSize: '24px' }}>
              Should your AI use emojis?
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              {[
                { value: 'never' as const, label: 'Never', emoji: '🚫' },
                { value: 'rarely' as const, label: 'Rarely', desc: 'only for emphasis', emoji: '⭐' },
                { value: 'moderately' as const, label: 'Moderately', desc: 'natural use', emoji: '😊' },
                { value: 'frequently' as const, label: 'Frequently', desc: 'expressive', emoji: '🎉✨' },
              ].map((opt) => {
                const isSelected = answers.emojiUsage === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => updateAnswer('emojiUsage', opt.value)}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                      isSelected
                        ? 'border-accent-primary bg-accent-primary/10'
                        : 'border-border-default bg-bg-secondary hover:border-accent-primary/50'
                    }`}
                  >
                    <div className="text-2xl mb-2">{opt.emoji}</div>
                    <div className="text-text-primary font-semibold">{opt.label}</div>
                    {opt.desc && <div className="text-text-tertiary text-xs mt-1">{opt.desc}</div>}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 9:
        return (
          <div className="space-y-6 max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary text-center" style={{ fontSize: '24px' }}>
              Your AI's personality in 3 words
            </h2>
            <div className="flex gap-3 mt-8">
              {[0, 1, 2].map((idx) => (
                <input
                  key={idx}
                  type="text"
                  value={answers.personalityWords?.[idx] || ''}
                  onChange={(e) => {
                    const newWords = [...(answers.personalityWords || ['', '', ''])];
                    newWords[idx] = e.target.value;
                    updateAnswer('personalityWords', newWords as [string, string, string]);
                  }}
                  placeholder={idx === 0 ? 'Helpful' : idx === 1 ? 'Creative' : 'Honest'}
                  maxLength={15}
                  className="flex-1 p-3 rounded-lg bg-bg-secondary border border-border-default text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none text-center"
                />
              ))}
            </div>
            <p className="text-sm text-text-tertiary text-center">
              Each word: 3-15 characters, no duplicates
            </p>
          </div>
        );

      default:
        return null;
    }
  }
}
