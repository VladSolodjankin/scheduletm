import axios from 'axios';

const runtimeOrigin = typeof window === 'undefined' ? undefined : window.location.origin;

function normalizeBaseUrl(rawBaseUrl?: string): string | undefined {
  if (!rawBaseUrl) {
    return rawBaseUrl;
  }

  return rawBaseUrl.replace(/\/+$/, '');
}

const baseURL = normalizeBaseUrl(import.meta.env.VITE_API_URL ?? runtimeOrigin ?? 'http://localhost:3003');

export const apiClient = axios.create({
  baseURL,
  withCredentials: true
});

let unauthorizedHandler: (() => void) | null = null;
let accessTokenRefreshedHandler: ((token: string) => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function setAccessTokenRefreshedHandler(handler: ((token: string) => void) | null) {
  accessTokenRefreshedHandler = handler;
}

function readCookie(name: string): string {
  if (typeof document === 'undefined') {
    return '';
  }

  const parts = document.cookie.split(';').map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`));
  if (!match) {
    return '';
  }

  return decodeURIComponent(match.slice(name.length + 1));
}

function readAuthCsrfCookie(): string {
  if (typeof document === 'undefined') {
    return '';
  }

  const entries = document.cookie.split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eqIndex = part.indexOf('=');
      if (eqIndex <= 0) {
        return null;
      }

      return {
        name: part.slice(0, eqIndex),
        value: decodeURIComponent(part.slice(eqIndex + 1)),
      };
    })
    .filter((entry): entry is { name: string; value: string } => Boolean(entry));

  const byName = new Map(entries.map((entry) => [entry.name, entry.value]));
  const csrfEntry = entries.find((entry) => entry.name.endsWith('_csrf') && byName.has(entry.name.slice(0, -5)));
  return csrfEntry?.value ?? '';
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const csrfToken = readAuthCsrfCookie() || readCookie('scheduletm_refresh_csrf') || readCookie('meetli_refresh_token_csrf');
      const response = await apiClient.post<{ accessToken: string }>(
        '/api/auth/refresh',
        {},
        {
          headers: csrfToken ? { 'x-csrf-token': csrfToken } : undefined,
          ...( { skipAuthRefresh: true } as Record<string, unknown>),
        }
      );
      return response.data.accessToken;
    })()
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function tryRefreshAccessToken(): Promise<string | null> {
  return refreshAccessToken();
}

apiClient.interceptors.request.use((config) => {
  const url = config.url ?? '';
  const normalizedBaseUrl = config.baseURL?.replace(/\/+$/, '') ?? '';

  if (normalizedBaseUrl.endsWith('/api') && url.startsWith('/api/')) {
    return {
      ...config,
      url: url.replace(/^\/api/, '')
    };
  }

  return config;
});

apiClient.interceptors.response.use((response) => {
  const contentType = String(response.headers['content-type'] ?? '');

  if (contentType.includes('text/html')) {
    throw new Error(
      'API returned HTML instead of JSON. Check VITE_API_URL and reverse proxy settings for /api routes.'
    );
  }

  return response;
}, async (error) => {
  const originalRequest = error?.config as (Record<string, unknown> & { headers?: Record<string, string> }) | undefined;
  const status = error?.response?.status;
  const url = String(originalRequest?.url ?? '');

  if (status === 401 && !originalRequest?.skipAuthRefresh && !originalRequest?._retry && !url.includes('/api/auth/refresh')) {
    originalRequest._retry = true;
    const nextAccessToken = await refreshAccessToken();
    if (nextAccessToken) {
      accessTokenRefreshedHandler?.(nextAccessToken);
      originalRequest.headers = {
        ...(originalRequest.headers ?? {}),
        Authorization: `Bearer ${nextAccessToken}`,
      };
      return apiClient.request(originalRequest);
    }
  }

  if (status === 401) {
    unauthorizedHandler?.();
  }

  return Promise.reject(error);
});

export const authHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`
});
