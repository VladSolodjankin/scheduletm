import { db } from '../db/knex';

type SpecialistCalendarCredentialsRow = {
  google_api_key: string | null;
  google_calendar_id: string | null;
};

const DEFAULT_WORK_START_HOUR = 9;
const DEFAULT_WORK_END_HOUR = 20;
const DEFAULT_SLOT_DURATION_MIN = 90;
const DEFAULT_SLOT_STEP_MIN = 30;

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
    .leftJoin('web_user_integrations as wui', function joinWebUserIntegrations() {
      this.on('wui.account_id', '=', 'wu.account_id').andOn('wui.web_user_id', '=', 'wu.id');
    })
    .where({ 'sp.account_id': accountId, 'sp.id': specialistId })
    .first<SpecialistCalendarCredentialsRow>(
      'wui.google_api_key as google_api_key',
      'wui.google_calendar_id as google_calendar_id',
    );

  return row ?? null;
}

type SpecialistScheduleRow = {
  work_start_hour: number | null;
  work_end_hour: number | null;
  slot_duration_min: number | null;
  slot_step_min: number | null;
};

export async function findSpecialistScheduleSettings(accountId: number, specialistId: number) {
  const row = await db('specialists')
    .where({ account_id: accountId, id: specialistId })
    .first<SpecialistScheduleRow>(
      'work_start_hour',
      'work_end_hour',
      'slot_duration_min',
      'slot_step_min',
    );

  return {
    workStartHour: row?.work_start_hour ?? DEFAULT_WORK_START_HOUR,
    workEndHour: row?.work_end_hour ?? DEFAULT_WORK_END_HOUR,
    slotDurationMin: row?.slot_duration_min ?? DEFAULT_SLOT_DURATION_MIN,
    slotStepMin: row?.slot_step_min ?? DEFAULT_SLOT_STEP_MIN,
  };
}
