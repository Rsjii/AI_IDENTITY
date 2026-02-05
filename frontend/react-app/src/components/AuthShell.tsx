import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut } from 'lucide-react';

export function AuthShell({ 
  children, 
  title, 
  subtitle,
  showLogout = false,
  showBackToHome = true 
}: { 
  children: ReactNode; 
  title: string; 
  subtitle?: string;
  showLogout?: boolean;
  showBackToHome?: boolean;
}) {
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/25 bg-blob" />
        <div className="absolute left-10 bottom-10 h-64 w-64 rounded-full bg-primary/15 bg-blob" />
      </div>

      {showLogout && (
        <div className="absolute top-4 right-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      )}

      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-xl font-bold tracking-tight">
            Selflyx<span className="text-primary">.</span>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div> : null}
        </div>

        {children}

        {showBackToHome && (
          <div className="mt-6 text-center">
            <Button variant="link" className="text-sm" onClick={() => window.location.href = '/'}>
              ← Back to home
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}