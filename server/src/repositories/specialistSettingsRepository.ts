import { db } from '../db/knex.js';

export type SpecialistSettingsRecord = {
  id: number;
  account_id: number;
  specialist_id: number;
  base_session_price: number;
  base_hour_price: number;
  work_start_hour: number;
  work_end_hour: number;
  slot_duration_min: number;
  slot_step_min: number;
  default_session_continuation_min: number;
};

type UpsertSpecialistSettingsInput = {
  accountId: number;
  specialistId: number;
  baseSessionPrice?: number;
  baseHourPrice?: number;
  workStartHour?: number;
  workEndHour?: number;
  slotDurationMin?: number;
  slotStepMin?: number;
  defaultSessionContinuationMin?: number;
};

export async function findSpecialistSettingsBySpecialistId(
  accountId: number,
  specialistId: number,
): Promise<SpecialistSettingsRecord | null> {
  const row = await db('specialist_settings')
    .where({ account_id: accountId, specialist_id: specialistId })
    .first<SpecialistSettingsRecord>();

  return row ?? null;
}

export async function upsertSpecialistSettingsBySpecialistId(input: UpsertSpecialistSettingsInput): Promise<void> {
  const payload: Record<string, unknown> = {
    account_id: input.accountId,
    specialist_id: input.specialistId,
    updated_at: db.fn.now(),
  };

  if (input.baseSessionPrice !== undefined) {
    payload.base_session_price = input.baseSessionPrice;
  }

  if (input.baseHourPrice !== undefined) {
    payload.base_hour_price = input.baseHourPrice;
  }

  if (input.workStartHour !== undefined) {
    payload.work_start_hour = input.workStartHour;
  }

  if (input.workEndHour !== undefined) {
    payload.work_end_hour = input.workEndHour;
  }

  if (input.slotDurationMin !== undefined) {
    payload.slot_duration_min = input.slotDurationMin;
  }

  if (input.slotStepMin !== undefined) {
    payload.slot_step_min = input.slotStepMin;
  }

  if (input.defaultSessionContinuationMin !== undefined) {
    payload.default_session_continuation_min = input.defaultSessionContinuationMin;
  }

  await db('specialist_settings')
    .insert({
      ...payload,
      created_at: db.fn.now(),
    })
    .onConflict(['specialist_id'])
    .merge(payload);
}
