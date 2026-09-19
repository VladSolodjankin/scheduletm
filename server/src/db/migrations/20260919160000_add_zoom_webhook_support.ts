import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('appointments', (table) => {
    table.string('zoom_meeting_id', 64);
    table.timestamp('zoom_meeting_started_at', { useTz: true });
    table.timestamp('zoom_meeting_ended_at', { useTz: true });
    table.index(['zoom_meeting_id'], 'appointments_zoom_meeting_id_idx');
  });

  await knex.schema.createTable('zoom_webhook_events', (table) => {
    table.increments('id').primary();
    table.string('event_id', 64).notNullable().unique();
    table.string('status', 20).notNullable().defaultTo('processing');
    table.uuid('processing_token');
    table.timestamp('lease_expires_at', { useTz: true });
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('zoom_webhook_events');

  await knex.schema.alterTable('appointments', (table) => {
    table.dropColumn('zoom_meeting_id');
    table.dropColumn('zoom_meeting_started_at');
    table.dropColumn('zoom_meeting_ended_at');
  });
}
