import type { Knex } from 'knex';
import { db } from '../db/knex.js';
import { deleteAccountById, listAccountsDueForDeletion } from '../repositories/accountRepository.js';
import { listWebUsersDueForDeletion } from '../repositories/webUserRepository.js';

async function deleteAppointmentsForSpecialists(trx: Knex.Transaction, accountId: number, specialistIds: number[]) {
  if (specialistIds.length === 0) {
    return;
  }

  await trx('appointments')
    .where({ account_id: accountId })
    .whereIn('specialist_id', specialistIds)
    .delete();
}

async function deleteAppointmentsForClient(trx: Knex.Transaction, accountId: number, clientId: number | null) {
  if (!clientId) {
    return;
  }

  await trx('appointments')
    .where({ account_id: accountId, user_id: clientId })
    .delete();
}

async function deleteSpecialistDataForUser(trx: Knex.Transaction, accountId: number, webUserId: number): Promise<number[]> {
  const specialists = await trx('specialists')
    .where({ account_id: accountId, user_id: webUserId })
    .select<Array<{ id: number }>>('id');
  const specialistIds = specialists.map((item) => item.id);

  if (specialistIds.length === 0) {
    return [];
  }

  await deleteAppointmentsForSpecialists(trx, accountId, specialistIds);

  await trx('specialist_booking_policies')
    .where({ account_id: accountId })
    .whereIn('specialist_id', specialistIds)
    .delete();

  await trx('specialist_notification_settings')
    .where({ account_id: accountId })
    .whereIn('specialist_id', specialistIds)
    .delete();

  await trx('specialist_settings')
    .where({ account_id: accountId })
    .whereIn('specialist_id', specialistIds)
    .delete();

  await trx('appointment_groups')
    .where({ account_id: accountId })
    .whereIn('specialist_id', specialistIds)
    .delete();

  await trx('specialists')
    .where({ account_id: accountId })
    .whereIn('id', specialistIds)
    .delete();

  return specialistIds;
}

async function deleteClientDataForUser(trx: Knex.Transaction, accountId: number, clientId: number | null) {
  if (!clientId) {
    return;
  }

  await deleteAppointmentsForClient(trx, accountId, clientId);

  await trx('client_notification_settings')
    .where({ account_id: accountId, client_id: clientId })
    .delete();

  await trx('appointment_groups')
    .where({ account_id: accountId, user_id: clientId })
    .delete();

  await trx('clients')
    .where({ account_id: accountId, id: clientId })
    .delete();
}

async function purgeWebUser(accountId: number, webUserId: number, clientId: number | null) {
  await db.transaction(async (trx) => {
    await deleteSpecialistDataForUser(trx, accountId, webUserId);
    await deleteClientDataForUser(trx, accountId, clientId);

    await trx('zoom_oauth_states').where({ account_id: accountId, web_user_id: webUserId }).delete();
    await trx('google_oauth_states').where({ account_id: accountId, web_user_id: webUserId }).delete();
    await trx('web_user_sessions').where({ account_id: accountId, web_user_id: webUserId }).delete();
    await trx('user_settings').where({ account_id: accountId, web_user_id: webUserId }).delete();
    await trx('user_integrations').where({ account_id: accountId, web_user_id: webUserId }).delete();
    await trx('web_user_integrations').where({ account_id: accountId, web_user_id: webUserId }).delete();
    await trx('identity_links').where({ account_id: accountId, web_user_id: webUserId }).delete();
    await trx('specialist_identity_links').where({ account_id: accountId, web_user_id: webUserId }).delete();
    await trx('web_users').where({ account_id: accountId, id: webUserId }).delete();
  });
}

export async function purgeDueDeletions(): Promise<void> {
  const now = new Date();

  const [dueUsers, dueAccounts] = await Promise.all([
    listWebUsersDueForDeletion(now),
    listAccountsDueForDeletion(now),
  ]);

  for (const dueUser of dueUsers) {
    await purgeWebUser(dueUser.account_id, dueUser.id, dueUser.client_id ?? null);
  }

  for (const dueAccount of dueAccounts) {
    await deleteAccountById(dueAccount.id);
  }
}
