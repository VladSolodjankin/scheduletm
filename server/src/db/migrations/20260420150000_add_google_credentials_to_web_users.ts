import type { Knex } from 'knex';

const TABLE = 'web_users';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE);
  if (!hasTable) {
    return;
  }

  const hasGoogleApiKey = await knex.schema.hasColumn(TABLE, 'google_api_key');
  const hasGoogleCalendarId = await knex.schema.hasColumn(TABLE, 'google_calendar_id');
  const hasGoogleConnectedAt = await knex.schema.hasColumn(TABLE, 'google_connected_at');

  await knex.schema.alterTable(TABLE, (table) => {
    if (!hasGoogleApiKey) {
      table.string('google_api_key');
    }

    if (!hasGoogleCalendarId) {
      table.string('google_calendar_id');
    }

    if (!hasGoogleConnectedAt) {
      table.timestamp('google_connected_at', { useTz: true });
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE);
  if (!hasTable) {
    return;
  }

  const hasGoogleApiKey = await knex.schema.hasColumn(TABLE, 'google_api_key');
  const hasGoogleCalendarId = await knex.schema.hasColumn(TABLE, 'google_calendar_id');
  const hasGoogleConnectedAt = await knex.schema.hasColumn(TABLE, 'google_connected_at');

  await knex.schema.alterTable(TABLE, (table) => {
    if (hasGoogleConnectedAt) {
      table.dropColumn('google_connected_at');
    }

    if (hasGoogleCalendarId) {
      table.dropColumn('google_calendar_id');
    }

    if (hasGoogleApiKey) {
      table.dropColumn('google_api_key');
    }
  });
}
