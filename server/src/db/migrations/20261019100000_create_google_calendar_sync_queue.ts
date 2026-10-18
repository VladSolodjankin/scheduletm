import type { Knex } from 'knex';

const QUEUE_TABLE = 'google_calendar_sync_queue';

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('appointments')) {
    if (!(await knex.schema.hasColumn('appointments', 'google_event_id'))) {
      await knex.schema.alterTable('appointments', (table) => {
        table.text('google_event_id').nullable();
      });
    }
    if (!(await knex.schema.hasColumn('appointments', 'google_event_web_user_id'))) {
      await knex.schema.alterTable('appointments', (table) => {
        table.integer('google_event_web_user_id').nullable();
      });
    }
  }

  if (!(await knex.schema.hasTable(QUEUE_TABLE))) {
    await knex.schema.createTable(QUEUE_TABLE, (table) => {
      table.increments('id').primary();
      table.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
      // No FK: delete rows must outlive the hard-deleted appointment.
      table.integer('appointment_id').notNullable();
      table.string('action', 16).notNullable();
      table.string('status', 16).notNullable().defaultTo('pending');
      // Snapshot of the Google event to remove, copied at enqueue time.
      table.text('google_event_id').nullable();
      table.integer('web_user_id').nullable();
      table.integer('attempts').notNullable().defaultTo(0);
      table.timestamp('next_attempt_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('locked_until', { useTz: true }).nullable();
      table.string('last_error_status', 64).nullable();
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.index(['status', 'next_attempt_at'], 'google_calendar_sync_queue_status_next_attempt_idx');
      table.index(['appointment_id'], 'google_calendar_sync_queue_appointment_idx');
    });
    await knex.raw(
      `ALTER TABLE ${QUEUE_TABLE} ADD CONSTRAINT google_calendar_sync_queue_action_check CHECK (action IN ('upsert','delete'))`,
    );
    await knex.raw(
      `ALTER TABLE ${QUEUE_TABLE} ADD CONSTRAINT google_calendar_sync_queue_status_check CHECK (status IN ('pending','processing','done','failed'))`,
    );
    // Coalescing: at most one pending row per appointment.
    await knex.raw(
      `CREATE UNIQUE INDEX google_calendar_sync_queue_pending_uq ON ${QUEUE_TABLE} (appointment_id) WHERE status = 'pending'`,
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(QUEUE_TABLE);
  for (const column of ['google_event_web_user_id', 'google_event_id']) {
    if (await knex.schema.hasColumn('appointments', column)) {
      await knex.schema.alterTable('appointments', (table) => {
        table.dropColumn(column);
      });
    }
  }
}
