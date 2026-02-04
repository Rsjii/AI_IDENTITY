import { buildApiUrl } from './api';

// CSRF token management for React SPA
let csrfToken: string | null = null;
let tokenPromise: Promise<string> | null = null;

/**
 * Fetch CSRF token from backend
 */
async function fetchCSRFToken(): Promise<string> {
  const response = await fetch(buildApiUrl('/api/csrf'), {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch CSRF token');
  }

  // ✅ If API misconfigured and returns HTML, do NOT throw (prevents app crash/noise)
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    return '';
  }

  const data = await response.json().catch(() => ({} as any));
  return data.csrfToken || '';
}

/**
 * Get CSRF token (cached, with auto-refresh)
 */
export async function getCSRFToken(): Promise<string> {
  // Return cached token if available
  if (csrfToken) {
    return csrfToken;
  }

  // If already fetching, wait for that promise
  if (tokenPromise) {
    return tokenPromise;
  }

  // Start new fetch
  tokenPromise = fetchCSRFToken();
  try {
    csrfToken = await tokenPromise;
    return csrfToken;
  } catch (error) {
    tokenPromise = null;
    throw error;
  } finally {
    tokenPromise = null;
  }
}

/**
 * Refresh CSRF token (call this if you get 403 CSRF_INVALID)
 */
export async function refreshCSRFToken(): Promise<string> {
  csrfToken = null;
  tokenPromise = null;
  return getCSRFToken();
}

/**
 * Clear cached token (for logout)
 */
export function clearCSRFToken(): void {
  csrfToken = null;
  tokenPromise = null;
}


