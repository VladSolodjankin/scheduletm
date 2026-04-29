import type { NextFunction, Request, Response } from 'express';
import { t } from '../i18n/index.js';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

type RateLimitInput = {
  keyPrefix: string;
  maxRequests: number;
  windowMs: number;
};

const now = () => Date.now();

function getBucket(key: string, windowMs: number): Bucket {
  const current = buckets.get(key);
  const ts = now();

  if (!current || current.resetAt <= ts) {
    const fresh = { count: 0, resetAt: ts + windowMs };
    buckets.set(key, fresh);
    return fresh;
  }

  return current;
}

function buildRateLimitKey(req: Request, keyPrefix: string) {
  const userId = (req as Request & { user?: { id?: string } }).user?.id;
  const ip = req.ip ?? 'unknown';
  return `${keyPrefix}:${userId ?? ip}`;
}

export function createRequestRateLimit(input: RateLimitInput) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = buildRateLimitKey(req, input.keyPrefix);
    const bucket = getBucket(key, input.windowMs);

    if (bucket.count >= input.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now()) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ message: t(req, 'tooManyRequests') });
    }

    bucket.count += 1;
    return next();
  };
}
