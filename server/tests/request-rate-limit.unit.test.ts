import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const getRedisClientMock = vi.hoisted(() => vi.fn());
const trackServerErrorMock = vi.hoisted(() => vi.fn());

vi.mock('../src/lib/redisClient.js', () => ({
  getRedisClient: getRedisClientMock,
}));
vi.mock('../src/services/errorTrackingService.js', () => ({
  trackServerError: trackServerErrorMock,
}));

const { createRequestRateLimit } = await import('../src/middlewares/requestRateLimit.js');

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    ip: '10.0.0.1',
    method: 'POST',
    path: '/test',
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(): Response {
  const res: Partial<Response> = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as Response;
}

describe('createRequestRateLimit', () => {
  beforeEach(() => {
    getRedisClientMock.mockReset();
    trackServerErrorMock.mockReset().mockResolvedValue(undefined);
  });

  describe('without Redis configured (in-memory fallback)', () => {
    beforeEach(() => {
      getRedisClientMock.mockReturnValue(null);
    });

    it('allows requests under the limit and blocks once exceeded', async () => {
      const limiter = createRequestRateLimit({ keyPrefix: `mem-${Date.now()}`, maxRequests: 2, windowMs: 60_000 });
      const next = vi.fn();

      await limiter(makeReq(), makeRes(), next);
      await limiter(makeReq(), makeRes(), next);
      expect(next).toHaveBeenCalledTimes(2);

      const res = makeRes();
      await limiter(makeReq(), res, next);
      expect(next).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    });
  });

  describe('with Redis configured', () => {
    it('allows the request when the incremented counter is within the limit', async () => {
      const evalMock = vi.fn().mockResolvedValue(1);
      const pttlMock = vi.fn();
      getRedisClientMock.mockReturnValue({ eval: evalMock, pttl: pttlMock });

      const limiter = createRequestRateLimit({ keyPrefix: 'redis-ok', maxRequests: 5, windowMs: 60_000 });
      const next = vi.fn();
      const res = makeRes();

      await limiter(makeReq(), res, next);

      expect(evalMock).toHaveBeenCalledWith(expect.stringContaining('INCR'), 1, 'rate-limit:redis-ok:10.0.0.1', '60000');
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('rejects with Retry-After once the counter exceeds the limit', async () => {
      const evalMock = vi.fn().mockResolvedValue(6);
      const pttlMock = vi.fn().mockResolvedValue(15_000);
      getRedisClientMock.mockReturnValue({ eval: evalMock, pttl: pttlMock });

      const limiter = createRequestRateLimit({ keyPrefix: 'redis-blocked', maxRequests: 5, windowMs: 60_000 });
      const next = vi.fn();
      const res = makeRes();

      await limiter(makeReq(), res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '15');
    });

    it('fails open and reports the error when Redis is unreachable', async () => {
      const evalMock = vi.fn().mockRejectedValue(new Error('connection refused'));
      getRedisClientMock.mockReturnValue({ eval: evalMock, pttl: vi.fn() });

      const limiter = createRequestRateLimit({ keyPrefix: 'redis-down', maxRequests: 5, windowMs: 60_000 });
      const next = vi.fn();
      const res = makeRes();

      await limiter(makeReq(), res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
      expect(trackServerErrorMock).toHaveBeenCalledWith(expect.objectContaining({
        method: 'POST',
        path: '/test',
      }));
    });
  });
});
