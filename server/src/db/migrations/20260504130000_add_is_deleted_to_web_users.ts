import type { Knex } from 'knex';

const TABLE_NAME = 'web_users';
const COLUMN_NAME = 'is_deleted';

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME);
  if (!hasColumn) {
    await knex.schema.alterTable(TABLE_NAME, (table) => {
      table.boolean(COLUMN_NAME).notNullable().defaultTo(false);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME);
  if (hasColumn) {
    await knex.schema.alterTable(TABLE_NAME, (table) => {
      table.dropColumn(COLUMN_NAME);
    });
  }
}
