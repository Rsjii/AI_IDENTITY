import { Link, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';

export function Navbar() {
  const nav = useNavigate();
  const { state, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const onLogout = async () => {
    await logout();
    nav('/auth');
  };

  const isAuthed = state.status === 'authenticated';

  // Close mobile menu when auth state changes (e.g. logout) or route changes via nav()
  useEffect(() => {
    setMobileOpen(false);
  }, [state.status]);

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-bold tracking-tight">
              Selflyx<span className="text-primary">.</span>
            </Link>

            <div className="hidden md:flex items-center gap-4">
              {isAuthed ? (
                <>
                  <Link to="/mirror" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Mirror
                  </Link>
                  <Link to="/identity/edit" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Identity
                  </Link>
                  <Link to="/voice/setup" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Voice
                  </Link>
                  <Link to="/integrations" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Integrations
                  </Link>
                  <Link to="/settings" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Settings
                  </Link>
                </>
              ) : null}

              {isAuthed && state.user?.isAdmin ? (
                <Link to="/admin" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Admin
                </Link>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            {/* Mobile menu button */}
            <button
              type="button"
              className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-accent transition-colors"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {state.status === 'loading' ? (
              <div className="text-xs text-muted-foreground px-2">Loading…</div>
            ) : isAuthed ? (
              <>
                <Link
                  to="/settings"
                  className="hidden sm:inline-flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                  title={state.user?.email || ''}
                >
                  {state.user?.name || state.user?.handle || 'Settings'}
                </Link>
                <Button size="sm" variant="outline" onClick={onLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <Button size="sm" className="ml-1" onClick={() => nav('/auth')}>
                Sign in
              </Button>
            )}
          </div>
        </div>

        {/* Mobile menu panel */}
        {mobileOpen ? (
          <div className="md:hidden pb-4">
            <div className="rounded-xl border bg-background/80 backdrop-blur px-2 py-2">
              {isAuthed ? (
                <div className="flex flex-col">
                  <MobileNavLink to="/mirror" onClick={() => nav('/mirror')}>Mirror</MobileNavLink>
                  <MobileNavLink to="/identity/edit" onClick={() => nav('/identity/edit')}>Identity</MobileNavLink>
                  <MobileNavLink to="/voice/setup" onClick={() => nav('/voice/setup')}>Voice</MobileNavLink>
                  <MobileNavLink to="/integrations" onClick={() => nav('/integrations')}>Integrations</MobileNavLink>
                  <MobileNavLink to="/settings" onClick={() => nav('/settings')}>Settings</MobileNavLink>
                  {state.user?.isAdmin ? (
                    <MobileNavLink to="/admin" onClick={() => nav('/admin')}>Admin</MobileNavLink>
                  ) : null}
                  <div className="px-2 pt-2">
                    <Button className="w-full h-11" variant="outline" onClick={onLogout}>
                      Logout
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="px-2">
                  <Button className="w-full h-11" onClick={() => nav('/auth')}>
                    Sign in
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </nav>
  );
}

function MobileNavLink({ to, children, onClick }: { to: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="h-11 px-4 flex items-center rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      {children}
    </Link>
  );
}
