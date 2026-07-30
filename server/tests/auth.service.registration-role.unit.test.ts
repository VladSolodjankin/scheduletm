import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebUserRole } from '../src/types/webUserRole.js';

const createAccountMock = vi.hoisted(() => vi.fn());
const createWebUserMock = vi.hoisted(() => vi.fn());
const findByEmailMock = vi.hoisted(() => vi.fn());
const createDefaultSpecialistMock = vi.hoisted(() => vi.fn());
const sendVerificationMock = vi.hoisted(() => vi.fn());
const sendRegistrationSuccessMock = vi.hoisted(() => vi.fn());
const updateCredentialsMock = vi.hoisted(() => vi.fn());
const updateProfileMock = vi.hoisted(() => vi.fn());
const updateAuthStateMock = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/accountRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/accountRepository.js')>(
    '../src/repositories/accountRepository.js',
  );
  return { ...actual, createAccount: createAccountMock };
});

vi.mock('../src/repositories/webUserRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/webUserRepository.js')>(
    '../src/repositories/webUserRepository.js',
  );
  return {
    ...actual,
    createWebUser: createWebUserMock,
    findWebUserByEmailAnyAccount: findByEmailMock,
    updateWebUserCredentials: updateCredentialsMock,
    updateWebUserProfile: updateProfileMock,
    updateWebUserAuthState: updateAuthStateMock,
  };
});

vi.mock('../src/repositories/specialistRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/specialistRepository.js')>(
    '../src/repositories/specialistRepository.js',
  );
  return {
    ...actual,
    createDefaultSpecialistForWebUserIfMissing: createDefaultSpecialistMock,
  };
});

vi.mock('../src/services/emailDeliveryService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/emailDeliveryService.js')>(
    '../src/services/emailDeliveryService.js',
  );
  return {
    ...actual,
    sendEmailVerificationEmail: sendVerificationMock,
    sendRegistrationSuccessEmail: sendRegistrationSuccessMock,
  };
});

const { hashPassword } = await import('../src/utils/crypto.js');
const { acceptInvite, registerUser } = await import('../src/services/authService.js');

describe('registration role', () => {
  beforeEach(() => {
    findByEmailMock.mockReset().mockResolvedValue(null);
    createAccountMock.mockReset().mockResolvedValue(7);
    createWebUserMock.mockReset().mockImplementation(async (input) => ({
      id: 42,
      account_id: input.accountId,
      email: input.email,
      role: input.role,
      password_salt: input.passwordSalt,
      password_hash: input.passwordHash,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
    }));
    createDefaultSpecialistMock.mockReset().mockResolvedValue(undefined);
    sendVerificationMock.mockReset().mockResolvedValue(undefined);
    sendRegistrationSuccessMock.mockReset().mockResolvedValue(undefined);
    updateCredentialsMock.mockReset().mockResolvedValue(undefined);
    updateProfileMock.mockReset().mockResolvedValue(undefined);
    updateAuthStateMock.mockReset().mockResolvedValue(undefined);
  });

  it('creates the first account user as owner', async () => {
    await expect(registerUser('new@example.com', 'password')).resolves.toMatchObject({
      accountId: 7,
      role: WebUserRole.Owner,
    });

    expect(createWebUserMock).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 7,
      role: WebUserRole.Owner,
    }));
  });

  it('persists and emails the submitted name when an unverified registration is resumed', async () => {
    findByEmailMock.mockResolvedValue({
      id: 42,
      account_id: 7,
      email: 'new@example.com',
      role: WebUserRole.Owner,
      first_name: 'Old',
      last_name: 'Name',
      email_verified_at: null,
      password_salt: 'old-salt',
      password_hash: 'old-hash',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
    });

    await registerUser(
      'new@example.com',
      'password',
      'UTC',
      'New',
      'Person',
      undefined,
      '@newperson',
    );

    expect(updateProfileMock).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'New',
      lastName: 'Person',
      telegramUsername: '@newperson',
    }));
    expect(sendVerificationMock).toHaveBeenCalledWith(expect.objectContaining({
      to: 'new@example.com',
      firstName: 'New',
    }));
  });

  it('persists accepted invite profile fields and greets the submitted first name', async () => {
    const token = 'invite-token';
    const salt = 'invite-salt';
    findByEmailMock.mockResolvedValue({
      id: 42,
      account_id: 7,
      email: 'invitee@example.com',
      role: WebUserRole.Specialist,
      first_name: 'Invited',
      last_name: 'Placeholder',
      email_verified_at: null,
      email_verification_code: hashPassword(token, salt),
      email_verification_sent_at: new Date(),
      password_salt: salt,
      password_hash: 'old-hash',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
    });

    await expect(acceptInvite(
      'invitee@example.com',
      token,
      'new-password',
      'Actual',
      'Person',
      '@actual',
    )).resolves.toBe(true);

    expect(updateProfileMock).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Actual',
      lastName: 'Person',
      telegramUsername: '@actual',
      isActive: true,
    }));
    expect(sendRegistrationSuccessMock).toHaveBeenCalledWith({
      to: 'invitee@example.com',
      firstName: 'Actual',
    });
  });
});
