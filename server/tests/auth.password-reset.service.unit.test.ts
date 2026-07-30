import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUserMock = vi.hoisted(() => vi.fn());
const createChallengeMock = vi.hoisted(() => vi.fn());
const confirmResetMock = vi.hoisted(() => vi.fn());
const sendResetEmailMock = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/webUserRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/webUserRepository.js')>(
    '../src/repositories/webUserRepository.js',
  );
  return { ...actual, findWebUserByEmailAnyAccount: findUserMock };
});

vi.mock('../src/repositories/passwordResetRepository.js', () => ({
  createPasswordResetChallenge: createChallengeMock,
  confirmPasswordReset: confirmResetMock,
}));

vi.mock('../src/services/emailDeliveryService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/emailDeliveryService.js')>(
    '../src/services/emailDeliveryService.js',
  );
  return { ...actual, sendPasswordResetEmail: sendResetEmailMock };
});

const { requestPasswordReset, resetPassword } = await import('../src/services/authService.js');

const eligibleUser = {
  id: 42,
  account_id: 7,
  email: 'owner@example.com',
  first_name: 'Owner',
  locale: 'en',
  is_active: true,
  is_deleted: false,
  email_verified_at: new Date('2026-01-01T00:00:00.000Z'),
};

describe('password reset service', () => {
  beforeEach(() => {
    findUserMock.mockReset().mockResolvedValue(eligibleUser);
    createChallengeMock.mockReset().mockResolvedValue(true);
    confirmResetMock.mockReset().mockResolvedValue(true);
    sendResetEmailMock.mockReset().mockResolvedValue(true);
  });

  it('does not reveal or create a challenge for an unknown user', async () => {
    findUserMock.mockResolvedValue(null);
    await expect(requestPasswordReset('missing@example.com')).resolves.toBeUndefined();
    expect(createChallengeMock).not.toHaveBeenCalled();
    expect(sendResetEmailMock).not.toHaveBeenCalled();
  });

  it('only sends after the repository accepts cooldown and hourly limits', async () => {
    createChallengeMock.mockResolvedValue(false);
    await requestPasswordReset('OWNER@example.com');
    expect(createChallengeMock).toHaveBeenCalledOnce();
    expect(sendResetEmailMock).not.toHaveBeenCalled();
  });

  it('sends a dedicated reset code for an eligible user', async () => {
    await requestPasswordReset(' OWNER@example.com ');
    expect(sendResetEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: 'owner@example.com',
      resetCode: expect.stringMatching(/^\d{4}$/),
    }));
  });

  it('delegates atomic credential update and session revocation to the repository', async () => {
    await expect(resetPassword('owner@example.com', '1234', 'SecurePass1')).resolves.toBe(true);
    expect(confirmResetMock).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 7,
      webUserId: 42,
      code: '1234',
      passwordHash: expect.any(String),
      passwordSalt: expect.any(String),
    }));
  });

  it('rejects reset for an inactive user without touching a challenge', async () => {
    findUserMock.mockResolvedValue({ ...eligibleUser, is_active: false });
    await expect(resetPassword('owner@example.com', '1234', 'SecurePass1')).resolves.toBe(false);
    expect(confirmResetMock).not.toHaveBeenCalled();
  });
});
