import { useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  BarChart3, Bot, MessageSquare, Settings, Compass, Clock,
  Moon, Sun, LogOut, ChevronLeft, ChevronRight,
} from 'lucide-react';

interface NavItem {
  icon: React.FC<{ className?: string }>;
  label: string;
  to: string;
}

const CREATOR_MAIN: NavItem[] = [
  { icon: BarChart3, label: 'Dashboard', to: '/dashboard' },
  { icon: Bot, label: 'My AI', to: '/my-ai' },
  { icon: MessageSquare, label: 'Conversations', to: '/conversations' },
  { icon: Settings, label: 'Settings', to: '/settings' },
];

const CREATOR_ALSO: NavItem[] = [
  { icon: Compass, label: 'Explore', to: '/explore' },
  { icon: Clock, label: 'My Chats', to: '/my-chats' },
];

const ENDUSER_MAIN: NavItem[] = [
  { icon: Compass, label: 'Explore', to: '/explore' },
  { icon: Clock, label: 'My Chats', to: '/my-chats' },
  { icon: Settings, label: 'Settings', to: '/settings' },
];

export function Sidebar({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { state, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const nav = useNavigate();

  const isCreator = state.status === 'authenticated' && state.user?.userType === 'creator';
  const mainItems = isCreator ? CREATOR_MAIN : ENDUSER_MAIN;
  const alsoItems = isCreator ? CREATOR_ALSO : [];

  const isActive = useCallback((to: string) => {
    if (to === '/my-ai') return location.pathname.startsWith('/my-ai');
    if (to === '/conversations') return location.pathname.startsWith('/conversations');
    return location.pathname === to;
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    nav('/auth');
  };

  if (state.status !== 'authenticated') return null;

  const user = state.user;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 bg-bg-secondary border-r border-border-subtle flex flex-col transition-[width] duration-300 ease-out ${
        expanded ? 'w-[260px]' : 'w-[72px]'
      }`}
    >
      {/* Logo row */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border-subtle flex-shrink-0">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <span className="text-accent-primary font-bold text-xl flex-shrink-0">◆</span>
          {expanded && <span className="text-text-primary font-bold tracking-tight truncate">Selflyx</span>}
        </Link>
        <button
          onClick={onToggle}
          className="text-text-secondary hover:text-text-primary transition-colors p-1 rounded-md hover:bg-bg-elevated flex-shrink-0"
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {expanded ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
      </div>

      {/* User card */}
      <div className={`px-3 py-4 border-b border-border-subtle flex-shrink-0 ${!expanded ? 'flex justify-center' : ''}`}>
        <div className={`flex items-center gap-3 ${!expanded ? 'flex-col' : ''}`}>
          <div className="w-9 h-9 rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center flex-shrink-0">
            {user.profileImage ? (
              <img src={user.profileImage} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-accent-primary font-semibold text-sm">
                {(user.name || user.handle || 'U')[0].toUpperCase()}
              </span>
            )}
          </div>
          {expanded && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-text-primary truncate">{user.name || user.handle || 'User'}</div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-xs text-text-muted truncate">@{user.handle || '—'}</span>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.25 rounded-full ${
                  isCreator ? 'bg-success/10 text-success' : 'bg-bg-elevated text-text-secondary'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isCreator ? 'bg-success' : 'bg-text-secondary'}`} />
                  {isCreator ? 'Creator' : 'User'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nav items — scrollable */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {expanded && (
          <span className="text-xs uppercase text-text-muted tracking-widest px-3 pb-1 mt-2 block">Main</span>
        )}
        {mainItems.map((item) => (
          <SidebarNavItem key={item.to} item={item} active={isActive(item.to)} expanded={expanded} />
        ))}

        {alsoItems.length > 0 && (
          <>
            <div className="my-3 mx-3 border-t border-border-subtle" />
            {expanded && (
              <span className="text-xs uppercase text-text-muted tracking-widest px-3 pb-1 block">Also</span>
            )}
            {alsoItems.map((item) => (
              <SidebarNavItem key={item.to} item={item} active={isActive(item.to)} expanded={expanded} />
            ))}
          </>
        )}
      </nav>

      {/* Bottom: theme + logout */}
      <div className="border-t border-border-subtle px-2 py-3 space-y-0.5 flex-shrink-0">
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors ${!expanded ? 'justify-center' : ''}`}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {expanded && <span className="text-sm">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-secondary hover:text-error hover:bg-error/10 transition-colors ${!expanded ? 'justify-center' : ''}`}
        >
          <LogOut className="h-4 w-4" />
          {expanded && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </aside>
  );
}

function SidebarNavItem({ item, active, expanded }: { item: NavItem; active: boolean; expanded: boolean }) {
  return (
    <Link
      to={item.to}
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group mb-0.5 ${
        !expanded ? 'justify-center' : ''
      } ${
        active
          ? 'bg-accent-primary/[0.08] text-accent-primary'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
      }`}
    >
      {/* Active left bar */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.75 h-5 bg-accent-primary rounded-r-sm" />
      )}
      <item.icon className={`h-4.5 w-4.5 flex-shrink-0 ${active && !expanded ? 'drop-shadow-[0_0_6px_rgba(139,92,246,0.4)]' : ''}`} />
      {expanded && <span className="text-sm font-medium">{item.label}</span>}
      {/* Tooltip when collapsed */}
      {!expanded && (
        <span className="absolute left-full ml-2 px-2.5 py-1.5 text-xs bg-bg-tertiary text-text-primary rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-border-subtle shadow-lg z-50">
          {item.label}
        </span>
      )}
    </Link>
  );
}
