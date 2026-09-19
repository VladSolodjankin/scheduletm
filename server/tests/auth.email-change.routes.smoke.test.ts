import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const resolveUserByAccessTokenMock = vi.hoisted(() => vi.fn());
const requestEmailChangeMock = vi.hoisted(() => vi.fn());
const confirmEmailChangeMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/authService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/authService.js')>('../src/services/authService.js');
  return {
    ...actual,
    resolveUserByAccessToken: resolveUserByAccessTokenMock,
    requestEmailChange: requestEmailChangeMock,
    confirmEmailChange: confirmEmailChangeMock,
  };
});

const authedUser = {
  id: '42',
  accountId: 7,
  email: 'owner@example.com',
  role: WebUserRole.Owner,
  passwordSalt: 'salt',
  passwordHash: 'hash',
  createdAt: '2026-04-22T09:00:00.000Z',
};

describe('email change routes', () => {
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
    resolveUserByAccessTokenMock.mockReset().mockResolvedValue(authedUser);
    requestEmailChangeMock.mockReset().mockResolvedValue('ok');
    confirmEmailChangeMock.mockReset().mockResolvedValue(true);
  });

  it('requires authentication to request an email change', async () => {
    resolveUserByAccessTokenMock.mockResolvedValue(null);
    const response = await fetch(`${baseUrl}/api/auth/email-change/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
      body: JSON.stringify({ newEmail: 'new@example.com', password: 'CurrentPass1' }),
    });
    expect(response.status).toBe(401);
    expect(requestEmailChangeMock).not.toHaveBeenCalled();
  });

  it('rejects malformed payload before service execution', async () => {
    const response = await fetch(`${baseUrl}/api/auth/email-change/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
      body: JSON.stringify({ newEmail: 'not-an-email', password: '' }),
    });
    expect(response.status).toBe(400);
    expect(requestEmailChangeMock).not.toHaveBeenCalled();
  });

  it('returns 409 when the new email is already in use', async () => {
    requestEmailChangeMock.mockResolvedValue('email_taken');
    const response = await fetch(`${baseUrl}/api/auth/email-change/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
      body: JSON.stringify({ newEmail: 'taken@example.com', password: 'CurrentPass1' }),
    });
    expect(response.status).toBe(409);
  });

  it('returns 400 when the current password is wrong', async () => {
    requestEmailChangeMock.mockResolvedValue('invalid_password');
    const response = await fetch(`${baseUrl}/api/auth/email-change/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
      body: JSON.stringify({ newEmail: 'new@example.com', password: 'WrongPass1' }),
    });
    expect(response.status).toBe(400);
  });

  it('accepts a valid request', async () => {
    const response = await fetch(`${baseUrl}/api/auth/email-change/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
      body: JSON.stringify({ newEmail: 'new@example.com', password: 'CurrentPass1' }),
    });
    expect(response.status).toBe(200);
    expect(requestEmailChangeMock).toHaveBeenCalledWith(authedUser, 'new@example.com', 'CurrentPass1');
  });

  it('returns 400 for an invalid or expired confirmation code', async () => {
    confirmEmailChangeMock.mockResolvedValue(false);
    const response = await fetch(`${baseUrl}/api/auth/email-change/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
      body: JSON.stringify({ code: '1234' }),
    });
    expect(response.status).toBe(400);
  });

  it('confirms the email change', async () => {
    const response = await fetch(`${baseUrl}/api/auth/email-change/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
      body: JSON.stringify({ code: '1234' }),
    });
    expect(response.status).toBe(200);
    expect(confirmEmailChangeMock).toHaveBeenCalledWith(authedUser, '1234');
  });
});
