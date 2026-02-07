import { getCSRFToken, refreshCSRFToken } from './csrf';

export interface ApiError {
  error: string;
  errorCode?: string;
  details?: any;
  redirect?: string;
  fieldErrors?: Record<string, string>;
  missing?: string[];
  upgradeUrl?: string;
}

// Get API base URL from environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

let refreshInFlight: Promise<void> | null = null;

// Helper to build full API URL
export function buildApiUrl(path: string): string {
  if (API_BASE_URL) {
    // Remove trailing slash from base URL and leading slash from path
    const base = API_BASE_URL.replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
  }
  // Fallback to relative URL (for local dev with proxy)
  return path;
}

/**
 * API fetch wrapper with automatic CSRF token handling
 */
export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {},
  _didRetryAuth = false
): Promise<T> {
  // Get CSRF token for POST/PUT/PATCH/DELETE
  const method = options.method?.toUpperCase() || 'GET';
  const needsCSRF = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  let csrfToken = '';
  if (needsCSRF) {
    try {
      csrfToken = await getCSRFToken();
    } catch (error) {
      console.error('Failed to get CSRF token:', error);
      // Continue without token, backend will return 403
    }
  }

  // Merge headers
  const headers = new Headers(options.headers);
  if (csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }
  headers.set('Content-Type', 'application/json');

  // Make request
  const response = await fetch(buildApiUrl(url), {
    ...options,
    headers,
    credentials: 'include', // Always include cookies (JWT)
  });

  // Handle CSRF errors (retry once)
  if (response.status === 403) {
    const errorData = await response.json().catch(() => ({}));
    if (errorData.errorCode === 'CSRF_INVALID' && needsCSRF) {
      // Refresh token and retry once
      try {
        csrfToken = await refreshCSRFToken();
        headers.set('X-CSRF-Token', csrfToken);
        
        const retryResponse = await fetch(buildApiUrl(url), {
          ...options,
          headers,
          credentials: 'include',
        });

        if (!retryResponse.ok) {
          const retryError = await retryResponse.json().catch(() => ({}));
          const apiErr = new ApiError(
            retryError.error || 'Request failed',
            retryError.errorCode,
            retryError,
            retryError.fieldErrors
          );
          (apiErr as any).missing = retryError.missing;
          (apiErr as any).upgradeUrl = retryError.upgradeUrl;
          (apiErr as any).status = retryResponse.status;
          throw apiErr;
        }

        return retryResponse.json();
      } catch (retryError) {
        throw retryError;
      }
    }
  }

// Handle 401 (Unauthorized) - try refresh once, then fail
if (response.status === 401) {
  const isRefreshCall = url.includes('/api/auth/refresh');

  if (!_didRetryAuth && !isRefreshCall) {
    try {
      if (!refreshInFlight) {
        refreshInFlight = apiFetch(
          '/api/auth/refresh',
          { method: 'POST', body: JSON.stringify({}) },
          true
        )
          .then(() => {})
          .finally(() => {
            refreshInFlight = null;
          });
      }

      await refreshInFlight;

      const retryResponse = await fetch(buildApiUrl(url), {
        ...options,
        headers,
        credentials: 'include',
      });

      if (retryResponse.ok) {
        const ct = retryResponse.headers.get('content-type');
        if (!ct || !ct.includes('application/json')) return {} as T;
        return retryResponse.json();
      }
    } catch {
      // fallthrough
    }
  }


  window.dispatchEvent(new CustomEvent('auth:session-expired'));
  const errorData = await response.json().catch(() => ({
    error: 'Session expired. Please login again.',
  }));
  const apiError = new Error(errorData.error || 'Session expired') as Error & ApiError & { status: number };
  apiError.errorCode = 'UNAUTHORIZED';
  apiError.status = 401;
  throw apiError;
}  

  // Handle other errors
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      error: `HTTP ${response.status}: ${response.statusText}`,
    }));

    const apiError = new Error(errorData.error || 'Request failed') as Error & ApiError & { status: number };
    apiError.errorCode = errorData.errorCode;
    apiError.details = errorData.details;
    apiError.redirect = errorData.redirect;
    apiError.fieldErrors = errorData.fieldErrors;
    // ✅ ADD: preserve backend extra fields (for publish prerequisites, etc.)
    (apiError as any).missing = errorData.missing;
    (apiError as any).upgradeUrl = errorData.upgradeUrl;
    (apiError as any).status = response.status; // Add status for 404 checks
    throw apiError;
  }

  // Handle empty responses
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return {} as T;
  }

  return response.json();
}

// Custom Error class for API errors
export class ApiError extends Error {
  errorCode?: string;
  details?: any;
  redirect?: string;
  fieldErrors?: Record<string, string>;
  missing?: string[];
  upgradeUrl?: string;

  constructor(message: string, errorCode?: string, details?: any, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.errorCode = errorCode;
    this.details = details;
    this.fieldErrors = fieldErrors;
  }
}

/**
 * API fetch wrapper for FormData (file uploads)
 */
export async function apiFetchForm<T = any>(
  url: string,
  options: RequestInit & { body: FormData }
): Promise<T> {
  const method = options.method?.toUpperCase() || 'POST';

  let csrfToken = '';
  try {
    csrfToken = await getCSRFToken();
  } catch {
    // ignore
  }

  const headers = new Headers(options.headers);
  if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  // ✅ IMPORTANT: do NOT set Content-Type here (browser sets multipart boundary)

  const response = await fetch(buildApiUrl(url), {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      error: `HTTP ${response.status}: ${response.statusText}`,
    }));
    const apiError = new Error(errorData.error || 'Request failed') as Error & ApiError;
    apiError.errorCode = errorData.errorCode;
    apiError.details = errorData.details;
    apiError.redirect = errorData.redirect;
    apiError.fieldErrors = errorData.fieldErrors;
    // ✅ ADD: preserve backend extra fields
    (apiError as any).missing = errorData.missing;
    (apiError as any).upgradeUrl = errorData.upgradeUrl;
    (apiError as any).status = response.status;
    throw apiError;
  }

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) return {} as T;
  return response.json();
}

