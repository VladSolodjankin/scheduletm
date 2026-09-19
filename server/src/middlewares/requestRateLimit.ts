import type { NextFunction, Request, Response } from 'express';
import { t } from '../i18n/index.js';
import { getRedisClient } from '../lib/redisClient.js';
import { trackServerError } from '../services/errorTrackingService.js';

type Bucket = { count: number; resetAt: number };

// Only used when REDIS_URL is not configured (single-instance deployments).
// Not correct across multiple instances — see the Redis-backed path below.
const memoryBuckets = new Map<string, Bucket>();

type RateLimitInput = {
  keyPrefix: string;
  maxRequests: number;
  windowMs: number;
};

const now = () => Date.now();

function getMemoryBucket(key: string, windowMs: number): Bucket {
  const current = memoryBuckets.get(key);
  const ts = now();

  if (!current || current.resetAt <= ts) {
    const fresh = { count: 0, resetAt: ts + windowMs };
    memoryBuckets.set(key, fresh);
    return fresh;
  }

  return current;
}

function buildRateLimitKey(req: Request, keyPrefix: string) {
  const userId = (req as Request & { user?: { id?: string } }).user?.id;
  const ip = req.ip ?? 'unknown';
  return `${keyPrefix}:${userId ?? ip}`;
}

// Atomically increments the counter and sets its TTL only on the first hit in the
// window, so later requests don't keep pushing the expiry back (fixed window).
const INCR_WITH_WINDOW_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return current
`;

function rejectWithRetryAfter(res: Response, req: Request, retryAfterSeconds: number) {
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryAfterSeconds))));
  return res.status(429).json({ message: t(req, 'tooManyRequests') });
}

export function createRequestRateLimit(input: RateLimitInput) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = buildRateLimitKey(req, input.keyPrefix);
    const redis = getRedisClient();

    if (!redis) {
      const bucket = getMemoryBucket(key, input.windowMs);
      if (bucket.count >= input.maxRequests) {
        return rejectWithRetryAfter(res, req, (bucket.resetAt - now()) / 1000);
      }
      bucket.count += 1;
      return next();
    }

    try {
      const redisKey = `rate-limit:${key}`;
      const count = await redis.eval(
        INCR_WITH_WINDOW_SCRIPT,
        1,
        redisKey,
        String(input.windowMs),
      ) as number;

      if (count > input.maxRequests) {
        const ttlMs = await redis.pttl(redisKey);
        return rejectWithRetryAfter(res, req, (ttlMs > 0 ? ttlMs : input.windowMs) / 1000);
      }

      return next();
    } catch (error) {
      // Redis is the source of truth once configured — never silently fall back to
      // in-process counting, since that would reintroduce the per-instance bug this
      // is meant to fix without anyone noticing. Fail open (allow the request) so a
      // Redis outage degrades rate limiting rather than taking the API down.
      const normalized = error instanceof Error ? error : new Error(String(error));
      console.error('[rate-limit] redis error, failing open', normalized);
      void trackServerError({ method: req.method, path: req.path, error: normalized });
      return next();
    }
  };
}
