import { Component, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
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
      // Redirect to appropriate error page based on status
      if (this.state.status === 403) {
        return <Navigate to="/403" replace />;
      }
      if (this.state.status === 404) {
        return <Navigate to="/404" replace />;
      }
      // Default to 404 for unknown errors
      return <Navigate to="/404" replace />;
    }

    return this.props.children;
  }
}

