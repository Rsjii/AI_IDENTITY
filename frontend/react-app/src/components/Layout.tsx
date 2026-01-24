import type { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Link } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
  showNavbar?: boolean;
  showFooter?: boolean;
}

export function Layout({ children, showNavbar = true, showFooter = true }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Premium background */}
      <div className="fixed inset-0 -z-10 bg-radial-fade" />
      <div className="fixed inset-0 -z-10 bg-grid [mask-image:radial-gradient(60%_60%_at_50%_0%,black,transparent)]" />

      {showNavbar && <Navbar />}

      <main className="container mx-auto px-4 py-10 flex-1">
        {children}
      </main>

      {showFooter ? (
        <footer className="border-t py-8 text-sm text-muted-foreground">
          <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>© {new Date().getFullYear()} Selflyx</div>
            <div className="flex gap-4">
                <Link className="hover:text-foreground transition-colors" to="/privacy">Privacy</Link>
                <Link className="hover:text-foreground transition-colors" to="/terms">Terms</Link>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
}