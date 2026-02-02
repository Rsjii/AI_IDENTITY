import type { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Link } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
  showNavbar?: boolean;
  showFooter?: boolean;
  useContainer?: boolean;
  mainClassName?: string;
}

export function Layout({
  children,
  showNavbar = true,
  showFooter = true,
  useContainer = true,
  mainClassName = '',
}: LayoutProps) {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col">
      {/* Premium background gradient */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-accent-primary/5 via-transparent to-accent-primary/10" />
      
      {showNavbar && <Navbar />}

      <main className={`${useContainer ? 'container mx-auto px-4 py-10' : ''} flex-1 ${mainClassName}`}>
        {children}
      </main>

      {showFooter ? (
        <footer className="border-t border-border-default py-8 text-sm text-text-secondary">
          <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>© {new Date().getFullYear()} Selflyx</div>
            <div className="flex gap-4">
                <Link className="hover:text-text-primary transition-colors" to="/privacy">Privacy</Link>
                <Link className="hover:text-text-primary transition-colors" to="/terms">Terms</Link>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
}