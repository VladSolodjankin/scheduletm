const DEFAULT_PUBLIC_PAGE_ORIGIN = 'https://meetli.cc';

function isAllowedHttpHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function resolvePublicPageOrigin(value: unknown, browserOrigin?: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    if (browserOrigin) {
      try {
        const local = new URL(browserOrigin);
        if (isAllowedHttpHost(local.hostname)) {return resolvePublicPageOrigin(browserOrigin);}
      } catch { /* Invalid browser origins use the production default. */ }
    }
    return DEFAULT_PUBLIC_PAGE_ORIGIN;
  }
  try {
    const url = new URL(value.trim());
    const protocolAllowed = url.protocol === 'https:'
      || (url.protocol === 'http:' && isAllowedHttpHost(url.hostname));
    if (
      !protocolAllowed
      || url.username !== ''
      || url.password !== ''
      || url.search !== ''
      || url.hash !== ''
      || url.pathname !== '/'
    ) {
      return DEFAULT_PUBLIC_PAGE_ORIGIN;
    }
    return url.origin;
  } catch {
    return DEFAULT_PUBLIC_PAGE_ORIGIN;
  }
}

export const PUBLIC_PAGE_ORIGIN = resolvePublicPageOrigin(
  import.meta.env.VITE_PUBLIC_PAGE_ORIGIN,
  typeof window === 'undefined' ? undefined : window.location.origin,
);

export function publicPageUrl(slug: string): string {
  return `${PUBLIC_PAGE_ORIGIN}/${encodeURIComponent(slug)}`;
}

export function publicPageDisplayUrl(slug: string): string {
  const origin = new URL(PUBLIC_PAGE_ORIGIN);
  return `${origin.host}/${encodeURIComponent(slug)}`;
}
