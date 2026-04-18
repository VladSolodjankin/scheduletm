import { db } from '../db/knex';

const DEFAULT_TIMEZONE = 'Europe/Moscow';

type AppSettingsRow = {
  timezone: string;
};

export async function getDefaultTimezone() {
  const row = await db('app_settings')
    .select('timezone')
    .orderBy('id', 'asc')
    .first<AppSettingsRow>();

  return row?.timezone || DEFAULT_TIMEZONE;
}
