import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebUserRole } from '../src/types/webUserRole.js';
import type { User } from '../src/types/domain.js';

const listByAccountMock = vi.hoisted(() => vi.fn());
const listAllAccountsMock = vi.hoisted(() => vi.fn());
const findByIdAnyAccountMock = vi.hoisted(() => vi.fn());
const findByIdMock = vi.hoisted(() => vi.fn());
const updateProfileMock = vi.hoisted(() => vi.fn());
const cancelDeletionMock = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/webUserRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/webUserRepository.js')>(
    '../src/repositories/webUserRepository.js',
  );
  return {
    ...actual,
    listWebUsersByAccount: listByAccountMock,
    listWebUsersAllAccounts: listAllAccountsMock,
    findWebUserByIdAnyAccount: findByIdAnyAccountMock,
    findWebUserById: findByIdMock,
    updateWebUserProfile: updateProfileMock,
    cancelWebUserDeletion: cancelDeletionMock,
  };
});

const { listManagedUsers, updateManagedUser } = await import('../src/services/userManagementService.js');

const actor = (role: WebUserRole, accountId = 7): User => ({
  id: '1',
  accountId,
  email: `${role}@example.com`,
  role,
  passwordHash: 'hash',
  passwordSalt: 'salt',
  createdAt: '2026-01-01T00:00:00.000Z',
});

const record = {
  id: 2,
  account_id: 7,
  email: 'admin@example.com',
  role: WebUserRole.Admin,
  first_name: 'Account',
  last_name: 'Admin',
  phone: null,
  telegram_username: null,
  is_active: true,
  email_verified_at: new Date('2026-01-01T00:00:00.000Z'),
  phone_verified_at: null,
  delete_scheduled_at: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
};

describe('managed-user list scope', () => {
  beforeEach(() => {
    listByAccountMock.mockReset().mockResolvedValue([record]);
    listAllAccountsMock.mockReset().mockResolvedValue([record]);
    findByIdAnyAccountMock.mockReset();
    findByIdMock.mockReset();
    updateProfileMock.mockReset().mockResolvedValue(undefined);
    cancelDeletionMock.mockReset().mockResolvedValue(undefined);
  });

  it.each([WebUserRole.Owner, WebUserRole.Admin])(
    'keeps %s within its own account',
    async (role) => {
      await expect(listManagedUsers(actor(role))).resolves.toHaveLength(1);

      expect(listByAccountMock).toHaveBeenCalledWith(7);
      expect(listAllAccountsMock).not.toHaveBeenCalled();
    },
  );

  it('gives product owners the global user directory', async () => {
    await expect(listManagedUsers(actor(WebUserRole.ProductOwner))).resolves.toHaveLength(1);

    expect(listAllAccountsMock).toHaveBeenCalledOnce();
    expect(listByAccountMock).not.toHaveBeenCalled();
  });

  it('lets product owners update a user in the user account, not the actor account', async () => {
    const foreignRecord = { ...record, account_id: 42 };
    findByIdAnyAccountMock.mockResolvedValue(foreignRecord);
    findByIdMock.mockResolvedValue(foreignRecord);

    await expect(updateManagedUser(actor(WebUserRole.ProductOwner), foreignRecord.id, {
      email: foreignRecord.email,
      role: 'admin',
      firstName: 'Updated',
      lastName: 'Admin',
    })).resolves.toMatchObject({ id: foreignRecord.id, firstName: 'Account' });

    expect(findByIdAnyAccountMock).toHaveBeenCalledWith(foreignRecord.id);
    expect(findByIdMock).toHaveBeenCalledWith(42, foreignRecord.id);
    expect(updateProfileMock).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 42,
      id: foreignRecord.id,
    }));
    expect(cancelDeletionMock).toHaveBeenCalledWith(42, foreignRecord.id);
  });
});
