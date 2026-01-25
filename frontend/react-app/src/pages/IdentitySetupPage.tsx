import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

function toList(s: string): string[] {
  return s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

export function IdentitySetupPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  // Core identity
  const [displayName, setDisplayName] = useState('');
  const [primaryUse, setPrimaryUse] = useState('');

  // Defaults
  const [formality, setFormality] = useState('');
  const [directness, setDirectness] = useState('');
  const [emoji, setEmoji] = useState('');
  const [length, setLength] = useState('');

  // Hard rules
  const [alwaysText, setAlwaysText] = useState('');
  const [neverText, setNeverText] = useState('');
  const [alwaysPreset, setAlwaysPreset] = useState('');
  const [neverPreset, setNeverPreset] = useState('');

  // Boundaries
  const [noTopicsText, setNoTopicsText] = useState('');
  const [noCommitmentsText, setNoCommitmentsText] = useState('');
  const [topicsPreset, setTopicsPreset] = useState('');
  const [commitmentsPreset, setCommitmentsPreset] = useState('');

  // Decision policy
  const [ignoreIfText, setIgnoreIfText] = useState('');
  const [deferIfText, setDeferIfText] = useState('');
  const [ignorePreset, setIgnorePreset] = useState('');
  const [deferPreset, setDeferPreset] = useState('');

  // Style anchors
  const [signaturePhrasesText, setSignaturePhrasesText] = useState('');
  const [greeting, setGreeting] = useState('');
  const [closing, setClosing] = useState('');

  // Preset definitions
  const alwaysPresets: Record<string, string> = {
    founder: 'Be direct and honest\nKeep replies concise\nAsk clarifying questions before committing',
    sales: 'Be friendly and professional\nAlways follow up\nNever overpromise timelines',
    support: 'Be empathetic and helpful\nProvide clear next steps\nNever dismiss concerns',
    personal: 'Be warm and authentic\nKeep it casual\nAsk about their day',
    other: '',
  };

  const neverPresets: Record<string, string> = {
    founder: 'Never lie or overpromise\nNever agree to meetings without checking calendar\nNever use excessive emojis',
    sales: 'Never sound desperate\nNever make false claims\nNever ignore objections',
    support: 'Never blame the user\nNever use technical jargon unnecessarily\nNever close tickets prematurely',
    personal: 'Never be too formal\nNever ignore personal questions\nNever share sensitive info',
    other: '',
  };

  const topicsPresets: Record<string, string> = {
    founder: 'Personal finances\nHealth details\nFamily matters',
    sales: 'Internal company politics\nPricing negotiations without approval\nCompetitor comparisons',
    support: 'Personal information\nPayment details\nAccount passwords',
    personal: 'Work-related stress\nFinancial problems\nRelationship issues',
    other: '',
  };

  const commitmentsPresets: Record<string, string> = {
    founder: 'Meeting times without checking calendar\nDeadlines without confirming capacity\nPartnerships without legal review',
    sales: 'Discounts without approval\nDelivery dates without checking inventory\nCustom features without engineering',
    support: 'Refunds without authorization\nFeature requests without roadmap\nEscalations without manager approval',
    personal: 'Social events without checking schedule\nFinancial commitments\nLong-term plans',
    other: '',
  };

  const ignorePresets: Record<string, string> = {
    founder: 'Spam\nPromotional emails\nAutomated messages\nCold sales pitches',
    sales: 'Spam\nCompetitor marketing\nUnqualified leads\nAutomated newsletters',
    support: 'Spam\nPhishing attempts\nAutomated system alerts\nDuplicate tickets',
    personal: 'Spam\nPromotional emails\nAutomated messages\nUnwanted newsletters',
    other: '',
  };

  const deferPresets: Record<string, string> = {
    founder: 'Complex technical questions\nLegal matters\nFinancial decisions\nPartnership proposals',
    sales: 'Technical implementation details\nPricing over budget\nCustom integrations\nContract negotiations',
    support: 'Billing disputes\nAccount security issues\nFeature requests\nBug reports requiring engineering',
    personal: 'Complex life decisions\nFinancial advice\nMedical questions\nLegal matters',
    other: '',
  };

  // If identity already exists, send to edit
  useEffect(() => {
    (async () => {
      try {
        const me = await apiFetch<any>('/api/identity/me');
        if (me?.success && me?.identity?.activeVersion?.identityJson) {
          navigate('/identity/edit');
          return;
        }
      } catch {
        // ignore (401 handled by page usage)
      } finally {
        setChecking(false);
      }
    })();
  }, [navigate]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await apiFetch('/api/identity', {
        method: 'POST',
        body: JSON.stringify({
          identityJson: {
            displayName,
            primaryUse,
            defaults: {
              language: 'en',
              formality,
              directness,
              emoji,
              length,
              ctaStyle: 'minimal',
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
              riskTolerance: 'low',
            },
            styleAnchors: {
              signaturePhrases: toList(signaturePhrasesText),
              greeting,
              closing,
            },
          },
        }),
      });

      navigate('/mirror');
    } catch (err: any) {
      setError(err.message || 'Failed to create identity.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Checking identity…</CardTitle>
              <CardDescription>Please wait</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create your identity</h1>
          <p className="text-muted-foreground mt-1">Set the voice and rules for your mirror. Be specific for better results.</p>
        </div>

        <form onSubmit={onCreate} className="space-y-6">
          {/* Core Identity */}
          <Card className="glass">
            <CardHeader>
              <CardTitle>Core identity</CardTitle>
              <CardDescription>Who are you and what's your role?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Display name</label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="Your name" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Primary use / Role</label>
                <Input value={primaryUse} onChange={(e) => setPrimaryUse(e.target.value)} placeholder="founder, manager, consultant, etc." />
              </div>
            </CardContent>
          </Card>

          {/* Defaults */}
          <Card className="glass">
            <CardHeader>
              <CardTitle>Communication style</CardTitle>
              <CardDescription>How do you typically communicate?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Formality</label>
                  <Input value={formality} onChange={(e) => setFormality(e.target.value)} placeholder="casual, formal, semi-formal" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Directness</label>
                  <Input value={directness} onChange={(e) => setDirectness(e.target.value)} placeholder="direct, diplomatic, warm" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Emoji usage</label>
                  <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="minimal, moderate, frequent" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reply length</label>
                  <Input value={length} onChange={(e) => setLength(e.target.value)} placeholder="short, medium, detailed" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hard Rules */}
          <Card className="glass">
            <CardHeader>
              <CardTitle>Hard rules</CardTitle>
              <CardDescription>Always and never behaviors (one per line)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Always do</label>
                  <select
                    value={alwaysPreset}
                    onChange={(e) => {
                      setAlwaysPreset(e.target.value);
                      if (e.target.value && e.target.value !== 'other') {
                        setAlwaysText(alwaysPresets[e.target.value] || '');
                      } else {
                        setAlwaysText('');
                      }
                    }}
                    className="text-xs border rounded px-2 py-1"
                  >
                    <option value="">Choose preset...</option>
                    <option value="founder">Founder</option>
                    <option value="sales">Sales</option>
                    <option value="support">Support</option>
                    <option value="personal">Personal</option>
                    <option value="other">Other (custom)</option>
                  </select>
                </div>
                <Textarea value={alwaysText} onChange={(e) => setAlwaysText(e.target.value)} placeholder="Be honest&#10;Keep it concise&#10;Ask clarifying questions if needed" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Never do</label>
                  <select
                    value={neverPreset}
                    onChange={(e) => {
                      setNeverPreset(e.target.value);
                      if (e.target.value && e.target.value !== 'other') {
                        setNeverText(neverPresets[e.target.value] || '');
                      } else {
                        setNeverText('');
                      }
                    }}
                    className="text-xs border rounded px-2 py-1"
                  >
                    <option value="">Choose preset...</option>
                    <option value="founder">Founder</option>
                    <option value="sales">Sales</option>
                    <option value="support">Support</option>
                    <option value="personal">Personal</option>
                    <option value="other">Other (custom)</option>
                  </select>
                </div>
                <Textarea value={neverText} onChange={(e) => setNeverText(e.target.value)} placeholder="Never lie&#10;Never overpromise&#10;Never use excessive emojis" />
              </div>
            </CardContent>
          </Card>

          {/* Boundaries */}
          <Card className="glass">
            <CardHeader>
              <CardTitle>Boundaries</CardTitle>
              <CardDescription>What topics or commitments to avoid (one per line)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Avoid these topics</label>
                  <select
                    value={topicsPreset}
                    onChange={(e) => {
                      setTopicsPreset(e.target.value);
                      if (e.target.value && e.target.value !== 'other') {
                        setNoTopicsText(topicsPresets[e.target.value] || '');
                      } else {
                        setNoTopicsText('');
                      }
                    }}
                    className="text-xs border rounded px-2 py-1"
                  >
                    <option value="">Choose preset...</option>
                    <option value="founder">Founder</option>
                    <option value="sales">Sales</option>
                    <option value="support">Support</option>
                    <option value="personal">Personal</option>
                    <option value="other">Other (custom)</option>
                  </select>
                </div>
                <Textarea value={noTopicsText} onChange={(e) => setNoTopicsText(e.target.value)} placeholder="Personal finances&#10;Health details&#10;Family matters" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Never commit to</label>
                  <select
                    value={commitmentsPreset}
                    onChange={(e) => {
                      setCommitmentsPreset(e.target.value);
                      if (e.target.value && e.target.value !== 'other') {
                        setNoCommitmentsText(commitmentsPresets[e.target.value] || '');
                      } else {
                        setNoCommitmentsText('');
                      }
                    }}
                    className="text-xs border rounded px-2 py-1"
                  >
                    <option value="">Choose preset...</option>
                    <option value="founder">Founder</option>
                    <option value="sales">Sales</option>
                    <option value="support">Support</option>
                    <option value="personal">Personal</option>
                    <option value="other">Other (custom)</option>
                  </select>
                </div>
                <Textarea value={noCommitmentsText} onChange={(e) => setNoCommitmentsText(e.target.value)} placeholder="Meeting times without checking calendar&#10;Deadlines without confirming capacity" />
              </div>
            </CardContent>
          </Card>

          {/* Decision Policy */}
          <Card className="glass">
            <CardHeader>
              <CardTitle>Decision policy</CardTitle>
              <CardDescription>When to ignore or defer messages (one per line)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Ignore if message contains</label>
                  <select
                    value={ignorePreset}
                    onChange={(e) => {
                      setIgnorePreset(e.target.value);
                      if (e.target.value && e.target.value !== 'other') {
                        setIgnoreIfText(ignorePresets[e.target.value] || '');
                      } else {
                        setIgnoreIfText('');
                      }
                    }}
                    className="text-xs border rounded px-2 py-1"
                  >
                    <option value="">Choose preset...</option>
                    <option value="founder">Founder</option>
                    <option value="sales">Sales</option>
                    <option value="support">Support</option>
                    <option value="personal">Personal</option>
                    <option value="other">Other (custom)</option>
                  </select>
                </div>
                <Textarea value={ignoreIfText} onChange={(e) => setIgnoreIfText(e.target.value)} placeholder="Spam&#10;Promotional emails&#10;Automated messages" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Defer if message contains</label>
                  <select
                    value={deferPreset}
                    onChange={(e) => {
                      setDeferPreset(e.target.value);
                      if (e.target.value && e.target.value !== 'other') {
                        setDeferIfText(deferPresets[e.target.value] || '');
                      } else {
                        setDeferIfText('');
                      }
                    }}
                    className="text-xs border rounded px-2 py-1"
                  >
                    <option value="">Choose preset...</option>
                    <option value="founder">Founder</option>
                    <option value="sales">Sales</option>
                    <option value="support">Support</option>
                    <option value="personal">Personal</option>
                    <option value="other">Other (custom)</option>
                  </select>
                </div>
                <Textarea value={deferIfText} onChange={(e) => setDeferIfText(e.target.value)} placeholder="Complex technical questions&#10;Legal matters&#10;Financial decisions" />
              </div>
            </CardContent>
          </Card>

          {/* Style Anchors */}
          <Card className="glass">
            <CardHeader>
              <CardTitle>Style anchors</CardTitle>
              <CardDescription>Your signature phrases and greeting/closing style</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Common phrases you use (one per line)</label>
                <Textarea value={signaturePhrasesText} onChange={(e) => setSignaturePhrasesText(e.target.value)} placeholder="Thanks&#10;Got it&#10;Let me check" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Greeting style</label>
                  <Input value={greeting} onChange={(e) => setGreeting(e.target.value)} placeholder="Hi, Hey, Hello" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Closing style</label>
                  <Input value={closing} onChange={(e) => setClosing(e.target.value)} placeholder="Best, Thanks, Cheers" />
                </div>
              </div>
            </CardContent>
          </Card>

          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button className="w-full" type="submit" disabled={loading} size="lg">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              'Create identity'
            )}
          </Button>
        </form>
      </div>
    </Layout>
  );
}
