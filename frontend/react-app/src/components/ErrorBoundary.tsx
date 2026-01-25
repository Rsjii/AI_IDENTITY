import { Component, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

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

