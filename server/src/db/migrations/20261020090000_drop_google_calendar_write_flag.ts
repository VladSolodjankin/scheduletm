import type { Knex } from 'knex';

const INTEGRATIONS_TABLE = 'web_user_integrations';
const GOOGLE_OAUTH_STATES_TABLE = 'google_oauth_states';

async function dropColumnIfExists(knex: Knex, tableName: string, column: string): Promise<void> {
  if ((await knex.schema.hasTable(tableName)) && (await knex.schema.hasColumn(tableName, column))) {
    await knex.schema.alterTable(tableName, (table) => {
      table.dropColumn(column);
    });
  }
}

export async function up(knex: Knex): Promise<void> {
  await dropColumnIfExists(knex, INTEGRATIONS_TABLE, 'google_calendar_write_enabled');
  await dropColumnIfExists(knex, INTEGRATIONS_TABLE, 'google_calendar_id');
  await dropColumnIfExists(knex, GOOGLE_OAUTH_STATES_TABLE, 'requested_access');
}

export async function down(knex: Knex): Promise<void> {
  if (
    (await knex.schema.hasTable(INTEGRATIONS_TABLE))
    && !(await knex.schema.hasColumn(INTEGRATIONS_TABLE, 'google_calendar_write_enabled'))
  ) {
    await knex.schema.alterTable(INTEGRATIONS_TABLE, (table) => {
      table.boolean('google_calendar_write_enabled').notNullable().defaultTo(false);
    });
  }
  if (
    (await knex.schema.hasTable(INTEGRATIONS_TABLE))
    && !(await knex.schema.hasColumn(INTEGRATIONS_TABLE, 'google_calendar_id'))
  ) {
    await knex.schema.alterTable(INTEGRATIONS_TABLE, (table) => {
      table.string('google_calendar_id').nullable();
    });
  }
  if (
    (await knex.schema.hasTable(GOOGLE_OAUTH_STATES_TABLE))
    && !(await knex.schema.hasColumn(GOOGLE_OAUTH_STATES_TABLE, 'requested_access'))
  ) {
    await knex.schema.alterTable(GOOGLE_OAUTH_STATES_TABLE, (table) => {
      table.string('requested_access', 16).nullable();
    });
  }
}
