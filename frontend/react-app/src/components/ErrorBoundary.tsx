import { Component, type ReactNode } from 'react';
import { apiFetch } from '@/lib/api';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  status?: number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error & { status?: number }): State {
    return { hasError: true, error, status: error.status };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught:', error, errorInfo);

    // Auto-report frontend errors to backend
    this.reportError(error, errorInfo).catch(() => {
      // Silently fail if reporting fails
    });

    // ✅ FIX: Use window.location instead of Navigate to avoid Router context issues
    // Redirect to appropriate error page based on status
    if (this.state.status === 403) {
      window.location.href = '/403';
      return;
    }
    if (this.state.status === 404) {
      window.location.href = '/404';
      return;
    }
    // Default to 404 for unknown errors
    window.location.href = '/404';
  }

  private async reportError(error: Error, errorInfo: any) {
    try {
      // Get userId from localStorage or session if available
      const userId = localStorage.getItem('userId') || undefined;

      await apiFetch('/api/admin/errors/log', {
        method: 'POST',
        body: JSON.stringify({
          message: error.message || 'Unknown error',
          stack: error.stack || errorInfo.componentStack || '',
          source: 'frontend',
          severity: 'error',
          userId,
          meta: {
            name: error.name,
            componentStack: errorInfo.componentStack,
            errorBoundary: true,
            userAgent: navigator.userAgent,
            url: window.location.href,
          },
        }),
      });
    } catch {
      // Silently fail - don't break the app if error reporting fails
    }
  }

  render() {
    if (this.state.hasError) {
      // Show fallback UI instead of redirecting during render
      return (
        <div className="min-h-screen flex items-center justify-center bg-bg-primary">
          <div className="text-center space-y-4 p-8">
            <h1 className="text-4xl font-bold text-text-primary">Oops!</h1>
            <p className="text-text-secondary">Something went wrong. We're redirecting you...</p>
            <div className="mt-4">
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:opacity-90"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

