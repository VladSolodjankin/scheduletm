import type { Knex } from 'knex';

const INTEGRATIONS_TABLE = 'web_user_integrations';
const OAUTH_STATES_TABLE = 'microsoft_oauth_states';
const QUEUE_TABLE = 'google_calendar_sync_queue';

export async function up(knex: Knex): Promise<void> {
  const integrationColumns: Array<[string, (table: Knex.AlterTableBuilder) => void]> = [
    ['microsoft_access_token_encrypted', (table) => { table.text('microsoft_access_token_encrypted').nullable(); }],
    ['microsoft_refresh_token_encrypted', (table) => { table.text('microsoft_refresh_token_encrypted').nullable(); }],
    ['microsoft_token_expires_at', (table) => { table.timestamp('microsoft_token_expires_at', { useTz: true }); }],
    ['microsoft_connected_at', (table) => { table.timestamp('microsoft_connected_at', { useTz: true }); }],
    ['microsoft_granted_scopes', (table) => { table.text('microsoft_granted_scopes').nullable(); }],
  ];
  for (const [name, add] of integrationColumns) {
    if (!(await knex.schema.hasColumn(INTEGRATIONS_TABLE, name))) {
      await knex.schema.alterTable(INTEGRATIONS_TABLE, add);
    }
  }

  if (await knex.schema.hasTable('appointments')) {
    if (!(await knex.schema.hasColumn('appointments', 'microsoft_event_id'))) {
      await knex.schema.alterTable('appointments', (table) => {
        table.text('microsoft_event_id').nullable();
      });
    }
    if (!(await knex.schema.hasColumn('appointments', 'microsoft_event_web_user_id'))) {
      await knex.schema.alterTable('appointments', (table) => {
        table.integer('microsoft_event_web_user_id').nullable();
      });
    }
  }

  if (!(await knex.schema.hasTable(OAUTH_STATES_TABLE))) {
    await knex.schema.createTable(OAUTH_STATES_TABLE, (table) => {
      table.increments('id').primary();
      table.integer('account_id').notNullable();
      table.integer('web_user_id').notNullable();
      table.string('state_token', 255).notNullable().unique();
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('expires_at', { useTz: true }).notNullable();

      table.index(['account_id'], 'microsoft_oauth_states_account_id_index');
      table.index(['web_user_id'], 'microsoft_oauth_states_web_user_id_index');
      table.index(['expires_at'], 'microsoft_oauth_states_expires_at_index');

      table.foreign('account_id').references('id').inTable('accounts').onDelete('CASCADE');
      table.foreign('web_user_id').references('id').inTable('web_users').onDelete('CASCADE');
    });
  }

  if (await knex.schema.hasTable(QUEUE_TABLE)) {
    if (!(await knex.schema.hasColumn(QUEUE_TABLE, 'provider'))) {
      await knex.schema.alterTable(QUEUE_TABLE, (table) => {
        table.string('provider', 16).notNullable().defaultTo('google');
      });
      await knex.raw(
        `ALTER TABLE ${QUEUE_TABLE} ADD CONSTRAINT google_calendar_sync_queue_provider_check CHECK (provider IN ('google','microsoft'))`,
      );
    }
    if (!(await knex.schema.hasColumn(QUEUE_TABLE, 'external_event_id'))) {
      await knex.schema.alterTable(QUEUE_TABLE, (table) => {
        // Snapshot of the provider event to remove (google rows keep using google_event_id).
        table.text('external_event_id').nullable();
      });
    }
    // Coalescing is now per (appointment, provider). The legacy single-column pending index is intentionally
    // left in place here so old code keeps a valid ON CONFLICT arbiter during a rolling deploy; the follow-up
    // contract migration drops it (it would otherwise forbid a Google and a Microsoft row pending together).
    await knex.raw(
      `CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_sync_queue_pending_provider_uq ON ${QUEUE_TABLE} (appointment_id, provider) WHERE status = 'pending'`,
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(QUEUE_TABLE)) {
    await knex.raw('DROP INDEX IF EXISTS google_calendar_sync_queue_pending_provider_uq');
    // Microsoft rows cannot be represented without the provider column.
    if (await knex.schema.hasColumn(QUEUE_TABLE, 'provider')) {
      await knex(QUEUE_TABLE).where({ provider: 'microsoft' }).delete();
      await knex.raw(`ALTER TABLE ${QUEUE_TABLE} DROP CONSTRAINT IF EXISTS google_calendar_sync_queue_provider_check`);
      await knex.schema.alterTable(QUEUE_TABLE, (table) => {
        table.dropColumn('provider');
      });
    }
    if (await knex.schema.hasColumn(QUEUE_TABLE, 'external_event_id')) {
      await knex.schema.alterTable(QUEUE_TABLE, (table) => {
        table.dropColumn('external_event_id');
      });
    }
  }

  await knex.schema.dropTableIfExists(OAUTH_STATES_TABLE);

  for (const column of ['microsoft_event_web_user_id', 'microsoft_event_id']) {
    if (await knex.schema.hasColumn('appointments', column)) {
      await knex.schema.alterTable('appointments', (table) => {
        table.dropColumn(column);
      });
    }
  }

  for (const name of [
    'microsoft_access_token_encrypted',
    'microsoft_refresh_token_encrypted',
    'microsoft_token_expires_at',
    'microsoft_connected_at',
    'microsoft_granted_scopes',
  ]) {
    if (await knex.schema.hasColumn(INTEGRATIONS_TABLE, name)) {
      await knex.schema.alterTable(INTEGRATIONS_TABLE, (table) => {
        table.dropColumn(name);
      });
    }
  }
}
