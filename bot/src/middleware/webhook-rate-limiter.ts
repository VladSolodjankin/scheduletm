import type { RequestHandler } from 'express';
import { createHash } from 'node:crypto';

type WindowEntry = { count: number; resetAt: number };

export function getWebhookRateLimitKey(secret: string, ip?: string): string {
  const digest = createHash('sha256')
    .update(secret)
    .update('\0')
    .update(ip ?? '')
    .digest('base64url');
  return `webhook:${digest}`;
}

export function createWebhookRateLimiter(
  limit: number,
  windowMs: number,
  includeTrustedIp = false,
  now: () => number = Date.now,
): RequestHandler {
  const windows = new Map<string, WindowEntry>();
  const maxEntries = Math.max(100, limit * 10);

  return (req, res, next) => {
    const currentTime = now();
    const key = getWebhookRateLimitKey(
      String(req.params.secret ?? ''),
      includeTrustedIp ? req.ip : undefined,
    );
    let entry = windows.get(key);

    if (!entry || entry.resetAt <= currentTime) {
      entry = { count: 0, resetAt: currentTime + windowMs };
      windows.set(key, entry);
    }

    entry.count += 1;
    if (entry.count > limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - currentTime) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({ ok: false, error: 'Too Many Requests' });
      return;
    }

    // Bound memory without a background timer: expired windows are removed during traffic.
    if (windows.size > maxEntries) {
      for (const [storedKey, storedEntry] of windows) {
        if (storedEntry.resetAt <= currentTime) windows.delete(storedKey);
      }
      while (windows.size > maxEntries) {
        const oldestKey = windows.keys().next().value as string | undefined;
        if (oldestKey === undefined) break;
        windows.delete(oldestKey);
      }
    }
    next();
  };
}
