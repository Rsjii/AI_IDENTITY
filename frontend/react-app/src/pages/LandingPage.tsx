import { Button } from '@/components/ui/button';
import { Layout } from '@/components/Layout';
import { Shield, Sparkles, Zap, Play } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Testimonials } from '@/components/Testimonials';

export function LandingPage() {
  const { state } = useAuth();
  const authed = state.status === 'authenticated';
  return (
    <Layout showNavbar={true} showFooter={false}>
      <div className="mx-auto max-w-6xl">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-2xl border bg-card/40 p-8 md:p-12 glass">
          <div className="absolute -top-10 -left-10 h-56 w-56 rounded-full bg-primary/30 bg-blob" />
          <div className="absolute -bottom-12 -right-12 h-64 w-64 rounded-full bg-primary/20 bg-blob" />

          <div className="relative grid gap-10 md:grid-cols-2 items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Clone Yourself. Scale Infinitely.
              </div>

              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                Clone Yourself.
                <span className="text-primary"> Scale Infinitely</span>.
              </h1>

              <p className="text-base md:text-lg text-muted-foreground max-w-prose">
                Your AI handles 1000 conversations while you sleep. Deploy to Instagram, WhatsApp, Website in 10 minutes.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                {authed ? (
                  <>
                    <Button size="lg" onClick={() => window.location.href = '/mirror'}>
                      Go to Mirror
                    </Button>
                    <Button size="lg" variant="outline" onClick={() => window.location.href = '/account'}>
                      Account settings
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="lg" onClick={() => window.location.href = '/auth'}>
                      Start Free Trial - No Credit Card
                    </Button>
                    <Button size="lg" variant="outline" onClick={() => window.location.href = '/auth'}>
                      I already have an account
                    </Button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-6 pt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Secure by design
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Fast responses
                </div>
              </div>
            </div>

            {/* “Preview card” */}
            <div className="relative">
              <div className="rounded-2xl border bg-background/70 p-4 md:p-6 shadow-sm">
                <div className="text-sm text-muted-foreground mb-3">Preview</div>

                <div className="space-y-3">
                  <div className="rounded-xl border bg-card p-4">
                    <div className="text-xs text-muted-foreground mb-1">Incoming</div>
                    <div className="text-sm">
                      “Can you send the update by tonight?”
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card p-4">
                    <div className="text-xs text-muted-foreground mb-1">Your Mirror</div>
                    <div className="text-sm">
                      “Yes — I’ll share it by 9pm. If anything blocks me, I’ll ping you early.”
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Powered by your rules</span>
                  <span className="text-primary">Selflyx</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem/Solution Section */}
        <section className="mt-12 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Every message carries reputation risk</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Generic AI doesn't sound like you. Inconsistent tone damages relationships.
            </p>
          </div>

          {/* Solution Section */}
          <div className="grid md:grid-cols-3 gap-4 mt-8">
            <div className="rounded-2xl border bg-card/40 p-6 glass">
              <div className="text-2xl font-bold mb-2">1</div>
              <div className="text-base font-semibold mb-1">Define your rules once</div>
              <div className="text-sm text-muted-foreground">Set communication boundaries and style</div>
            </div>
            <div className="rounded-2xl border bg-card/40 p-6 glass">
              <div className="text-2xl font-bold mb-2">2</div>
              <div className="text-base font-semibold mb-1">See how YOU would reply</div>
              <div className="text-sm text-muted-foreground">Before you send, check against your identity</div>
            </div>
            <div className="rounded-2xl border bg-card/40 p-6 glass">
              <div className="text-2xl font-bold mb-2">3</div>
              <div className="text-base font-semibold mb-1">Consistent across platforms</div>
              <div className="text-sm text-muted-foreground">Same voice on Gmail, LinkedIn, Slack</div>
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <Testimonials />

        {/* Demo Video Section */}
        <section className="mt-12">
          <div className="text-center space-y-2 mb-6">
            <h2 className="text-2xl font-bold">See it in action</h2>
            <p className="text-muted-foreground">Watch how creators deploy their AI clones in 10 minutes</p>
          </div>
          <div className="rounded-2xl border bg-card/40 p-8 glass flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
                <Play className="h-8 w-8 text-primary ml-1" />
              </div>
              <div>
                <div className="font-semibold">Demo Video (2 mins)</div>
                <div className="text-sm text-muted-foreground">Coming soon: Watch how to clone yourself</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <Feature
            icon={<Sparkles className="h-5 w-5 text-primary" />}
            title="Style locked"
            text="Define tone, structure, and boundaries so replies stay consistent."
          />
          <Feature
            icon={<Zap className="h-5 w-5 text-primary" />}
            title="Fast workflow"
            text="Mirror messages in seconds. Save time on repetitive responses."
          />
          <Feature
            icon={<Shield className="h-5 w-5 text-primary" />}
            title="Private first"
            text="No noisy tracking. Your app stays clean and controlled."
          />
        </section>

        {/* Footer */}
        <footer className="mt-14 pb-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Selflyx • Built for a premium modern experience
        </footer>
      </div>
    </Layout>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border bg-card/40 p-6 glass">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
        {icon}
      </div>
      <div className="text-base font-semibold">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{text}</div>
    </div>
  );
}