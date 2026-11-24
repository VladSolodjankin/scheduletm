import type { Knex } from 'knex';

const QUEUE_TABLE = 'google_calendar_sync_queue';

/**
 * Contract step of the provider-aware queue: the old "one pending row per appointment" index would forbid a
 * Google and a Microsoft row from being pending together. Deploy the code that targets
 * (appointment_id, provider) first; old code relies on this index as its ON CONFLICT arbiter.
 */
export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(QUEUE_TABLE)) {
    await knex.raw('DROP INDEX IF EXISTS google_calendar_sync_queue_pending_uq');
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(QUEUE_TABLE)) {
    // Only safe while no appointment has pending rows for two providers.
    await knex.raw(
      `CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_sync_queue_pending_uq ON ${QUEUE_TABLE} (appointment_id) WHERE status = 'pending'`,
    );
  }
}
