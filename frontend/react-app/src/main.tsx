import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'

// Initialize Sentry (error tracking) - DISABLED by default
const sentryDsn = (import.meta.env.VITE_SENTRY_DSN || '').trim()
const sentryEnabled =
  import.meta.env.MODE === 'production' &&
  import.meta.env.VITE_ENABLE_SENTRY === 'true' &&
  sentryDsn &&
  sentryDsn.startsWith('https://') &&
  !sentryDsn.includes('your-sentry-dsn') &&
  !sentryDsn.includes('project-id')

if (sentryEnabled) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
}

// ✅ A1: Global error handler for unhandled errors
window.addEventListener('error', (event) => {
  // Report to backend error logging
  fetch('/api/admin/errors/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      message: event.message || 'Unhandled error',
      stack: `${event.filename}:${event.lineno}:${event.colno}`,
      source: 'frontend',
      severity: 'error',
      meta: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.toString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      },
    }),
  }).catch(() => {
    // Silently fail
  });
});

// ✅ A1: Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
  
  fetch('/api/admin/errors/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      message: error.message || 'Unhandled promise rejection',
      stack: error.stack || '',
      source: 'frontend',
      severity: 'error',
      meta: {
        reason: String(event.reason),
        userAgent: navigator.userAgent,
        url: window.location.href,
      },
    }),
  }).catch(() => {
    // Silently fail
  });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
