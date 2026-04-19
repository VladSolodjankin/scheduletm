import { db } from '../db/knex';

const DEFAULT_TIMEZONE = 'Europe/Moscow';
const DEFAULT_WORK_START_HOUR = 9;
const DEFAULT_WORK_END_HOUR = 20;
const DEFAULT_WORK_DAYS = '1,2,3,4,5,6';
const DEFAULT_SLOT_DURATION_MIN = 90;
const DEFAULT_REMINDER_OFFSETS_MIN = '1440,60,30';

const DEFAULT_REMINDER_OFFSETS = [1440, 60, 30];

function parseReminderOffsets(value: string | null | undefined) {
  if (!value) {
    return DEFAULT_REMINDER_OFFSETS;
  }

  const offsets = value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);

  if (!offsets.length) {
    return DEFAULT_REMINDER_OFFSETS;
  }

  return [...new Set(offsets)].sort((a, b) => b - a);
}

type AppSettingsRow = {
  timezone: string;
  work_start_hour: number;
  work_end_hour: number;
  work_days: string;
  slot_duration_min: number;
  reminder_offsets_min?: string;
  reminder_comment?: string;
};

export async function getAppSettings(accountId: number) {
  const row = await db('app_settings')
    .select(
      'timezone',
      'work_start_hour',
      'work_end_hour',
      'work_days',
      'slot_duration_min',
      'reminder_offsets_min',
      'reminder_comment',
    )
    .where({ account_id: accountId })
    .orderBy('id', 'asc')
    .first<AppSettingsRow>();

  return {
    timezone: row?.timezone || DEFAULT_TIMEZONE,
    workStartHour: row?.work_start_hour ?? DEFAULT_WORK_START_HOUR,
    workEndHour: row?.work_end_hour ?? DEFAULT_WORK_END_HOUR,
    workDays: row?.work_days || DEFAULT_WORK_DAYS,
    slotDurationMin: row?.slot_duration_min ?? DEFAULT_SLOT_DURATION_MIN,
    reminderOffsetsMin: parseReminderOffsets(row?.reminder_offsets_min ?? DEFAULT_REMINDER_OFFSETS_MIN),
    reminderComment: (row?.reminder_comment ?? '').trim(),
  };
}

export async function getDefaultTimezone(accountId: number) {
  const settings = await getAppSettings(accountId);
  return settings.timezone;
}
