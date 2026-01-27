import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AlertCircle, Loader2, Info, AlertTriangle, CheckCircle2, X, MessageSquare, Zap } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Label } from '@/components/ui/label';

function toList(s: string): string[] {
  return s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}


export function IdentityEditPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testChatOpen, setTestChatOpen] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');

  // Core identity
  const [displayName, setDisplayName] = useState('');
  const [primaryUse, setPrimaryUse] = useState('');

  // Existing fields
  const [formality, setFormality] = useState('');
  const [directness, setDirectness] = useState('');
  const [emoji, setEmoji] = useState('');
  const [length, setLength] = useState('');
  const [alwaysText, setAlwaysText] = useState('');
  const [neverText, setNeverText] = useState('');
  const [noTopicsText, setNoTopicsText] = useState('');
  const [noCommitmentsText, setNoCommitmentsText] = useState('');
  const [ignoreIfText, setIgnoreIfText] = useState('');
  const [deferIfText, setDeferIfText] = useState('');
  const [signaturePhrasesText, setSignaturePhrasesText] = useState('');
  const [greeting, setGreeting] = useState('');
  const [closing, setClosing] = useState('');

  // NEW: Advanced Settings (2.1)
  const [responseStyle, setResponseStyle] = useState('balanced'); // concise, balanced, comprehensive
  const [toneFormality, setToneFormality] = useState(50); // 0-100
  const [toneEnthusiasm, setToneEnthusiasm] = useState(50);
  const [toneEmpathy, setToneEmpathy] = useState(50);
  const [toneHumor, setToneHumor] = useState(50);
  const [certaintyLevel, setCertaintyLevel] = useState('balanced'); // confident, balanced, cautious
  const [useExamples, setUseExamples] = useState(true);
  const [examplesCount, setExamplesCount] = useState(2);
  const [contextWindow, setContextWindow] = useState('medium'); // small, medium, large, max
  const [knowledgeFreshness, setKnowledgeFreshness] = useState('hybrid'); // static, hybrid, dynamic
  const [citationRequired, setCitationRequired] = useState(false);
  const [fallbackBehavior, setFallbackBehavior] = useState('dont-know'); // dont-know, research, best-guess, redirect

  // NEW: Safety & Boundaries (2.2)
  const [filterMedical, setFilterMedical] = useState(true);
  const [filterLegal, setFilterLegal] = useState(true);
  const [filterFinancial, setFilterFinancial] = useState(true);
  const [filterPolitical, setFilterPolitical] = useState(false);
  const [filterPersonalAttacks, setFilterPersonalAttacks] = useState(false);
  const [filterCompetitor, setFilterCompetitor] = useState(false);
  const [filterPricing, setFilterPricing] = useState(false);
  const [prohibitedTopics, setProhibitedTopics] = useState<string[]>([]);
  const [prohibitedTopicInput, setProhibitedTopicInput] = useState('');
  const [redirectMessage, setRedirectMessage] = useState('I focus on [your expertise]. Let me help with that instead!');

  // NEW: Power User Features (2.3)
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [formatBulletPoints, setFormatBulletPoints] = useState(true);
  const [formatNumberedSteps, setFormatNumberedSteps] = useState(true);
  const [formatBold, setFormatBold] = useState(true);
  const [formatCodeBlocks, setFormatCodeBlocks] = useState(true);
  const [formatEmojis, setFormatEmojis] = useState(true);
  const [ctaEnabled, setCtaEnabled] = useState(false);
  const [ctaMessage, setCtaMessage] = useState('');

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Auto-save function
  const handleAutoSave = useCallback(async () => {
    if (!validate()) return;
    try {
      const identityJson = buildIdentityJson();
      await apiFetch<any>('/api/identity/version', {
        method: 'POST',
        body: JSON.stringify({ identityJson }),
      });
      setLastSaved(new Date());
    } catch (err) {
      // Silent fail for auto-save
    }
  }, [validate, buildIdentityJson]);

  // Auto-save effect
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (!loading && displayName) {
        handleAutoSave();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [loading, displayName, handleAutoSave]);

  // Load identity data
  useEffect(() => {
    (async () => {
      try {
        const me = await apiFetch<any>('/api/identity/me');
        const v = me?.identity?.activeVersion;
        if (!v?.id) {
          navigate('/identity/setup');
          return;
        }

        const json = v.identityJson || {};

        // Populate existing fields
        setDisplayName(json.profile?.displayName || json.displayName || '');
        setPrimaryUse(json.profile?.primaryRole || json.primaryUse || '');

        const defaults = json.defaults || {};
        setFormality(defaults.formality || '');
        setDirectness(defaults.directness || '');
        setEmoji(defaults.emojiPolicy || defaults.emoji || '');
        setLength(defaults.lengthPolicy || defaults.length || '');

        const hardRules = json.hardRules || {};
        setAlwaysText((hardRules.always || []).join('\n'));
        setNeverText((hardRules.never || []).join('\n'));

        const boundaries = json.boundaries || {};
        setNoTopicsText((boundaries.noTopics || []).join('\n'));
        setNoCommitmentsText((boundaries.noCommitments || []).join('\n'));

        const decisionPolicy = json.decisionPolicy || {};
        setIgnoreIfText((decisionPolicy.ignoreIf || []).join('\n'));
        setDeferIfText((decisionPolicy.deferIf || []).join('\n'));

        const styleAnchors = json.styleAnchors || {};
        setSignaturePhrasesText((styleAnchors.signaturePhrases || []).join('\n'));
        setGreeting(styleAnchors.greeting || '');
        setClosing(styleAnchors.closing || '');

        // Load new advanced settings
        const advanced = json.advanced || {};
        setResponseStyle(advanced.responseStyle || 'balanced');
        setToneFormality(advanced.toneFormality ?? 50);
        setToneEnthusiasm(advanced.toneEnthusiasm ?? 50);
        setToneEmpathy(advanced.toneEmpathy ?? 50);
        setToneHumor(advanced.toneHumor ?? 50);
        setCertaintyLevel(advanced.certaintyLevel || 'balanced');
        setUseExamples(advanced.useExamples ?? true);
        setExamplesCount(advanced.examplesCount ?? 2);
        setContextWindow(advanced.contextWindow || 'medium');
        setKnowledgeFreshness(advanced.knowledgeFreshness || 'hybrid');
        setCitationRequired(advanced.citationRequired ?? false);
        setFallbackBehavior(advanced.fallbackBehavior || 'dont-know');

        // Load safety settings
        const safety = json.safety || {};
        setFilterMedical(safety.filterMedical ?? true);
        setFilterLegal(safety.filterLegal ?? true);
        setFilterFinancial(safety.filterFinancial ?? true);
        setFilterPolitical(safety.filterPolitical ?? false);
        setFilterPersonalAttacks(safety.filterPersonalAttacks ?? false);
        setFilterCompetitor(safety.filterCompetitor ?? false);
        setFilterPricing(safety.filterPricing ?? false);
        setProhibitedTopics(safety.prohibitedTopics || []);
        setRedirectMessage(safety.redirectMessage || 'I focus on [your expertise]. Let me help with that instead!');

        // Load power user settings
        const power = json.power || {};
        setCustomSystemPrompt(power.customSystemPrompt || '');
        setTemperature(power.temperature ?? 0.7);
        setFormatBulletPoints(power.formatBulletPoints ?? true);
        setFormatNumberedSteps(power.formatNumberedSteps ?? true);
        setFormatBold(power.formatBold ?? true);
        setFormatCodeBlocks(power.formatCodeBlocks ?? true);
        setFormatEmojis(power.formatEmojis ?? true);
        setCtaEnabled(power.ctaEnabled ?? false);
        setCtaMessage(power.ctaMessage || '');
      } catch (err: any) {
        setError(err.message || 'Failed to load identity.');
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  // Generate system prompt preview
  const systemPromptPreview = useMemo(() => {
    const formalityLabel = toneFormality < 33 ? 'Casual' : toneFormality < 67 ? 'Semi-formal' : 'Professional';
    const enthusiasmLabel = toneEnthusiasm < 33 ? 'Reserved' : toneEnthusiasm < 67 ? 'Moderate' : 'Energetic';
    const empathyLabel = toneEmpathy < 33 ? 'Objective' : toneEmpathy < 67 ? 'Balanced' : 'Compassionate';
    const humorLabel = toneHumor < 33 ? 'Serious' : toneHumor < 67 ? 'Moderate' : 'Playful';

    if (customSystemPrompt) {
      return customSystemPrompt;
    }

    let prompt = `You are ${displayName || '[Your Name]'}, a ${primaryUse || '[expertise]'} expert.\n\n`;
    prompt += `## YOUR CORE IDENTITY\n`;
    prompt += `- Expertise: ${primaryUse || '[your expertise]'}\n`;
    prompt += `- Communication style: ${formality || 'balanced'}\n`;
    prompt += `- Response style: ${responseStyle}\n`;
    prompt += `- Response length: ${length || 'medium'}\n\n`;

    prompt += `## YOUR VOICE\n`;
    prompt += `- Tone: ${formalityLabel} (${toneFormality}/100 formality)\n`;
    prompt += `- Enthusiasm: ${enthusiasmLabel} (${toneEnthusiasm}/100)\n`;
    prompt += `- Empathy: ${empathyLabel} (${toneEmpathy}/100)\n`;
    prompt += `- Humor: ${humorLabel} (${toneHumor}/100)\n`;
    prompt += `- Certainty: ${certaintyLevel}\n`;
    if (useExamples) {
      prompt += `- Use ${examplesCount} practical examples per answer\n`;
    }
    prompt += `- Emoji usage: ${emoji || 'moderate'}\n\n`;

    prompt += `## KNOWLEDGE & CONTEXT\n`;
    prompt += `- Context window: ${contextWindow}\n`;
    prompt += `- Knowledge freshness: ${knowledgeFreshness}\n`;
    if (citationRequired) {
      prompt += `- Citations required: Yes\n`;
    }
    prompt += `- Fallback behavior: ${fallbackBehavior}\n\n`;

    if (prohibitedTopics.length > 0) {
      prompt += `## TOPICS TO AVOID\n`;
      prohibitedTopics.forEach(topic => {
        prompt += `- ${topic}\n`;
      });
      prompt += `If asked about these, say: "${redirectMessage}"\n\n`;
    }

    if (alwaysText) {
      prompt += `## ALWAYS DO\n${toList(alwaysText).map(r => `- ${r}`).join('\n')}\n\n`;
    }

    if (neverText) {
      prompt += `## NEVER DO\n${toList(neverText).map(r => `- ${r}`).join('\n')}\n\n`;
    }

    return prompt;
  }, [
    displayName, primaryUse, formality, responseStyle, length,
    toneFormality, toneEnthusiasm, toneEmpathy, toneHumor,
    certaintyLevel, useExamples, examplesCount, emoji,
    contextWindow, knowledgeFreshness, citationRequired, fallbackBehavior,
    prohibitedTopics, redirectMessage, alwaysText, neverText, customSystemPrompt
  ]);

  // Calculate prompt quality score
  const promptQualityScore = useMemo(() => {
    let score = 0;
    if (displayName) score += 10;
    if (primaryUse) score += 10;
    if (formality) score += 5;
    if (responseStyle) score += 5;
    if (alwaysText) score += 10;
    if (neverText) score += 10;
    if (prohibitedTopics.length > 0) score += 10;
    if (customSystemPrompt && customSystemPrompt.length > 50) score += 20;
    if (toneFormality !== 50 || toneEnthusiasm !== 50 || toneEmpathy !== 50 || toneHumor !== 50) score += 10;
    return Math.min(100, score);
  }, [displayName, primaryUse, formality, responseStyle, alwaysText, neverText, prohibitedTopics, customSystemPrompt, toneFormality, toneEnthusiasm, toneEmpathy, toneHumor]);

  // Estimate cost per 1K queries
  const estimatedCost = useMemo(() => {
    const baseCost = 0.01; // $0.01 per 1K queries base
    const contextMultiplier = {
      small: 1,
      medium: 1.5,
      large: 2.5,
      max: 4
    }[contextWindow] || 1.5;
    return (baseCost * contextMultiplier).toFixed(2);
  }, [contextWindow]);

  // Validation
  const validate = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!displayName.trim()) {
      errors.displayName = 'Display name is required';
    }
    if (customSystemPrompt && customSystemPrompt.length < 50) {
      errors.customSystemPrompt = 'Custom prompt must be at least 50 characters';
    }
    if (customSystemPrompt && customSystemPrompt.length > 2000) {
      errors.customSystemPrompt = 'Custom prompt must be less than 2000 characters';
    }
    if (ctaEnabled && ctaMessage.length > 150) {
      errors.ctaMessage = 'CTA message must be less than 150 characters';
    }
    if (prohibitedTopics.length > 20) {
      errors.prohibitedTopics = 'Maximum 20 prohibited topics allowed';
    }
    if (redirectMessage.length > 200) {
      errors.redirectMessage = 'Redirect message must be less than 200 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [displayName, customSystemPrompt, ctaEnabled, ctaMessage, prohibitedTopics, redirectMessage]);

  // Build identity JSON
  const buildIdentityJson = useCallback(() => {
    return {
      profile: {
        displayName,
        primaryRole: primaryUse,
        language: 'english',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      defaults: {
        language: 'en',
        formality,
        directness,
        emojiPolicy: emoji,
        lengthPolicy: length,
        ctaStyle: 'direct',
      },
      hardRules: {
        always: toList(alwaysText),
        never: toList(neverText),
      },
      boundaries: {
        noTopics: toList(noTopicsText),
        noCommitments: toList(noCommitmentsText),
      },
      decisionPolicy: {
        defaultAction: 'reply',
        ignoreIf: toList(ignoreIfText),
        deferIf: toList(deferIfText),
        riskTolerance: 'conservative',
      },
      styleAnchors: {
        signaturePhrases: toList(signaturePhrasesText),
        greeting,
        closing,
      },
      advanced: {
        responseStyle,
        toneFormality,
        toneEnthusiasm,
        toneEmpathy,
        toneHumor,
        certaintyLevel,
        useExamples,
        examplesCount,
        contextWindow,
        knowledgeFreshness,
        citationRequired,
        fallbackBehavior,
      },
      safety: {
        filterMedical,
        filterLegal,
        filterFinancial,
        filterPolitical,
        filterPersonalAttacks,
        filterCompetitor,
        filterPricing,
        prohibitedTopics,
        redirectMessage,
      },
      power: {
        customSystemPrompt,
        temperature,
        formatBulletPoints,
        formatNumberedSteps,
        formatBold,
        formatCodeBlocks,
        formatEmojis,
        ctaEnabled,
        ctaMessage,
      },
    };
  }, [
    displayName, primaryUse, formality, directness, emoji, length,
    alwaysText, neverText, noTopicsText, noCommitmentsText,
    ignoreIfText, deferIfText, signaturePhrasesText, greeting, closing,
    responseStyle, toneFormality, toneEnthusiasm, toneEmpathy, toneHumor,
    certaintyLevel, useExamples, examplesCount, contextWindow, knowledgeFreshness,
    citationRequired, fallbackBehavior, filterMedical, filterLegal, filterFinancial,
    filterPolitical, filterPersonalAttacks, filterCompetitor, filterPricing,
    prohibitedTopics, redirectMessage, customSystemPrompt, temperature,
    formatBulletPoints, formatNumberedSteps, formatBold, formatCodeBlocks,
    formatEmojis, ctaEnabled, ctaMessage
  ]);


  const onSave = async () => {
    if (!validate()) {
      setError('Please fix validation errors before saving.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const identityJson = buildIdentityJson();
      await apiFetch<any>('/api/identity/version', {
        method: 'POST',
        body: JSON.stringify({ identityJson }),
      });

      setLastSaved(new Date());
      navigate('/mirror');
    } catch (err: any) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestAI = async () => {
    if (!testMessage.trim()) return;
    setTestResponse('Testing...');
    try {
      // This would call a test endpoint
      // For now, just show a placeholder
      setTestResponse('This feature will call the AI with current settings to generate a test response.');
    } catch (err: any) {
      setTestResponse('Error: ' + err.message);
    }
  };

  const addProhibitedTopic = () => {
    if (prohibitedTopicInput.trim() && prohibitedTopics.length < 20) {
      setProhibitedTopics([...prohibitedTopics, prohibitedTopicInput.trim()]);
      setProhibitedTopicInput('');
    }
  };

  const removeProhibitedTopic = (index: number) => {
    setProhibitedTopics(prohibitedTopics.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Loading identity…</CardTitle>
              <CardDescription>Please wait</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Edit AI Personality</h1>
            <p className="text-muted-foreground mt-1">Fine-tune your AI's behavior, voice, and knowledge boundaries</p>
          </div>
          <div className="flex items-center gap-4">
            {lastSaved && (
              <span className="text-sm text-muted-foreground">
                Last saved {Math.floor((Date.now() - lastSaved.getTime()) / 60000)} mins ago
              </span>
            )}
            <Button variant="outline" onClick={() => setShowAdvanced(!showAdvanced)}>
              {showAdvanced ? 'Hide' : 'Show'} Advanced
            </Button>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - 70% */}
          <div className="lg:col-span-2 space-y-6">
            <Accordion type="multiple" defaultValue={['core', 'response', 'safety']}>
              {/* Core Identity */}
              <AccordionItem value="core">
                <AccordionTrigger value="core">
                  <CardTitle className="text-lg">Core Identity</CardTitle>
                </AccordionTrigger>
                <AccordionContent value="core">
                  <Card className="border-0 shadow-none">
                    <CardContent className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="displayName">Display Name *</Label>
                        <Input
                          id="displayName"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Your name"
                          className={validationErrors.displayName ? 'border-error' : ''}
                        />
                        {validationErrors.displayName && (
                          <p className="text-sm text-error">{validationErrors.displayName}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="primaryUse">Primary Use / Role</Label>
                        <Input
                          id="primaryUse"
                          value={primaryUse}
                          onChange={(e) => setPrimaryUse(e.target.value)}
                          placeholder="founder, manager, consultant, etc."
                        />
                      </div>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>

              {/* Response Behavior */}
              <AccordionItem value="response">
                <AccordionTrigger value="response">
                  <CardTitle className="text-lg">Response Behavior</CardTitle>
                </AccordionTrigger>
                <AccordionContent value="response">
                  <Card className="border-0 shadow-none">
                    <CardContent className="space-y-6 pt-4">
                      <div className="space-y-2">
                        <Label>Response Style</Label>
                        <SegmentedControl
                          value={responseStyle}
                          onValueChange={setResponseStyle}
                          options={[
                            { value: 'concise', label: '🎯 Concise', icon: '🎯' },
                            { value: 'balanced', label: '⚖️ Balanced', icon: '⚖️' },
                            { value: 'comprehensive', label: '📚 Comprehensive', icon: '📚' },
                          ]}
                        />
                        <p className="text-xs text-muted-foreground">Controls verbosity in responses</p>
                      </div>

                      <div className="space-y-4">
                        <Label>Tone of Voice</Label>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Casual</span>
                              <span>{toneFormality}</span>
                              <span>Professional</span>
                            </div>
                            <Slider
                              value={[toneFormality]}
                              onValueChange={(v) => setToneFormality(v[0])}
                              min={0}
                              max={100}
                              step={1}
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Reserved</span>
                              <span>{toneEnthusiasm}</span>
                              <span>Energetic</span>
                            </div>
                            <Slider
                              value={[toneEnthusiasm]}
                              onValueChange={(v) => setToneEnthusiasm(v[0])}
                              min={0}
                              max={100}
                              step={1}
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Objective</span>
                              <span>{toneEmpathy}</span>
                              <span>Compassionate</span>
                            </div>
                            <Slider
                              value={[toneEmpathy]}
                              onValueChange={(v) => setToneEmpathy(v[0])}
                              min={0}
                              max={100}
                              step={1}
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Serious</span>
                              <span>{toneHumor}</span>
                              <span>Playful</span>
                            </div>
                            <Slider
                              value={[toneHumor]}
                              onValueChange={(v) => setToneHumor(v[0])}
                              min={0}
                              max={100}
                              step={1}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Certainty Level</Label>
                        <RadioGroup value={certaintyLevel} onValueChange={setCertaintyLevel}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="confident" id="certainty-confident" />
                            <Label htmlFor="certainty-confident" className="font-normal cursor-pointer">
                              Always confident (never say "I think")
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="balanced" id="certainty-balanced" />
                            <Label htmlFor="certainty-balanced" className="font-normal cursor-pointer">
                              Balanced (show uncertainty when appropriate)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="cautious" id="certainty-cautious" />
                            <Label htmlFor="certainty-cautious" className="font-normal cursor-pointer">
                              Cautious (hedge when unsure)
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Use of Examples</Label>
                          <Switch checked={useExamples} onCheckedChange={setUseExamples} />
                        </div>
                        {useExamples && (
                          <div className="mt-2">
                            <Label>How many examples per answer? (1-5)</Label>
                            <Input
                              type="number"
                              min={1}
                              max={5}
                              value={examplesCount}
                              onChange={(e) => setExamplesCount(Math.max(1, Math.min(5, parseInt(e.target.value) || 2)))}
                              className="w-24"
                            />
                          </div>
                        )}
                      </div>

                      {showAdvanced && (
                        <>
                          <div className="space-y-2">
                            <Label>Context Window Preference</Label>
                            <Select value={contextWindow} onValueChange={setContextWindow}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="small">Small (2K tokens) - Fast, simple questions</SelectItem>
                                <SelectItem value="medium">Medium (4K tokens) - Standard conversations</SelectItem>
                                <SelectItem value="large">Large (8K tokens) - Complex discussions</SelectItem>
                                <SelectItem value="max">Max (16K tokens) - Research-level depth</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Estimated cost: ${estimatedCost} per 1K queries</p>
                          </div>

                          <div className="space-y-2">
                            <Label>Knowledge Freshness</Label>
                            <SegmentedControl
                              value={knowledgeFreshness}
                              onValueChange={setKnowledgeFreshness}
                              options={[
                                { value: 'static', label: 'Static' },
                                { value: 'hybrid', label: 'Hybrid' },
                                { value: 'dynamic', label: 'Dynamic' },
                              ]}
                            />
                            {knowledgeFreshness === 'dynamic' && (
                              <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>
                                  Dynamic mode may generate info not in your content
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Citation Requirement</Label>
                              <p className="text-xs text-muted-foreground">AI includes source citations</p>
                            </div>
                            <Switch checked={citationRequired} onCheckedChange={setCitationRequired} />
                          </div>

                          <div className="space-y-2">
                            <Label>Fallback Behavior</Label>
                            <RadioGroup value={fallbackBehavior} onValueChange={setFallbackBehavior}>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="dont-know" id="fallback-dont-know" />
                                <Label htmlFor="fallback-dont-know" className="font-normal cursor-pointer">
                                  Say "I don't know" directly
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="research" id="fallback-research" />
                                <Label htmlFor="fallback-research" className="font-normal cursor-pointer">
                                  Offer to research and follow up
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="best-guess" id="fallback-best-guess" />
                                <Label htmlFor="fallback-best-guess" className="font-normal cursor-pointer">
                                  Provide best guess with disclaimer
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="redirect" id="fallback-redirect" />
                                <Label htmlFor="fallback-redirect" className="font-normal cursor-pointer">
                                  Redirect to related topics I do know
                                </Label>
                              </div>
                            </RadioGroup>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>

              {/* Safety & Boundaries */}
              <AccordionItem value="safety">
                <AccordionTrigger value="safety">
                  <CardTitle className="text-lg">Safety & Boundaries</CardTitle>
                </AccordionTrigger>
                <AccordionContent value="safety">
                  <Card className="border-0 shadow-none">
                    <CardContent className="space-y-6 pt-4">
                      <div className="space-y-4">
                        <Label>Content Filters</Label>
                        <p className="text-xs text-muted-foreground">What AI should refuse to discuss</p>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="filter-medical" className="font-normal cursor-pointer">
                              Medical advice
                            </Label>
                            <Switch id="filter-medical" checked={filterMedical} onCheckedChange={setFilterMedical} />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="filter-legal" className="font-normal cursor-pointer">
                              Legal advice
                            </Label>
                            <Switch id="filter-legal" checked={filterLegal} onCheckedChange={setFilterLegal} />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="filter-financial" className="font-normal cursor-pointer">
                              Financial advice
                            </Label>
                            <Switch id="filter-financial" checked={filterFinancial} onCheckedChange={setFilterFinancial} />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="filter-political" className="font-normal cursor-pointer">
                              Political opinions
                            </Label>
                            <Switch id="filter-political" checked={filterPolitical} onCheckedChange={setFilterPolitical} />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="filter-attacks" className="font-normal cursor-pointer">
                              Personal attacks
                            </Label>
                            <Switch id="filter-attacks" checked={filterPersonalAttacks} onCheckedChange={setFilterPersonalAttacks} />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="filter-competitor" className="font-normal cursor-pointer">
                              Competitor mentions
                            </Label>
                            <Switch id="filter-competitor" checked={filterCompetitor} onCheckedChange={setFilterCompetitor} />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="filter-pricing" className="font-normal cursor-pointer">
                              Pricing/discount negotiations
                            </Label>
                            <Switch id="filter-pricing" checked={filterPricing} onCheckedChange={setFilterPricing} />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Prohibited Topics (Custom)</Label>
                        <p className="text-xs text-muted-foreground">Max 20 topics, 50 chars each</p>
                        <div className="flex gap-2">
                          <Input
                            value={prohibitedTopicInput}
                            onChange={(e) => setProhibitedTopicInput(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addProhibitedTopic();
                              }
                            }}
                            placeholder="Type topic and press Enter"
                            maxLength={50}
                            disabled={prohibitedTopics.length >= 20}
                          />
                          <Button onClick={addProhibitedTopic} disabled={prohibitedTopics.length >= 20 || !prohibitedTopicInput.trim()}>
                            Add
                          </Button>
                        </div>
                        {validationErrors.prohibitedTopics && (
                          <p className="text-sm text-error">{validationErrors.prohibitedTopics}</p>
                        )}
                        {prohibitedTopics.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {prohibitedTopics.map((topic, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-1 px-3 py-1 bg-bg-secondary rounded-full text-sm"
                              >
                                <span>{topic}</span>
                                <button
                                  onClick={() => removeProhibitedTopic(index)}
                                  className="ml-1 hover:text-error"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Redirect Message</Label>
                        <Textarea
                          value={redirectMessage}
                          onChange={(e) => setRedirectMessage(e.target.value)}
                          placeholder="I focus on [your expertise]. Let me help with that instead!"
                          maxLength={200}
                          className={validationErrors.redirectMessage ? 'border-error' : ''}
                        />
                        <p className="text-xs text-muted-foreground">
                          Message shown when user asks about prohibited topics
                        </p>
                        {validationErrors.redirectMessage && (
                          <p className="text-sm text-error">{validationErrors.redirectMessage}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>

              {/* Power User Features */}
              {showAdvanced && (
                <AccordionItem value="power">
                  <AccordionTrigger value="power">
                    <CardTitle className="text-lg">Power User Features</CardTitle>
                  </AccordionTrigger>
                  <AccordionContent value="power">
                    <Card className="border-0 shadow-none">
                      <CardContent className="space-y-6 pt-4">
                        <div className="space-y-2">
                          <Label>Custom System Prompt</Label>
                          <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              Advanced users only. Bad prompts = bad AI.
                            </AlertDescription>
                          </Alert>
                          <Textarea
                            value={customSystemPrompt}
                            onChange={(e) => setCustomSystemPrompt(e.target.value)}
                            placeholder="You are [name], an expert in..."
                            rows={8}
                            className={validationErrors.customSystemPrompt ? 'border-error font-mono text-sm' : 'font-mono text-sm'}
                            minLength={50}
                            maxLength={2000}
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{customSystemPrompt.length} / 2000 characters</span>
                            {validationErrors.customSystemPrompt && (
                              <span className="text-error">{validationErrors.customSystemPrompt}</span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Temperature Setting</Label>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>0.0 = Deterministic</span>
                              <span>{temperature.toFixed(1)}</span>
                              <span>2.0 = Chaotic</span>
                            </div>
                            <Slider
                              value={[temperature]}
                              onValueChange={(v) => setTemperature(v[0])}
                              min={0}
                              max={2}
                              step={0.1}
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>0.7 = Balanced (default)</span>
                              <span>1.5 = Creative</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <Label>Response Format Preferences</Label>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="format-bullets" className="font-normal cursor-pointer">
                                Use bullet points when listing
                              </Label>
                              <Switch id="format-bullets" checked={formatBulletPoints} onCheckedChange={setFormatBulletPoints} />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="format-numbered" className="font-normal cursor-pointer">
                                Use numbered steps for processes
                              </Label>
                              <Switch id="format-numbered" checked={formatNumberedSteps} onCheckedChange={setFormatNumberedSteps} />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="format-bold" className="font-normal cursor-pointer">
                                Use bold for emphasis
                              </Label>
                              <Switch id="format-bold" checked={formatBold} onCheckedChange={setFormatBold} />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="format-code" className="font-normal cursor-pointer">
                                Use code blocks for technical terms
                              </Label>
                              <Switch id="format-code" checked={formatCodeBlocks} onCheckedChange={setFormatCodeBlocks} />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="format-emojis" className="font-normal cursor-pointer">
                                Use emojis (as per quiz setting)
                              </Label>
                              <Switch id="format-emojis" checked={formatEmojis} onCheckedChange={setFormatEmojis} />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Call-to-Action Mode</Label>
                            <Switch checked={ctaEnabled} onCheckedChange={setCtaEnabled} />
                          </div>
                          {ctaEnabled && (
                            <div className="mt-2">
                              <Label>Default CTA Message</Label>
                              <Input
                                value={ctaMessage}
                                onChange={(e) => setCtaMessage(e.target.value)}
                                placeholder="Want to learn more? Book a call: [link]"
                                maxLength={150}
                                className={validationErrors.ctaMessage ? 'border-error' : ''}
                              />
                              {validationErrors.ctaMessage && (
                                <p className="text-sm text-error">{validationErrors.ctaMessage}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Existing Fields - Keep for backward compatibility */}
              <AccordionItem value="existing">
                <AccordionTrigger value="existing">
                  <CardTitle className="text-lg">Legacy Settings</CardTitle>
                </AccordionTrigger>
                <AccordionContent value="existing">
                  <Card className="border-0 shadow-none">
                    <CardContent className="space-y-4 pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Formality</Label>
                          <Input value={formality} onChange={(e) => setFormality(e.target.value)} placeholder="casual, formal, semi-formal" />
                        </div>
                        <div className="space-y-2">
                          <Label>Directness</Label>
                          <Input value={directness} onChange={(e) => setDirectness(e.target.value)} placeholder="direct, diplomatic, warm" />
                        </div>
                        <div className="space-y-2">
                          <Label>Emoji usage</Label>
                          <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="minimal, moderate, frequent" />
                        </div>
                        <div className="space-y-2">
                          <Label>Reply length</Label>
                          <Input value={length} onChange={(e) => setLength(e.target.value)} placeholder="short, medium, detailed" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Always do (one per line)</Label>
                        <Textarea value={alwaysText} onChange={(e) => setAlwaysText(e.target.value)} placeholder="Be honest&#10;Keep it concise" rows={4} />
                      </div>

                      <div className="space-y-2">
                        <Label>Never do (one per line)</Label>
                        <Textarea value={neverText} onChange={(e) => setNeverText(e.target.value)} placeholder="Never lie&#10;Never overpromise" rows={4} />
                      </div>

                      <div className="space-y-2">
                        <Label>Avoid these topics (one per line)</Label>
                        <Textarea value={noTopicsText} onChange={(e) => setNoTopicsText(e.target.value)} placeholder="Personal finances&#10;Health details" rows={4} />
                      </div>

                      <div className="space-y-2">
                        <Label>Never commit to (one per line)</Label>
                        <Textarea value={noCommitmentsText} onChange={(e) => setNoCommitmentsText(e.target.value)} placeholder="Meeting times without checking calendar" rows={4} />
                      </div>

                      <div className="space-y-2">
                        <Label>Ignore if message contains (one per line)</Label>
                        <Textarea value={ignoreIfText} onChange={(e) => setIgnoreIfText(e.target.value)} placeholder="Spam&#10;Promotional emails" rows={4} />
                      </div>

                      <div className="space-y-2">
                        <Label>Defer if message contains (one per line)</Label>
                        <Textarea value={deferIfText} onChange={(e) => setDeferIfText(e.target.value)} placeholder="Complex technical questions" rows={4} />
                      </div>

                      <div className="space-y-2">
                        <Label>Common phrases you use (one per line)</Label>
                        <Textarea value={signaturePhrasesText} onChange={(e) => setSignaturePhrasesText(e.target.value)} placeholder="Thanks&#10;Got it" rows={4} />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Greeting style</Label>
                          <Input value={greeting} onChange={(e) => setGreeting(e.target.value)} placeholder="Hi, Hey, Hello" />
                        </div>
                        <div className="space-y-2">
                          <Label>Closing style</Label>
                          <Input value={closing} onChange={(e) => setClosing(e.target.value)} placeholder="Best, Thanks, Cheers" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="flex gap-3">
              <Button onClick={onSave} disabled={saving} size="lg" className="flex-1">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>

              <Button variant="outline" onClick={() => navigate('/mirror')}>
                Cancel
              </Button>
            </div>
          </div>

          {/* Right Sidebar - Live Preview (30%) */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              {/* System Prompt Preview */}
              <Card className="glass">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">System Prompt Preview</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTestChatOpen(true)}
                      className="text-xs"
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Test AI
                    </Button>
                  </div>
                  <CardDescription>Live preview of your AI's system prompt</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Prompt Quality Score</Label>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            promptQualityScore >= 80
                              ? 'text-success'
                              : promptQualityScore >= 60
                              ? 'text-warning'
                              : 'text-error'
                          }`}
                        >
                          {promptQualityScore}/100
                        </span>
                        {promptQualityScore >= 80 ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : promptQualityScore >= 60 ? (
                          <AlertTriangle className="h-4 w-4 text-warning" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-error" />
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-bg-secondary rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          promptQualityScore >= 80
                            ? 'bg-success'
                            : promptQualityScore >= 60
                            ? 'bg-warning'
                            : 'bg-error'
                        }`}
                        style={{ width: `${promptQualityScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Estimated Cost</Label>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-accent-primary" />
                      <span className="text-sm font-medium">
                        ${estimatedCost} per 1K queries
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Based on context window and model selection
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Preview</Label>
                    <div className="bg-bg-secondary rounded-lg p-4 max-h-96 overflow-y-auto">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-text-secondary">
                        {systemPromptPreview || 'Start filling out the form to see your system prompt...'}
                      </pre>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(systemPromptPreview);
                      }}
                      className="w-full"
                    >
                      Copy Prompt
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-lg">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prohibited Topics</span>
                    <span className="font-medium">{prohibitedTopics.length}/20</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Content Filters</span>
                    <span className="font-medium">
                      {[
                        filterMedical,
                        filterLegal,
                        filterFinancial,
                        filterPolitical,
                        filterPersonalAttacks,
                        filterCompetitor,
                        filterPricing,
                      ].filter(Boolean).length}/7
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Custom Prompt</span>
                    <span className="font-medium">
                      {customSystemPrompt ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Temperature</span>
                    <span className="font-medium">{temperature.toFixed(1)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Test AI Modal */}
        {testChatOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Test Your AI</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTestChatOpen(false);
                      setTestMessage('');
                      setTestResponse('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription>
                  Test how your AI responds with current settings
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto space-y-4">
                <div className="space-y-2">
                  <Label>Your Message</Label>
                  <Textarea
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Type a test question..."
                    rows={3}
                  />
                  <Button
                    onClick={handleTestAI}
                    disabled={!testMessage.trim()}
                    className="w-full"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Send Test Message
                  </Button>
                </div>

                {testResponse && (
                  <div className="space-y-2">
                    <Label>AI Response</Label>
                    <div className="bg-bg-secondary rounded-lg p-4">
                      <p className="text-sm whitespace-pre-wrap">{testResponse}</p>
                    </div>
                  </div>
                )}

                {!testResponse && testMessage && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      This feature requires a backend endpoint to test AI responses.
                      The test will use your current settings to generate a response.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}