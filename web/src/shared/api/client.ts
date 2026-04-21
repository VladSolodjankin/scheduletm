import axios from 'axios';

const runtimeOrigin = typeof window === 'undefined' ? undefined : window.location.origin;

function normalizeBaseUrl(rawBaseUrl?: string): string | undefined {
  if (!rawBaseUrl) {
    return rawBaseUrl;
  }

  return rawBaseUrl.replace(/\/+$/, '');
}

const baseURL = normalizeBaseUrl(import.meta.env.VITE_API_URL ?? runtimeOrigin ?? 'http://localhost:3000');

export const apiClient = axios.create({
  baseURL,
  withCredentials: true
});

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
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
}, (error) => {
  if (error?.response?.status === 401) {
    unauthorizedHandler?.();
  }

  return Promise.reject(error);
});

export const authHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`
});
