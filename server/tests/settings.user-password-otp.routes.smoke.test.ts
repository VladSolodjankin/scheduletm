import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { WebUserRole } from '../src/types/webUserRole.js';
import { hashPassword } from '../src/utils/crypto.js';

const resolveUserByAccessTokenMock = vi.hoisted(() => vi.fn());
const findWebUserByIdMock = vi.hoisted(() => vi.fn());
const updateWebUserAuthStateMock = vi.hoisted(() => vi.fn());
const updateWebUserCredentialsMock = vi.hoisted(() => vi.fn());
const sendEmailVerificationEmailMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/authService.js', () => ({
  resolveUserByAccessToken: resolveUserByAccessTokenMock,
}));

vi.mock('../src/repositories/webUserRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/webUserRepository.js')>(
    '../src/repositories/webUserRepository.js',
  );
  return {
    ...actual,
    findWebUserById: findWebUserByIdMock,
    updateWebUserAuthState: updateWebUserAuthStateMock,
    updateWebUserCredentials: updateWebUserCredentialsMock,
  };
});

vi.mock('../src/services/emailDeliveryService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/emailDeliveryService.js')>(
    '../src/services/emailDeliveryService.js',
  );
  return { ...actual, sendEmailVerificationEmail: sendEmailVerificationEmailMock };
});

const authedUser = {
  id: '101',
  accountId: 1,
  email: 'owner@example.com',
  role: WebUserRole.Owner,
  passwordSalt: 'salt',
  passwordHash: 'hash',
  createdAt: '2026-04-22T09:00:00.000Z',
};

const passwordSalt = 'user-salt';
const code = '1234';

function webUserRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 101,
    account_id: 1,
    email: 'owner@example.com',
    first_name: 'Owner',
    password_salt: passwordSalt,
    password_hash: hashPassword('OldPass1', passwordSalt),
    email_verification_code: hashPassword(code, passwordSalt),
    email_verification_sent_at: new Date(),
    ...overrides,
  };
}

describe('settings user password OTP routes', () => {
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
    findWebUserByIdMock.mockReset().mockResolvedValue(webUserRow());
    updateWebUserAuthStateMock.mockReset().mockResolvedValue(undefined);
    updateWebUserCredentialsMock.mockReset().mockResolvedValue(undefined);
    sendEmailVerificationEmailMock.mockReset().mockResolvedValue(true);
  });

  it('rejects a confirm payload with a weak new password before touching the code', async () => {
    const response = await fetch(`${baseUrl}/api/settings/user/password/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
      body: JSON.stringify({ password: 'weak', code }),
    });
    expect(response.status).toBe(400);
    expect(updateWebUserCredentialsMock).not.toHaveBeenCalled();
  });

  it('confirms and updates credentials with a fresh, matching code', async () => {
    const response = await fetch(`${baseUrl}/api/settings/user/password/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
      body: JSON.stringify({ password: 'SecurePass1', code }),
    });
    expect(response.status).toBe(200);
    expect(updateWebUserCredentialsMock).toHaveBeenCalledWith(1, 101, expect.any(String), expect.any(String));
  });

  it('rejects an expired code even when it matches', async () => {
    findWebUserByIdMock.mockResolvedValue(webUserRow({
      email_verification_sent_at: new Date(Date.now() - 11 * 60 * 1000),
    }));

    const response = await fetch(`${baseUrl}/api/settings/user/password/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
      body: JSON.stringify({ password: 'SecurePass1', code }),
    });
    expect(response.status).toBe(400);
    expect(updateWebUserCredentialsMock).not.toHaveBeenCalled();
  });

  it('rejects a wrong code', async () => {
    const response = await fetch(`${baseUrl}/api/settings/user/password/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
      body: JSON.stringify({ password: 'SecurePass1', code: '0000' }),
    });
    expect(response.status).toBe(400);
    expect(updateWebUserCredentialsMock).not.toHaveBeenCalled();
  });
});
