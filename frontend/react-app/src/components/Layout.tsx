import type { ReactNode } from 'react';
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

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
  const { state } = useAuth();
  const isAuthed = state.status === 'authenticated';
  const showNav = showNavbar && isAuthed;

  // Start expanded if viewport >= 1400px, collapsed otherwise (desktop only)
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth >= 1400;
  });

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Background gradient */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-accent-primary/5 via-transparent to-accent-primary/10" />

      {/* Desktop Sidebar — hidden below lg (1024px) */}
      {showNav && (
        <div className="hidden lg:block">
          <Sidebar expanded={sidebarExpanded} onToggle={() => setSidebarExpanded((e) => !e)} />
        </div>
      )}

      {/* Main Content */}
      <main
        className={`
          flex-1
          ${showNav ? (sidebarExpanded ? 'lg:ml-[260px]' : 'lg:ml-[72px]') : ''}
          ${showNav ? 'pb-[80px] lg:pb-0' : ''}
          ${useContainer ? 'container mx-auto px-4 py-10' : ''}
          ${mainClassName}
        `}
      >
        {children}
      </main>

      {/* Mobile Bottom Nav — visible only below lg */}
      {showNav && (
        <div className="lg:hidden">
          <MobileNav />
        </div>
      )}

      {/* Footer — only for unauthenticated visitors */}
      {showFooter && !isAuthed ? (
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
