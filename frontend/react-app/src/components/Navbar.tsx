import { Link, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { ThemeToggle } from './ThemeToggle';
import { RoleSwitcher } from './RoleSwitcher';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { FLAGS } from '@/lib/flags';
import { apiFetch } from '@/lib/api';

export function Navbar() {
  const nav = useNavigate();
  const { state, logout, refresh } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const onLogout = async () => {
    await logout();
    window.location.replace('/auth?reason=logout');
  };

  const upgradeToCreator = async () => {
    setUpgradeLoading(true);
    try {
      await apiFetch('/api/auth/set-user-type', {
        method: 'POST',
        body: JSON.stringify({ userType: 'creator' }),
      });
      await refresh();
      nav('/onboarding/quiz');
    } finally {
      setUpgradeLoading(false);
    }
  };

  const isAuthed = state.status === 'authenticated';

  // Close mobile menu when auth state changes (e.g. logout) or route changes via nav()
  useEffect(() => {
    setMobileOpen(false);
  }, [state.status]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-navbar border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 0.5rem)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-bold tracking-tight">
              Selflyx<span className="text-primary">.</span>
            </Link>

            <div className="hidden md:flex items-center gap-4">
              {isAuthed ? (
                <>
                  <Link to="/explore" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Explore
                  </Link>
                  <Link to="/my-chats" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    My Chats
                  </Link>
                  <Link to="/my-profile" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Profile
                  </Link>
                  {(state.user as any)?.userType === 'visitor' ? (
                    <Button size="sm" variant="outline" onClick={upgradeToCreator} disabled={upgradeLoading}>
                      {upgradeLoading ? 'Starting…' : '➕ Create AI'}
                    </Button>
                  ) : null}
                  {(state.user as any)?.userType === 'creator' ? (
                    <Link to="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                      Dashboard
                    </Link>
                  ) : null}
                  {(state.user as any)?.userType === 'creator' ? (
                    <Link to="/conversations" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                      Conversations
                    </Link>
                  ) : null}
                  {(state.user as any)?.userType === 'creator' ? (
                    <>
                      <Link to="/mirror" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                        Mirror
                      </Link>
                      <Link to="/identity/edit" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                        Identity
                      </Link>
                      {FLAGS.voice && (
                        <Link to="/voice/setup" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                          Voice
                        </Link>
                      )}
                      {FLAGS.integrationsPage && (
                        <Link to="/integrations" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                          Integrations
                        </Link>
                      )}
                    </>
                  ) : null}
                  <Link to="/settings" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Settings
                  </Link>
                </>
              ) : (
                <Link to="/explore" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Explore
                </Link>
              )}

              {isAuthed && state.user?.isAdmin ? (
                <Link to="/admin" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Admin
                </Link>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthed && <RoleSwitcher />}
            <ThemeToggle />

            {/* Mobile menu button */}
            <button
              type="button"
              className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-accent transition-colors min-h-[44px] min-w-[44px]"
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
                  to="/my-profile"
                  className="hidden sm:inline-flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                  title={state.user?.email || ''}
                >
                  {state.user?.name || state.user?.handle || 'Profile'}
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
                  <MobileNavLink to="/explore" onClick={() => nav('/explore')}>Explore</MobileNavLink>
                  <MobileNavLink to="/my-chats" onClick={() => nav('/my-chats')}>My Chats</MobileNavLink>
                  <MobileNavLink to="/my-profile" onClick={() => nav('/my-profile')}>Profile</MobileNavLink>
                  {(state.user as any)?.userType === 'visitor' ? (
                    <div className="px-2 pt-2">
                      <Button className="w-full h-11" variant="outline" onClick={upgradeToCreator} disabled={upgradeLoading}>
                        {upgradeLoading ? 'Starting…' : '➕ Create AI'}
                      </Button>
                    </div>
                  ) : null}
                  {(state.user as any)?.userType === 'creator' ? (
                    <MobileNavLink to="/dashboard" onClick={() => nav('/dashboard')}>Dashboard</MobileNavLink>
                  ) : null}
                  {(state.user as any)?.userType === 'creator' ? (
                    <MobileNavLink to="/conversations" onClick={() => nav('/conversations')}>Conversations</MobileNavLink>
                  ) : null}
                  {(state.user as any)?.userType === 'creator' ? (
                    <>
                      <MobileNavLink to="/mirror" onClick={() => nav('/mirror')}>Mirror</MobileNavLink>
                      <MobileNavLink to="/identity/edit" onClick={() => nav('/identity/edit')}>Identity</MobileNavLink>
                      {FLAGS.voice && (
                        <MobileNavLink to="/voice/setup" onClick={() => nav('/voice/setup')}>Voice</MobileNavLink>
                      )}
                      {FLAGS.integrationsPage && (
                        <MobileNavLink to="/integrations" onClick={() => nav('/integrations')}>Integrations</MobileNavLink>
                      )}
                    </>
                  ) : null}
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
                <div className="flex flex-col">
                  <MobileNavLink to="/explore" onClick={() => nav('/explore')}>Explore</MobileNavLink>
                  <div className="px-2 pt-2">
                    <Button className="w-full h-11" onClick={() => nav('/auth')}>
                      Sign in
                    </Button>
                  </div>
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
      className="h-11 px-4 flex items-center rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors min-h-[44px]"
    >
      {children}
    </Link>
  );
}
