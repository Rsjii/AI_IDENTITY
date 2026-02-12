import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  BarChart3, Bot, MessageSquare, Settings, Compass, Clock,
  Moon, Sun, LogOut, MoreHorizontal,
} from 'lucide-react';

interface MobileTab {
  icon: React.FC<{ className?: string }>;
  label: string;
  to: string;
}

export function MobileNav() {
  const { state, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    setSheetOpen(false);
  }, [location.pathname]);

  const isCreator = state.status === 'authenticated' && state.user?.userType === 'creator';

  const creatorTabs: MobileTab[] = [
    { icon: BarChart3, label: 'Dashboard', to: '/dashboard' },
    { icon: Bot, label: 'My AI', to: '/my-ai' },
    { icon: MessageSquare, label: 'Chats', to: '/conversations' },
    { icon: Settings, label: 'Settings', to: '/settings' },
  ];

  const endUserTabs: MobileTab[] = [
    { icon: Compass, label: 'Explore', to: '/explore' },
    { icon: Clock, label: 'Chats', to: '/my-chats' },
    { icon: Settings, label: 'Settings', to: '/settings' },
  ];

  const tabs = isCreator ? creatorTabs : endUserTabs;

  const isActive = (to: string) => {
    if (to === '/my-ai') return location.pathname.startsWith('/my-ai');
    if (to === '/conversations') return location.pathname.startsWith('/conversations');
    return location.pathname === to;
  };

  const handleLogout = async () => {
    await logout();
    window.location.replace('/auth?reason=logout');
  };

  if (state.status !== 'authenticated') return null;

  return (
    <>
      {/* Backdrop */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-backdrop bg-black/40"
          onClick={() => setSheetOpen(false)}
        />
      )}

      {/* Bottom Sheet — slides up above nav bar */}
      {sheetOpen && (
        <div className="fixed bottom-[64px] left-0 right-0 z-modal bg-bg-secondary border-t border-border-subtle rounded-t-xl px-4 py-3 shadow-xl">
          {/* Drag handle */}
          <div className="flex justify-center mb-3">
            <div className="w-10 h-1 bg-bg-elevated rounded-full" />
          </div>

          {/* Creator: extra nav items */}
          {isCreator && (
            <>
              <Link
                to="/explore"
                onClick={() => setSheetOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
              >
                <Compass className="h-5 w-5" />
                <span className="text-sm font-medium">Explore</span>
              </Link>
              <Link
                to="/my-chats"
                onClick={() => setSheetOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
              >
                <Clock className="h-5 w-5" />
                <span className="text-sm font-medium">My Chats</span>
              </Link>
            </>
          )}

          <div className="border-t border-border-subtle my-1" />

          {/* Theme toggle */}
          <button
            onClick={() => { toggleTheme(); setSheetOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            <span className="text-sm font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          {/* Logout */}
          <button
            onClick={() => { handleLogout(); setSheetOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-text-secondary hover:text-error hover:bg-error/10"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      )}

      {/* Bottom Nav Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-mobile-nav bg-bg-secondary/95 backdrop-blur-lg border-t border-border-subtle"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        <div className="flex justify-around items-center h-[64px]">
          {tabs.map((tab) => {
            const active = isActive(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[48px] px-2 rounded-lg transition-all touch-manipulation active:scale-95 ${
                  active ? 'text-accent-primary font-semibold' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <tab.icon className={`h-5 w-5 transition-transform ${active ? 'scale-110' : ''}`} />
                <span className="text-[10px] leading-none">{tab.label}</span>
              </Link>
            );
          })}

          {/* More (creator) / Me (end user) */}
          <button
            onClick={() => setSheetOpen(!sheetOpen)}
            className="flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[48px] px-2 rounded-lg text-text-muted hover:text-text-secondary transition-all touch-manipulation active:scale-95"
          >
            {isCreator ? (
              <MoreHorizontal className="h-5 w-5" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center">
                <span className="text-accent-primary text-xs font-bold">
                  {(state.user?.name || 'U')[0].toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-[10px] leading-none">{isCreator ? 'More' : 'Me'}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
