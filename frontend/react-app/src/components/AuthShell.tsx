import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export function AuthShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/25 bg-blob" />
        <div className="absolute left-10 bottom-10 h-64 w-64 rounded-full bg-primary/15 bg-blob" />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-xl font-bold tracking-tight">
            Selflyx<span className="text-primary">.</span>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div> : null}
        </div>

        {children}

        <div className="mt-6 text-center">
          <Button variant="link" className="text-sm" onClick={() => window.location.href = '/'}>
            ← Back to home
          </Button>
        </div>
      </div>
    </div>
  );
}