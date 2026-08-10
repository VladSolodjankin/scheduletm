import { describe, expect, it, vi } from 'vitest';
import {
  createWebhookRateLimiter,
  getWebhookRateLimitKey,
} from '../webhook-rate-limiter';

function responseMock() {
  const response: any = {};
  response.setHeader = vi.fn();
  response.status = vi.fn(() => response);
  response.json = vi.fn(() => response);
  return response;
}

describe('webhook rate limiter', () => {
  it('limits an IP in a fixed window and returns Retry-After', () => {
    let now = 1_000;
    const middleware = createWebhookRateLimiter(2, 5_000, false, () => now);
    const request = { ip: '203.0.113.1', params: { secret: 'account-a-secret' } } as any;
    const response = responseMock();
    const next = vi.fn();

    middleware(request, response, next);
    middleware(request, response, next);
    middleware(request, response, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '5');

    now = 6_000;
    middleware(request, response, next);
    expect(next).toHaveBeenCalledTimes(3);
  });

  it('keeps separate windows for separate IPs', () => {
    const middleware = createWebhookRateLimiter(1, 1_000, true, () => 0);
    const next = vi.fn();
    middleware(
      { ip: '203.0.113.1', params: { secret: 'account-a-secret' } } as any,
      responseMock(),
      next,
    );
    middleware(
      { ip: '203.0.113.2', params: { secret: 'account-a-secret' } } as any,
      responseMock(),
      next,
    );
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('keeps separate secret windows behind the same proxy', () => {
    const middleware = createWebhookRateLimiter(1, 1_000, false, () => 0);
    const next = vi.fn();
    const response = responseMock();

    middleware(
      { ip: '10.0.0.1', params: { secret: 'account-a-secret' } } as any,
      response,
      next,
    );
    middleware(
      { ip: '10.0.0.1', params: { secret: 'account-b-secret' } } as any,
      response,
      next,
    );

    expect(next).toHaveBeenCalledTimes(2);
    expect(response.status).not.toHaveBeenCalledWith(429);
  });

  it('uses a one-way key that contains neither the raw secret nor IP', () => {
    const secret = 'raw-account-secret';
    const ip = '203.0.113.9';
    const key = getWebhookRateLimitKey(secret, ip);

    expect(key).not.toContain(secret);
    expect(key).not.toContain(ip);
    expect(key).toMatch(/^webhook:[A-Za-z0-9_-]{43}$/);
  });
});
