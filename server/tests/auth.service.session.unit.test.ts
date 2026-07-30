import { beforeEach, describe, expect, it, vi } from 'vitest';

const findSessionMock = vi.hoisted(() => vi.fn());
const revokeSessionMock = vi.hoisted(() => vi.fn());
const findUserMock = vi.hoisted(() => vi.fn());
const isAccountActiveMock = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/webUserSessionRepository.js', () => ({
  findActiveWebUserSessionByTokenAnyAccount: findSessionMock,
  revokeWebUserSessionByTokenAnyAccount: revokeSessionMock,
  createWebUserSession: vi.fn(),
  deleteWebUserSessionByTokenAnyAccount: vi.fn(),
}));

vi.mock('../src/repositories/webUserRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/webUserRepository.js')>(
    '../src/repositories/webUserRepository.js',
  );
  return { ...actual, findWebUserById: findUserMock };
});

vi.mock('../src/repositories/accountRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/accountRepository.js')>(
    '../src/repositories/accountRepository.js',
  );
  return { ...actual, isAccountActive: isAccountActiveMock };
});

const { refreshAccess, resolveUserByAccessToken } = await import('../src/services/authService.js');

const session = {
  account_id: 7,
  web_user_id: 42,
};

const user = {
  id: 42,
  account_id: 7,
  email: 'owner@example.com',
  role: 'owner',
  password_salt: 'salt',
  password_hash: 'hash',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  is_active: true,
  is_deleted: false,
};

describe('auth session account validation', () => {
  beforeEach(() => {
    findSessionMock.mockReset().mockResolvedValue(session);
    findUserMock.mockReset().mockResolvedValue(user);
    isAccountActiveMock.mockReset().mockResolvedValue(true);
    revokeSessionMock.mockReset().mockResolvedValue(undefined);
  });

  it('resolves an access token using the account id from its session', async () => {
    await expect(resolveUserByAccessToken('access-token')).resolves.toMatchObject({
      id: '42',
      accountId: 7,
    });
    expect(findUserMock).toHaveBeenCalledWith(7, 42);
  });

  it('rejects an access token when its account is inactive', async () => {
    isAccountActiveMock.mockResolvedValue(false);

    await expect(resolveUserByAccessToken('access-token')).resolves.toBeNull();
  });

  it('rejects refresh for a missing user without revoking the session', async () => {
    findUserMock.mockResolvedValue(null);

    await expect(refreshAccess('refresh-token')).resolves.toBeNull();
    expect(revokeSessionMock).not.toHaveBeenCalled();
  });

  it('rejects refresh for an inactive account without revoking the session', async () => {
    isAccountActiveMock.mockResolvedValue(false);

    await expect(refreshAccess('refresh-token')).resolves.toBeNull();
    expect(revokeSessionMock).not.toHaveBeenCalled();
  });
});
