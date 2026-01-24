import { Button } from '@/components/ui/button';
import { Layout } from '@/components/Layout';
import { Shield, Sparkles, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

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
                Modern Identity Mirror
              </div>

              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                Build an AI twin that replies
                <span className="text-primary"> exactly like you</span>.
              </h1>

              <p className="text-base md:text-lg text-muted-foreground max-w-prose">
                Create your identity rules, style anchors, and voice. Then mirror messages with speed, clarity, and your vibe.
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
                      Get started
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