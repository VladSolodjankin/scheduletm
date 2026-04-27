import type { Request } from 'express';

export const csrfCookieName = (sessionCookieName: string) => `${sessionCookieName}_csrf`;

export const parseCookies = (req: Request) => {
  const header = req.headers.cookie;
  if (!header) {
    return new Map<string, string>();
  }

  const pairs = header.split(';').map((item) => item.trim().split('='));
  const parsed = new Map<string, string>();
  for (const [key, ...rest] of pairs) {
    parsed.set(key, decodeURIComponent(rest.join('=')));
  }
  return parsed;
};
