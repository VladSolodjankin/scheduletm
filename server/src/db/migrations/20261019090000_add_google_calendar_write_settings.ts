import type { Knex } from 'knex';

const INTEGRATIONS_TABLE = 'web_user_integrations';
const GOOGLE_OAUTH_STATES_TABLE = 'google_oauth_states';

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(INTEGRATIONS_TABLE)) {
    if (!(await knex.schema.hasColumn(INTEGRATIONS_TABLE, 'google_calendar_write_enabled'))) {
      await knex.schema.alterTable(INTEGRATIONS_TABLE, (table) => {
        table.boolean('google_calendar_write_enabled').notNullable().defaultTo(false);
      });
    }
    if (!(await knex.schema.hasColumn(INTEGRATIONS_TABLE, 'google_granted_scopes'))) {
      await knex.schema.alterTable(INTEGRATIONS_TABLE, (table) => {
        table.text('google_granted_scopes').nullable();
      });
    }
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

export async function down(knex: Knex): Promise<void> {
  if (
    (await knex.schema.hasTable(GOOGLE_OAUTH_STATES_TABLE))
    && (await knex.schema.hasColumn(GOOGLE_OAUTH_STATES_TABLE, 'requested_access'))
  ) {
    await knex.schema.alterTable(GOOGLE_OAUTH_STATES_TABLE, (table) => {
      table.dropColumn('requested_access');
    });
  }

  if (await knex.schema.hasTable(INTEGRATIONS_TABLE)) {
    for (const column of ['google_granted_scopes', 'google_calendar_write_enabled']) {
      if (await knex.schema.hasColumn(INTEGRATIONS_TABLE, column)) {
        await knex.schema.alterTable(INTEGRATIONS_TABLE, (table) => {
          table.dropColumn(column);
        });
      }
    }
  }
}
