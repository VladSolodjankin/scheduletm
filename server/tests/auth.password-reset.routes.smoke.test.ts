import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';

const requestResetMock = vi.hoisted(() => vi.fn());
const resetPasswordMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/authService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/authService.js')>('../src/services/authService.js');
  return { ...actual, requestPasswordReset: requestResetMock, resetPassword: resetPasswordMock };
});

describe('password reset routes', () => {
  const app = createApp();
  let baseUrl = '';
  let server: Awaited<ReturnType<typeof app.listen>>;

  beforeAll(async () => {
    server = await new Promise((resolve) => {
      const started = app.listen(0, () => resolve(started));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  beforeEach(() => {
    requestResetMock.mockReset().mockResolvedValue(undefined);
    resetPasswordMock.mockReset().mockResolvedValue(true);
  });

  it('returns the same 200 response when request delivery fails', async () => {
    requestResetMock.mockRejectedValue(new Error('delivery failed'));
    const response = await fetch(`${baseUrl}/api/auth/password-reset/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com' }),
    });
    expect(response.status).toBe(200);
  });

  it('returns before password reset processing completes', async () => {
    requestResetMock.mockImplementation(() => new Promise(() => undefined));
    const response = await fetch(`${baseUrl}/api/auth/password-reset/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com' }),
    });
    expect(response.status).toBe(200);
    expect(requestResetMock).toHaveBeenCalledWith('owner@example.com');
  });

  it('rejects malformed request email before service execution', async () => {
    const response = await fetch(`${baseUrl}/api/auth/password-reset/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'invalid' }),
    });
    expect(response.status).toBe(400);
    expect(requestResetMock).not.toHaveBeenCalled();
  });

  it('returns generic 400 for an invalid or expired challenge', async () => {
    resetPasswordMock.mockResolvedValue(false);
    const response = await fetch(`${baseUrl}/api/auth/password-reset/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com', code: '1234', password: 'SecurePass1' }),
    });
    expect(response.status).toBe(400);
  });

  it('confirms password reset without issuing a session', async () => {
    const response = await fetch(`${baseUrl}/api/auth/password-reset/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com', code: '1234', password: 'SecurePass1' }),
    });
    expect(response.status).toBe(200);
    expect(resetPasswordMock).toHaveBeenCalledWith('owner@example.com', '1234', 'SecurePass1');
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
