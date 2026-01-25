import type { NavigateFunction } from 'react-router-dom';
import { ApiError } from './api';

/**
 * Handle API errors and redirect to appropriate error pages
 */
export function handleApiError(
  error: any,
  navigate: NavigateFunction,
  options?: {
    on403?: () => void;
    on404?: () => void;
    onOther?: (message: string) => void;
  }
): void {
  const status = (error as any)?.status;
  const errorCode = (error as ApiError)?.errorCode;

  // Handle 403 Forbidden
  if (status === 403 || errorCode === 'FORBIDDEN' || errorCode === 'ADMIN_REQUIRED') {
    if (options?.on403) {
      options.on403();
    } else {
      navigate('/403', { replace: true });
    }
    return;
  }

  // Handle 404 Not Found
  if (status === 404 || errorCode === 'NOT_FOUND') {
    if (options?.on404) {
      options.on404();
    } else {
      navigate('/404', { replace: true });
    }
    return;
  }

  // Handle other errors
  if (options?.onOther) {
    options.onOther(error?.message || 'An error occurred');
  }
}

