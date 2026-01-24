import { Link, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';

export function Navbar() {
  const nav = useNavigate();
  const { state, logout } = useAuth();

  const onLogout = async () => {
    await logout();
    nav('/auth');
  };

  const isAuthed = state.status === 'authenticated';

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
                  <Link to="/history" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    History
                  </Link>
                  <Link to="/identity/edit" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Identity
                  </Link>
                </>
              ) : null}

              {isAuthed && state.user.isAdmin ? (
                <Link to="/admin" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Admin
                </Link>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            {state.status === 'loading' ? (
              <div className="text-xs text-muted-foreground px-2">Loading…</div>
            ) : isAuthed ? (
              <>
                <Link
                  to="/account"
                  className="hidden sm:inline-flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                  title={state.user.email}
                >
                  {state.user.name || state.user.handle || 'Account'}
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
      </div>
    </nav>
  );
}
