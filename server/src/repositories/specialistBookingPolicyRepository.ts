import { db } from '../db/knex.js';

export type SpecialistBookingPolicyRecord = {
  id: number;
  account_id: number;
  specialist_id: number;
  cancel_grace_period_hours: number;
  refund_on_late_cancel: boolean;
  auto_cancel_unpaid_enabled: boolean;
  unpaid_auto_cancel_after_hours: number;
};

export type UpsertSpecialistBookingPolicyInput = {
  accountId: number;
  specialistId: number;
  cancelGracePeriodHours?: number;
  refundOnLateCancel?: boolean;
  autoCancelUnpaidEnabled?: boolean;
  unpaidAutoCancelAfterHours?: number;
};

export async function findSpecialistBookingPolicy(
  accountId: number,
  specialistId: number,
): Promise<SpecialistBookingPolicyRecord | null> {
  const row = await db('specialist_booking_policies')
    .where({ account_id: accountId, specialist_id: specialistId })
    .first<SpecialistBookingPolicyRecord>();

  return row ?? null;
}

export async function upsertSpecialistBookingPolicy(input: UpsertSpecialistBookingPolicyInput): Promise<void> {
  const patch: Record<string, unknown> = {
    updated_at: db.fn.now(),
  };

  if (input.cancelGracePeriodHours !== undefined) {
    patch.cancel_grace_period_hours = input.cancelGracePeriodHours;
  }
  if (input.refundOnLateCancel !== undefined) {
    patch.refund_on_late_cancel = input.refundOnLateCancel;
  }
  if (input.autoCancelUnpaidEnabled !== undefined) {
    patch.auto_cancel_unpaid_enabled = input.autoCancelUnpaidEnabled;
  }
  if (input.unpaidAutoCancelAfterHours !== undefined) {
    patch.unpaid_auto_cancel_after_hours = input.unpaidAutoCancelAfterHours;
  }

  await db('specialist_booking_policies')
    .insert({
      account_id: input.accountId,
      specialist_id: input.specialistId,
      cancel_grace_period_hours: input.cancelGracePeriodHours ?? 24,
      refund_on_late_cancel: input.refundOnLateCancel ?? false,
      auto_cancel_unpaid_enabled: input.autoCancelUnpaidEnabled ?? false,
      unpaid_auto_cancel_after_hours: input.unpaidAutoCancelAfterHours ?? 72,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .onConflict(['account_id', 'specialist_id'])
    .merge(patch);
}
