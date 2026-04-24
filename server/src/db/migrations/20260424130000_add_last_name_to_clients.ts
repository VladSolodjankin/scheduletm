import type { Knex } from 'knex';

const TABLE_NAME = 'clients';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) {
    return;
  }

  const hasLastName = await knex.schema.hasColumn(TABLE_NAME, 'last_name');
  if (!hasLastName) {
    await knex.schema.alterTable(TABLE_NAME, (table) => {
      table.string('last_name', 255).notNullable().defaultTo('');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) {
    return;
  }

  const hasLastName = await knex.schema.hasColumn(TABLE_NAME, 'last_name');
  if (hasLastName) {
    await knex.schema.alterTable(TABLE_NAME, (table) => {
      table.dropColumn('last_name');
    });
  }
}
