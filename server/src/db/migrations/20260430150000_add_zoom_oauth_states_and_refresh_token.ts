import type { Knex } from 'knex';

const INTEGRATIONS_TABLE = 'web_user_integrations';
const ZOOM_OAUTH_STATES_TABLE = 'zoom_oauth_states';

export async function up(knex: Knex): Promise<void> {
  const hasZoomRefreshToken = await knex.schema.hasColumn(INTEGRATIONS_TABLE, 'zoom_refresh_token');
  if (!hasZoomRefreshToken) {
    await knex.schema.alterTable(INTEGRATIONS_TABLE, (table) => {
      table.text('zoom_refresh_token');
    });
  }

  const hasStatesTable = await knex.schema.hasTable(ZOOM_OAUTH_STATES_TABLE);
  if (!hasStatesTable) {
    await knex.schema.createTable(ZOOM_OAUTH_STATES_TABLE, (table) => {
      table.increments('id').primary();
      table.integer('account_id').notNullable();
      table.integer('web_user_id').notNullable();
      table.string('state_token', 255).notNullable().unique();
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('expires_at', { useTz: true }).notNullable();

      table.index(['account_id'], 'zoom_oauth_states_account_id_index');
      table.index(['web_user_id'], 'zoom_oauth_states_web_user_id_index');
      table.index(['expires_at'], 'zoom_oauth_states_expires_at_index');

      table.foreign('account_id').references('id').inTable('accounts').onDelete('CASCADE');
      table.foreign('web_user_id').references('id').inTable('web_users').onDelete('CASCADE');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasStatesTable = await knex.schema.hasTable(ZOOM_OAUTH_STATES_TABLE);
  if (hasStatesTable) {
    await knex.schema.dropTable(ZOOM_OAUTH_STATES_TABLE);
  }

  const hasZoomRefreshToken = await knex.schema.hasColumn(INTEGRATIONS_TABLE, 'zoom_refresh_token');
  if (hasZoomRefreshToken) {
    await knex.schema.alterTable(INTEGRATIONS_TABLE, (table) => {
      table.dropColumn('zoom_refresh_token');
    });
  }
}
