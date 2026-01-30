import { Button } from '@/components/ui/button';
import { Layout } from '@/components/Layout';
import { Shield, Sparkles, Zap, Play, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Testimonials } from '@/components/Testimonials';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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

              <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                Clone Yourself with AI.
                <br />
                <span className="bg-gradient-to-r from-primary to-accent-secondary bg-clip-text text-transparent">
                  Scale to 1000s Without Hiring
                </span>
              </h1>

              <p className="text-base md:text-lg lg:text-xl text-muted-foreground max-w-prose">
                Your AI handles DMs, creates content, and earns money 24/7.
                <br />
                Deploy to Instagram, Website, WhatsApp in 10 minutes.
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

              <div className="flex flex-wrap items-center gap-4 pt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  No credit card required
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Setup in 10 minutes
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Cancel anytime
                </div>
              </div>

              {/* Trust indicators */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { k: '10 min', v: 'Setup time' },
                  { k: '24/7', v: 'Always on' },
                  { k: '500+', v: 'Creators onboarded' },
                  { k: '99.9%', v: 'Uptime target' },
                ].map((s) => (
                  <div key={s.v} className="rounded-xl border bg-background/60 px-4 py-3 text-center">
                    <div className="text-base font-semibold text-foreground">{s.k}</div>
                    <div className="text-xs text-muted-foreground">{s.v}</div>
                  </div>
                ))}
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

        {/* Logos / trust bar */}
        <section className="mt-10">
          <div className="rounded-2xl border bg-card/30 p-6 glass">
            <div className="text-center text-sm text-muted-foreground">
              Trusted by creators and teams at
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm font-medium text-muted-foreground sm:grid-cols-4">
              {['CreatorOS', 'InboxPro', 'StudioHQ', 'GrowthLab'].map((name) => (
                <div key={name} className="rounded-xl border bg-background/50 py-3">
                  {name}
                </div>
              ))}
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
          <div className="rounded-2xl border bg-card/40 p-4 md:p-6 glass">
            <div className="relative overflow-hidden rounded-xl border bg-background/60">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent-secondary/10" />
              <div className="relative aspect-video w-full">
                <iframe
                  className="h-full w-full"
                  src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
                  title="Selflyx demo video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Demo (2 mins)</span> — From rules → deploy → earn
              </div>
              <Button
                variant="outline"
                className="sm:w-auto"
                onClick={() => window.location.href = authed ? '/mirror' : '/auth'}
              >
                <Play className="mr-2 h-4 w-4" />
                Try it live
              </Button>
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

        {/* How it works */}
        <section className="mt-12">
          <div className="text-center space-y-2 mb-8">
            <h2 className="text-2xl font-bold">How it works</h2>
            <p className="text-muted-foreground">A simple, repeatable flow your team can trust.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { n: '01', t: 'Upload your context', d: 'Docs, notes, FAQs, and best answers.' },
              { n: '02', t: 'Lock your voice', d: 'Tone, boundaries, and formatting rules.' },
              { n: '03', t: 'Deploy anywhere', d: 'Website, Instagram, WhatsApp, and more.' },
              { n: '04', t: 'Improve weekly', d: 'See what users ask, refine, repeat.' },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border bg-card/40 p-6 glass">
                <div className="text-xs font-semibold text-primary">{s.n}</div>
                <div className="mt-2 text-base font-semibold">{s.t}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.d}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-center">
            <Button size="lg" onClick={() => window.location.href = authed ? '/onboarding' : '/auth'}>
              Start in 10 minutes
            </Button>
          </div>
        </section>

        {/* Pricing comparison teaser */}
        <section className="mt-12">
          <div className="rounded-2xl border bg-card/40 p-6 glass">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Pricing that scales with you</h2>
                <p className="text-muted-foreground max-w-2xl">
                  Start free, upgrade when you’re ready. No surprise fees.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => window.location.href = '/pricing'}>
                  View all plans
                </Button>
                <Button onClick={() => window.location.href = authed ? '/mirror' : '/auth'}>
                  Start free
                </Button>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Feature</th>
                    <th className="text-center p-3">Free</th>
                    <th className="text-center p-3">Pro</th>
                    <th className="text-center p-3">Growth</th>
                    <th className="text-center p-3">Scale</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { f: 'Monthly chats', v: ['500', '5,000', '25,000', 'Unlimited'] },
                    { f: 'Website widget', v: [false, true, true, true] },
                    { f: 'Pay-per-chat', v: [false, true, true, true] },
                    { f: 'Priority support', v: [false, false, true, true] },
                  ].map((row) => (
                    <tr key={row.f} className="border-b">
                      <td className="p-3 text-muted-foreground">{row.f}</td>
                      {row.v.map((cell, idx) => (
                        <td key={idx} className="p-3 text-center">
                          {typeof cell === 'boolean' ? (
                            cell ? <Check className="mx-auto h-4 w-4 text-primary" /> : <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className="text-foreground">{cell}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mt-12">
          <div className="text-center space-y-2 mb-8">
            <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
          </div>
          <div className="max-w-3xl mx-auto">
            <Accordion type="single" defaultValue="q1">
              <AccordionItem value="q1" className="rounded-2xl border bg-card/40 glass">
                <AccordionTrigger value="q1" className="px-6 py-5 text-left">
                  How long does setup take?
                </AccordionTrigger>
                <AccordionContent value="q1" className="px-6 pb-5">
                  <p className="text-muted-foreground">
                    Most creators are live in <span className="font-medium text-foreground">10–30 minutes</span>. Your AI improves as you add more context.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="q2" className="rounded-2xl border bg-card/40 glass">
                <AccordionTrigger value="q2" className="px-6 py-5 text-left">
                  Do I need coding skills?
                </AccordionTrigger>
                <AccordionContent value="q2" className="px-6 pb-5">
                  <p className="text-muted-foreground">
                    No. You can copy‑paste your widget and connect integrations with guided steps.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="q3" className="rounded-2xl border bg-card/40 glass">
                <AccordionTrigger value="q3" className="px-6 py-5 text-left">
                  Can I monetize replies?
                </AccordionTrigger>
                <AccordionContent value="q3" className="px-6 pb-5">
                  <p className="text-muted-foreground">
                    Yes — enable <span className="font-medium text-foreground">pay‑per‑chat</span> for premium answers and consultations.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="q4" className="rounded-2xl border bg-card/40 glass">
                <AccordionTrigger value="q4" className="px-6 py-5 text-left">
                  Is my data private?
                </AccordionTrigger>
                <AccordionContent value="q4" className="px-6 pb-5">
                  <p className="text-muted-foreground">
                    Your rules and context stay scoped to your workspace. You control what’s connected, and you can revoke access anytime.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* Customer success stories */}
        <section className="mt-12">
          <div className="text-center space-y-2 mb-8">
            <h2 className="text-2xl font-bold">Customer success stories</h2>
            <p className="text-muted-foreground">Real outcomes creators care about.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { title: 'DMs handled automatically', stat: '—62% time', text: 'Less inbox stress. Faster replies that still sound human.' },
              { title: 'Consultations monetized', stat: '+$1.8k/mo', text: 'Pay-per-chat turns expertise into revenue without extra hours.' },
              { title: 'Brand voice consistency', stat: '4.7/5', text: 'Higher satisfaction from consistent tone and clear boundaries.' },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl border bg-card/40 p-6 glass">
                <div className="text-xs font-semibold text-primary">{c.stat}</div>
                <div className="mt-2 text-base font-semibold">{c.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{c.text}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-center">
            <Button size="lg" variant="outline" onClick={() => window.location.href = '/pricing'}>
              See plans & ROI
            </Button>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mt-12">
          <div className="rounded-2xl border bg-gradient-to-br from-primary/15 via-background/40 to-accent-secondary/10 p-8 md:p-10 glass">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <h2 className="text-2xl md:text-3xl font-bold">Ready to clone yourself?</h2>
                <p className="text-muted-foreground max-w-xl">
                  Start free today. Upgrade only when you’re getting value.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" onClick={() => window.location.href = authed ? '/mirror' : '/auth'}>
                  Start free
                </Button>
                <Button size="lg" variant="outline" onClick={() => window.location.href = '/pricing'}>
                  Compare plans
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-14 pb-6 border-t pt-8">
          <div className="grid md:grid-cols-4 gap-8 mb-6">
            <div>
              <h3 className="font-semibold mb-3">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="/#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="/docs" className="hover:text-foreground transition-colors">Docs</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/about" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="/blog" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="/careers" className="hover:text-foreground transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a></li>
                <li><a href="/terms" className="hover:text-foreground transition-colors">Terms</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3">Support</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/help" className="hover:text-foreground transition-colors">Help Center</a></li>
                <li><a href="mailto:support@selflyx.com" className="hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Selflyx. All rights reserved.
          </div>
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