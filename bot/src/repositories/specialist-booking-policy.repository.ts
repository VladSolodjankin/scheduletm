import { db } from '../db/knex';

export type SpecialistBookingPolicy = {
  cancelGracePeriodHours: number;
  refundOnLateCancel: boolean;
};

export async function getSpecialistCancelGraceHours(accountId: number, specialistId: number): Promise<number> {
  const policy = await getSpecialistBookingPolicy(accountId, specialistId);
  return policy.cancelGracePeriodHours;
}

export async function getSpecialistBookingPolicy(
  accountId: number,
  specialistId: number,
): Promise<SpecialistBookingPolicy> {
  const row = await db('specialist_booking_policies')
    .where({ account_id: accountId, specialist_id: specialistId })
    .first<{ cancel_grace_period_hours: number; refund_on_late_cancel: boolean }>(
      'cancel_grace_period_hours',
      'refund_on_late_cancel',
    );

  return {
    cancelGracePeriodHours: row?.cancel_grace_period_hours ?? 24,
    refundOnLateCancel: row?.refund_on_late_cancel ?? false,
  };
}
