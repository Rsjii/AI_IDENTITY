import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronDown, LayoutDashboard, CreditCard, Sparkles, Settings } from 'lucide-react';

export function RoleSwitcher() {
  const nav = useNavigate();
  const location = useLocation();
  const { state } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const user = state.status === 'authenticated' ? state.user : null;
  if (!user) return null;

  const isCreator = (user as any).userType === 'creator' || (user as any).creatorTitle;
  const isOnCreatorDashboard = location.pathname === '/dashboard';
  const isOnSubscriptionsDashboard = location.pathname === '/my-subscriptions';

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const currentMode = isOnCreatorDashboard
    ? 'Creator Dashboard'
    : isOnSubscriptionsDashboard
    ? 'My Subscriptions'
    : isCreator
    ? 'Creator Mode'
    : 'User Mode';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm font-medium"
      >
        <span>{currentMode}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-background border rounded-lg shadow-lg py-1 z-50">
          {/* Creator Dashboard (only if user is creator) */}
          {isCreator && (
            <button
              onClick={() => {
                nav('/dashboard');
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-muted transition-colors text-left ${
                isOnCreatorDashboard ? 'bg-muted' : ''
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <div>
                <div className="font-medium">Creator Dashboard</div>
                <div className="text-xs text-muted-foreground">Manage your AI & earnings</div>
              </div>
            </button>
          )}

          {/* My Subscriptions (always show) */}
          <button
            onClick={() => {
              nav('/my-subscriptions');
              setIsOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-muted transition-colors text-left ${
              isOnSubscriptionsDashboard ? 'bg-muted' : ''
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <div>
              <div className="font-medium">My Subscriptions</div>
              <div className="text-xs text-muted-foreground">View your active AIs</div>
            </div>
          </button>

          {/* Become a Creator (only if not creator) */}
          {!isCreator && (
            <>
              <div className="my-1 h-px bg-border" />
              <button
                onClick={() => {
                  nav('/onboarding/quiz');
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted transition-colors text-left bg-primary/5 hover:bg-primary/10"
              >
                <Sparkles className="w-4 h-4 text-primary" />
                <div>
                  <div className="font-medium text-primary">Become a Creator</div>
                  <div className="text-xs text-muted-foreground">Create your AI clone</div>
                </div>
              </button>
            </>
          )}

          <div className="my-1 h-px bg-border" />

          {/* Settings */}
          <button
            onClick={() => {
              nav('/settings');
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted transition-colors text-left"
          >
            <Settings className="w-4 h-4" />
            <div className="font-medium">Settings</div>
          </button>
        </div>
      )}
    </div>
  );
}
