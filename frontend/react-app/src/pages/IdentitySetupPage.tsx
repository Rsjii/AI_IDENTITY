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
  const [primaryUse, setPrimaryUse] = useState('founder');

  // Defaults
  const [formality, setFormality] = useState('casual');
  const [directness, setDirectness] = useState('direct');
  const [emoji, setEmoji] = useState('minimal');
  const [length, setLength] = useState('short');

  // Hard rules
  const [alwaysText, setAlwaysText] = useState('Be honest\nKeep it concise\nAsk clarifying questions if needed');
  const [neverText, setNeverText] = useState('Never lie\nNever overpromise\nNever use excessive emojis');

  // Boundaries
  const [noTopicsText, setNoTopicsText] = useState('Personal finances\nHealth details\nFamily matters');
  const [noCommitmentsText, setNoCommitmentsText] = useState('Meeting times without checking calendar\nDeadlines without confirming capacity');

  // Decision policy
  const [ignoreIfText, setIgnoreIfText] = useState('Spam\nPromotional emails\nAutomated messages');
  const [deferIfText, setDeferIfText] = useState('Complex technical questions\nLegal matters\nFinancial decisions');

  // Style anchors
  const [signaturePhrasesText, setSignaturePhrasesText] = useState('Thanks\nGot it\nLet me check');
  const [greeting, setGreeting] = useState('Hi');
  const [closing, setClosing] = useState('Best');

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
                <label className="text-sm font-medium">Always do</label>
                <Textarea value={alwaysText} onChange={(e) => setAlwaysText(e.target.value)} placeholder="Be honest&#10;Keep it concise&#10;Ask clarifying questions if needed" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Never do</label>
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
                <label className="text-sm font-medium">Avoid these topics</label>
                <Textarea value={noTopicsText} onChange={(e) => setNoTopicsText(e.target.value)} placeholder="Personal finances&#10;Health details&#10;Family matters" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Never commit to</label>
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
                <label className="text-sm font-medium">Ignore if message contains</label>
                <Textarea value={ignoreIfText} onChange={(e) => setIgnoreIfText(e.target.value)} placeholder="Spam&#10;Promotional emails&#10;Automated messages" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Defer if message contains</label>
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
