import { db } from '../db/knex';

export async function getSpecialistCancelGraceHours(accountId: number, specialistId: number): Promise<number> {
  const row = await db('specialist_booking_policies')
    .where({ account_id: accountId, specialist_id: specialistId })
    .first<{ cancel_grace_period_hours: number }>('cancel_grace_period_hours');

  return row?.cancel_grace_period_hours ?? 24;
}
