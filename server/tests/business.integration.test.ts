import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccount } from '../src/repositories/accountRepository.js';
import { createClient } from '../src/repositories/clientRepository.js';
import { createSpecialist } from '../src/repositories/specialistRepository.js';
import { db } from '../src/db/knex.js';
import { WebUserRole } from '../src/types/webUserRole.js';
import type { User } from '../src/types/domain.js';
import { createManagedUser, listManagedUsers } from '../src/services/userManagementService.js';
import {
  getEffectiveNotificationSetting,
  getAccountNotificationDefaults,
  putAccountNotificationDefaults,
  putSpecialistNotificationSettings,
  putClientNotificationSettings,
} from '../src/services/notificationSettingsService.js';

const sendManagedUserInviteEmailMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('../src/services/emailDeliveryService.js', () => ({
  sendManagedUserInviteEmail: sendManagedUserInviteEmailMock,
}));

const createdAccountIds: number[] = [];

function buildActor(accountId: number, role: WebUserRole): User {
  return {
    id: '1',
    accountId,
    email: `${role}@example.com`,
    role,
    passwordHash: 'hash',
    passwordSalt: 'salt',
    createdAt: new Date().toISOString(),
  };
}

async function createIsolatedAccount(): Promise<number> {
  const scope = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const accountId = await createAccount({
    code: `it-${scope}`,
    name: `Integration ${scope}`,
  });
  createdAccountIds.push(accountId);
  return accountId;
}

afterAll(async () => {
  if (!createdAccountIds.length) {
    await db.destroy();
    return;
  }

  await db('accounts').whereIn('id', createdAccountIds).delete();
  await db.destroy();
});

beforeEach(() => {
  sendManagedUserInviteEmailMock.mockClear();
});

describe('business integration: user management', () => {
  it('owner creates client user and links it to clients table', async () => {
    const accountId = await createIsolatedAccount();
    const actor = buildActor(accountId, WebUserRole.Owner);

    const created = await createManagedUser(actor, {
      email: 'client.integration@example.com',
      role: 'client',
      firstName: 'Client',
      lastName: 'Integration',
      phone: '+1000000001',
      telegramUsername: 'client_it_1',
    });

    expect(created.role).toBe(WebUserRole.Client);
    expect(created.isActive).toBe(false);
    expect(sendManagedUserInviteEmailMock).toHaveBeenCalledOnce();

    const createdWebUser = await db('web_users')
      .where({ account_id: accountId, email: 'client.integration@example.com' })
      .first<{ id: number; client_id: number | null; is_active: boolean }>('id', 'client_id', 'is_active');

    expect(createdWebUser).toBeTruthy();
    expect(createdWebUser?.is_active).toBe(false);
    expect(createdWebUser?.client_id).not.toBeNull();

    const linkedClient = await db('clients')
      .where({ account_id: accountId, id: createdWebUser?.client_id })
      .first<{ id: number; email: string | null }>('id', 'email');

    expect(linkedClient?.email).toBe('client.integration@example.com');
  });

  it('specialist sees only client users in managed list', async () => {
    const accountId = await createIsolatedAccount();
    const owner = buildActor(accountId, WebUserRole.Owner);

    await createManagedUser(owner, {
      email: 'client.only@example.com',
      role: 'client',
      firstName: 'Client',
      lastName: 'Only',
    });

    await createManagedUser(owner, {
      email: 'admin.hidden@example.com',
      role: 'admin',
      firstName: 'Admin',
      lastName: 'Hidden',
    });

    const specialist = buildActor(accountId, WebUserRole.Specialist);
    const managedBySpecialist = await listManagedUsers(specialist);

    expect(managedBySpecialist.length).toBe(1);
    expect(managedBySpecialist[0]?.role).toBe(WebUserRole.Client);
  });
});

describe('business integration: notification settings cascade', () => {
  it('applies account -> specialist settings and client deny list to effective channels', async () => {
    const accountId = await createIsolatedAccount();

    const specialistUserId = await db('web_users')
      .insert({
        account_id: accountId,
        email: 'specialist.integration@example.com',
        password_hash: 'hash',
        password_salt: 'salt',
        role: WebUserRole.Specialist,
        is_active: true,
        first_name: 'Spec',
        last_name: 'Integration',
      })
      .returning<{ id: number }[]>('id')
      .then((rows) => rows[0]!.id);

    const specialistId = await createSpecialist({
      accountId,
      name: 'Spec Integration',
      code: `spec-${accountId}`,
      userId: specialistUserId,
    });

    const client = await createClient({
      accountId,
      firstName: 'Client',
      lastName: 'Cascade',
      email: 'cascade.client@example.com',
    });

    const defaults = await getAccountNotificationDefaults(accountId);
    expect(defaults.some((item) => item.notificationType === 'appointment_reminder')).toBe(true);

    const accountUpdate = await putAccountNotificationDefaults(accountId, {
      items: [
        {
          notificationType: 'appointment_reminder',
          preferredChannel: 'telegram',
          enabled: true,
          sendTimings: ['24h'],
          frequency: 'immediate',
        },
        {
          notificationType: 'appointment_reminder',
          preferredChannel: 'email',
          enabled: true,
          sendTimings: ['24h'],
          frequency: 'immediate',
        },
      ],
    });
    expect(accountUpdate).not.toBeNull();

    const specialistUpdate = await putSpecialistNotificationSettings(accountId, specialistId, {
      items: [
        {
          notificationType: 'appointment_reminder',
          preferredChannel: 'telegram',
          enabled: true,
          sendTimings: ['1h'],
          frequency: 'immediate',
        },
      ],
    });
    expect(specialistUpdate).not.toBeNull();

    const clientUpdate = await putClientNotificationSettings(accountId, client.id, {
      items: [
        {
          notificationType: 'appointment_reminder',
          channel: 'telegram',
          enabled: false,
        },
      ],
    });
    expect(clientUpdate).not.toBeNull();

    const effective = await getEffectiveNotificationSetting({
      accountId,
      specialistId,
      clientId: client.id,
      notificationType: 'appointment_reminder',
    });

    expect(effective).not.toBeNull();
    expect(effective?.preferredChannel).toBe('telegram');
    expect(effective?.deliveryChannels).toEqual([]);
    expect(effective?.enabled).toBe(false);
    expect(effective?.deniedByClient).toBe(true);
  });
});
