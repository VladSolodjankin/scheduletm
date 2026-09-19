import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '../src/utils/crypto.js';

const findByIdMock = vi.hoisted(() => vi.fn());
const findByEmailAnyAccountMock = vi.hoisted(() => vi.fn());
const createChallengeMock = vi.hoisted(() => vi.fn());
const confirmEmailChangeChallengeMock = vi.hoisted(() => vi.fn());
const sendEmailChangeVerificationEmailMock = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/webUserRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/webUserRepository.js')>(
    '../src/repositories/webUserRepository.js',
  );
  return { ...actual, findWebUserById: findByIdMock, findWebUserByEmailAnyAccount: findByEmailAnyAccountMock };
});

vi.mock('../src/repositories/emailChangeRepository.js', () => ({
  createEmailChangeChallenge: createChallengeMock,
  confirmEmailChange: confirmEmailChangeChallengeMock,
}));

vi.mock('../src/services/emailDeliveryService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/emailDeliveryService.js')>(
    '../src/services/emailDeliveryService.js',
  );
  return { ...actual, sendEmailChangeVerificationEmail: sendEmailChangeVerificationEmailMock };
});

const { requestEmailChange, confirmEmailChange } = await import('../src/services/authService.js');

const passwordSalt = 'salt';
const currentPassword = 'CurrentPass1';

const user = {
  id: 42,
  account_id: 7,
  email: 'owner@example.com',
  first_name: 'Owner',
  password_salt: passwordSalt,
  password_hash: hashPassword(currentPassword, passwordSalt),
};

const actor = { id: '42', accountId: 7 };

describe('email change service', () => {
  beforeEach(() => {
    findByIdMock.mockReset().mockResolvedValue(user);
    findByEmailAnyAccountMock.mockReset().mockResolvedValue(null);
    createChallengeMock.mockReset().mockResolvedValue(true);
    confirmEmailChangeChallengeMock.mockReset().mockResolvedValue(true);
    sendEmailChangeVerificationEmailMock.mockReset().mockResolvedValue(true);
  });

  it('rejects the request when the current password is wrong', async () => {
    await expect(requestEmailChange(actor, 'new@example.com', 'WrongPass1')).resolves.toBe('invalid_password');
    expect(createChallengeMock).not.toHaveBeenCalled();
    expect(sendEmailChangeVerificationEmailMock).not.toHaveBeenCalled();
  });

  it('rejects a new email identical to the current one', async () => {
    await expect(requestEmailChange(actor, 'OWNER@example.com', currentPassword)).resolves.toBe('email_taken');
    expect(createChallengeMock).not.toHaveBeenCalled();
  });

  it('rejects a new email already used by another account', async () => {
    findByEmailAnyAccountMock.mockResolvedValue({ id: 99 });
    await expect(requestEmailChange(actor, 'taken@example.com', currentPassword)).resolves.toBe('email_taken');
    expect(createChallengeMock).not.toHaveBeenCalled();
  });

  it('reports rate limiting when the repository rejects cooldown/hourly limits', async () => {
    createChallengeMock.mockResolvedValue(false);
    await expect(requestEmailChange(actor, 'new@example.com', currentPassword)).resolves.toBe('rate_limited');
    expect(sendEmailChangeVerificationEmailMock).not.toHaveBeenCalled();
  });

  it('sends a verification code to the new address on success', async () => {
    await expect(requestEmailChange(actor, ' New@Example.com ', currentPassword)).resolves.toBe('ok');
    expect(sendEmailChangeVerificationEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: 'new@example.com',
      verificationCode: expect.stringMatching(/^\d{4}$/),
    }));
    expect(createChallengeMock).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 7,
      webUserId: 42,
      newEmail: 'new@example.com',
    }));
  });

  it('delegates confirmation to the repository', async () => {
    await expect(confirmEmailChange(actor, '1234')).resolves.toBe(true);
    expect(confirmEmailChangeChallengeMock).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 7,
      webUserId: 42,
      code: '1234',
    }));
  });
});
