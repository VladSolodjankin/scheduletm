import { db } from '../db/knex';

type SpecialistCalendarCredentialsRow = {
  google_api_key: string | null;
  google_calendar_id: string | null;
};

export async function findActiveSpecialists(accountId: number) {
  return db('specialists')
    .where({ account_id: accountId, is_active: true })
    .orderBy([{ column: 'is_default', order: 'desc' }, { column: 'id', order: 'asc' }]);
}

export async function findSpecialistById(accountId: number, id: number) {
  return db('specialists').where({ account_id: accountId, id }).first();
}

export async function findSingleDefaultActiveSpecialist(accountId: number) {
  const specialists = await db('specialists')
    .where({ account_id: accountId, is_active: true, is_default: true })
    .orderBy('id', 'asc');

  if (specialists.length === 1) {
    const activeCount = await db('specialists')
      .where({ account_id: accountId, is_active: true })
      .count<{ count: string }>('id as count')
      .first();

    if (Number(activeCount?.count ?? 0) === 1) {
      return specialists[0];
    }
  }

  return null;
}

export async function findSpecialistCalendarCredentials(accountId: number, specialistId: number) {
  const row = await db('specialists as sp')
    .leftJoin('web_users as wu', function joinWebUsers() {
      this.on('wu.account_id', '=', 'sp.account_id').andOn('wu.id', '=', 'sp.user_id');
    })
    .where({ 'sp.account_id': accountId, 'sp.id': specialistId })
    .first<SpecialistCalendarCredentialsRow>(
      'wu.google_api_key as google_api_key',
      'wu.google_calendar_id as google_calendar_id',
    );

  return row ?? null;
}
