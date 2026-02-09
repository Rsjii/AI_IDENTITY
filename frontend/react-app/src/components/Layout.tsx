import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
  showNavbar?: boolean;
  showFooter?: boolean;
  useContainer?: boolean;
  mainClassName?: string;
}

const SIDEBAR_KEY = 'selflyx_sidebar_expanded';

export function Layout({
  children,
  showNavbar = true,
  showFooter = true,
  useContainer = true,
  mainClassName = '',
}: LayoutProps) {
  const { state } = useAuth();
  const location = useLocation();
  const isAuthed = state.status === 'authenticated';
  const showNav = showNavbar && isAuthed;

  // ✅ Default collapsed; never auto-expand based on viewport
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1';
    } catch {
      return false;
    }
  });

  // ✅ Requirement: after any navigation, sidebar should be minimized
  useEffect(() => {
    setSidebarExpanded(false);
    try {
      localStorage.setItem(SIDEBAR_KEY, '0');
    } catch {}
  }, [location.pathname]);

  const toggleSidebar = () => {
    setSidebarExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      } catch {}
      return next;
    });
  };

  const handleSidebarNavigate = () => {
    setSidebarExpanded(false);
    try {
      localStorage.setItem(SIDEBAR_KEY, '0');
    } catch {}
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary overflow-x-hidden">
      {/* Background gradient */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-accent-primary/5 via-transparent to-accent-primary/10" />

      {/* Desktop Sidebar — hidden below lg (1024px) */}
      {showNav && (
        <div className="hidden lg:block">
          {/* Backdrop (desktop) — keeps main intact, sidebar overlays on top */}
          {sidebarExpanded && (
            <div
              className="fixed inset-0 z-sticky bg-black/40"
              onClick={() => setSidebarExpanded(false)}
              aria-hidden="true"
            />
          )}

          <Sidebar
            expanded={sidebarExpanded}
            onToggle={toggleSidebar}
            onNavigate={handleSidebarNavigate}
          />
        </div>
      )}

      {/* Main Content — Proper spacing for navbar (top) and mobile nav (bottom) */}
      <main
        className={`
          flex-1
          ${showNav ? 'pt-16 pb-20 lg:pb-0 pl-0 lg:pl-[72px] transition-[padding] duration-300' : ''}
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
