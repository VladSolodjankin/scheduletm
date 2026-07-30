import type { Knex } from 'knex';

const DEFAULT_MEETING_LINK_COLUMN = 'default_meeting_link';
const AUDIT_RETENTION_INDEX = 'appointment_events_created_at_index';

export async function up(knex: Knex): Promise<void> {
  const hasDefaultMeetingLink = await knex.schema.hasColumn(
    'specialist_settings',
    DEFAULT_MEETING_LINK_COLUMN,
  );
  if (!hasDefaultMeetingLink) {
    await knex.schema.alterTable('specialist_settings', (table) => {
      table.string(DEFAULT_MEETING_LINK_COLUMN, 2048).nullable();
    });
  }

  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "${AUDIT_RETENTION_INDEX}" ON "appointment_events" ("created_at")`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "${AUDIT_RETENTION_INDEX}"`);
  const hasDefaultMeetingLink = await knex.schema.hasColumn(
    'specialist_settings',
    DEFAULT_MEETING_LINK_COLUMN,
  );
  if (hasDefaultMeetingLink) {
    await knex.schema.alterTable('specialist_settings', (table) => {
      table.dropColumn(DEFAULT_MEETING_LINK_COLUMN);
    });
  }
}
