import { useEffect } from 'react';
import { apiClient, authHeaders } from '../shared/api/client';
import { useAuth } from '../shared/auth/AuthContext';

const MAX_TEXT_LENGTH = 2000;

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, MAX_TEXT_LENGTH);
}

export function WebErrorTracker() {
  const { accessToken } = useAuth();

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const postError = (payload: { message: string; stack?: string; path?: string; metadata?: Record<string, unknown> }) => {
      void apiClient.post('/api/error-logs/web', payload, {
        headers: authHeaders(accessToken),
      });
    };

    const onWindowError = (event: ErrorEvent) => {
      const message = normalizeText(event.message || event.error?.message || 'Unhandled window error');
      if (!message) {
        return;
      }

      postError({
        message,
        stack: normalizeText(event.error?.stack),
        path: normalizeText(window.location.pathname),
        metadata: {
          type: 'error',
          filename: normalizeText(event.filename),
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = normalizeText(reason instanceof Error ? reason.message : String(reason));
      if (!message) {
        return;
      }

      postError({
        message,
        stack: normalizeText(reason instanceof Error ? reason.stack : ''),
        path: normalizeText(window.location.pathname),
        metadata: { type: 'unhandledrejection' },
      });
    };

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [accessToken]);

  return null;
}
