import { db } from '../db/knex.js';

export type SpecialistBookingPolicyRecord = {
  id: number;
  account_id: number;
  specialist_id: number;
  cancel_grace_period_hours: number;
  refund_on_late_cancel: boolean;
  auto_cancel_unpaid_enabled: boolean;
  unpaid_auto_cancel_after_hours: number;
  meeting_providers_priority: string;
  allowed_meeting_providers: string;
  meeting_provider_override_enabled: boolean;
};

export type UpsertSpecialistBookingPolicyInput = {
  accountId: number;
  specialistId: number;
  cancelGracePeriodHours?: number;
  refundOnLateCancel?: boolean;
  autoCancelUnpaidEnabled?: boolean;
  unpaidAutoCancelAfterHours?: number;
  meetingProvidersPriority?: string;
  allowedMeetingProviders?: string;
  meetingProviderOverrideEnabled?: boolean;
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
  if (input.meetingProvidersPriority !== undefined) {
    patch.meeting_providers_priority = input.meetingProvidersPriority;
  }
  if (input.allowedMeetingProviders !== undefined) {
    patch.allowed_meeting_providers = input.allowedMeetingProviders;
  }
  if (input.meetingProviderOverrideEnabled !== undefined) {
    patch.meeting_provider_override_enabled = input.meetingProviderOverrideEnabled;
  }

  await db('specialist_booking_policies')
    .insert({
      account_id: input.accountId,
      specialist_id: input.specialistId,
      cancel_grace_period_hours: input.cancelGracePeriodHours ?? 24,
      refund_on_late_cancel: input.refundOnLateCancel ?? false,
      auto_cancel_unpaid_enabled: input.autoCancelUnpaidEnabled ?? false,
      unpaid_auto_cancel_after_hours: input.unpaidAutoCancelAfterHours ?? 72,
      meeting_providers_priority: input.meetingProvidersPriority ?? 'zoom,manual',
      allowed_meeting_providers: input.allowedMeetingProviders ?? 'zoom,manual',
      meeting_provider_override_enabled: input.meetingProviderOverrideEnabled ?? false,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .onConflict(['account_id', 'specialist_id'])
    .merge(patch);
}
