import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('account_settings', 'specialists_see_all_appointments');
  if (!hasColumn) {
    await knex.schema.alterTable('account_settings', (table) => {
      table.boolean('specialists_see_all_appointments').notNullable().defaultTo(false);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('account_settings', 'specialists_see_all_appointments');
  if (hasColumn) {
    await knex.schema.alterTable('account_settings', (table) => {
      table.dropColumn('specialists_see_all_appointments');
    });
  }
}
