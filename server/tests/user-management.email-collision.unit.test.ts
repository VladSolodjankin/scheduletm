import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebUserRole } from '../src/types/webUserRole.js';
import type { User } from '../src/types/domain.js';

const findByEmailAnyAccountMock = vi.hoisted(() => vi.fn());
const findByIdMock = vi.hoisted(() => vi.fn());
const createWebUserMock = vi.hoisted(() => vi.fn());
const updateProfileMock = vi.hoisted(() => vi.fn());
const cancelDeletionMock = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/webUserRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/webUserRepository.js')>(
    '../src/repositories/webUserRepository.js',
  );
  return {
    ...actual,
    findWebUserByEmailAnyAccount: findByEmailAnyAccountMock,
    findWebUserById: findByIdMock,
    createWebUser: createWebUserMock,
    updateWebUserProfile: updateProfileMock,
    cancelWebUserDeletion: cancelDeletionMock,
  };
});

vi.mock('../src/services/emailDeliveryService.js', () => ({
  sendManagedUserInviteEmail: vi.fn().mockResolvedValue(undefined),
}));

const { createManagedUser, updateManagedUser } = await import('../src/services/userManagementService.js');

const actor: User = {
  id: '1',
  accountId: 7,
  email: 'owner@example.com',
  role: WebUserRole.Owner,
  passwordHash: 'hash',
  passwordSalt: 'salt',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const foreignAccountRecord = {
  id: 99,
  account_id: 42,
  email: 'shared@example.com',
  role: WebUserRole.Client,
  first_name: 'Foreign',
  last_name: 'User',
  phone: null,
  telegram_username: null,
  is_active: true,
  email_verified_at: new Date('2026-01-01T00:00:00.000Z'),
  phone_verified_at: null,
  delete_scheduled_at: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
};

describe('managed-user email collision across accounts', () => {
  beforeEach(() => {
    findByEmailAnyAccountMock.mockReset();
    findByIdMock.mockReset();
    createWebUserMock.mockReset();
    updateProfileMock.mockReset().mockResolvedValue(undefined);
    cancelDeletionMock.mockReset().mockResolvedValue(undefined);
  });

  it('refuses to invite a user whose email already exists in another account', async () => {
    findByEmailAnyAccountMock.mockResolvedValue(foreignAccountRecord);

    await expect(createManagedUser(actor, {
      email: foreignAccountRecord.email,
      role: 'specialist',
      firstName: 'New',
      lastName: 'Specialist',
    })).rejects.toThrow('EMAIL_IN_USE');

    expect(findByEmailAnyAccountMock).toHaveBeenCalledWith(foreignAccountRecord.email);
    expect(createWebUserMock).not.toHaveBeenCalled();
  });

  it('refuses to update a managed user to an email that exists in another account', async () => {
    const existingInActorAccount = { ...foreignAccountRecord, id: 5, account_id: actor.accountId, email: 'old@example.com' };
    findByIdMock.mockResolvedValue(existingInActorAccount);
    findByEmailAnyAccountMock.mockResolvedValue(foreignAccountRecord);

    await expect(updateManagedUser(actor, existingInActorAccount.id, {
      email: foreignAccountRecord.email,
      role: 'specialist',
      firstName: 'Updated',
      lastName: 'User',
    })).rejects.toThrow('EMAIL_IN_USE');

    expect(findByEmailAnyAccountMock).toHaveBeenCalledWith(foreignAccountRecord.email);
    expect(updateProfileMock).not.toHaveBeenCalled();
  });
});
