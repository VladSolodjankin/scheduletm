import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasSpecialists = await knex.schema.hasTable('specialists');
  if (!hasSpecialists) {
    return;
  }

  const hasGoogleApiKey = await knex.schema.hasColumn('specialists', 'google_api_key');
  const hasGoogleCalendarId = await knex.schema.hasColumn('specialists', 'google_calendar_id');

  await knex.schema.alterTable('specialists', (table) => {
    if (!hasGoogleApiKey) {
      table.string('google_api_key');
    }

    if (!hasGoogleCalendarId) {
      table.string('google_calendar_id');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  const hasSpecialists = await knex.schema.hasTable('specialists');
  if (!hasSpecialists) {
    return;
  }

  const hasGoogleApiKey = await knex.schema.hasColumn('specialists', 'google_api_key');
  const hasGoogleCalendarId = await knex.schema.hasColumn('specialists', 'google_calendar_id');

  await knex.schema.alterTable('specialists', (table) => {
    if (hasGoogleApiKey) {
      table.dropColumn('google_api_key');
    }

    if (hasGoogleCalendarId) {
      table.dropColumn('google_calendar_id');
    }
  });
}
