import type { Knex } from 'knex';

const TABLE_NAME = 'notifications';
const COLUMN_NAME = 'processing_token';

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME);
  if (!hasColumn) {
    await knex.schema.alterTable(TABLE_NAME, (table) => {
      table.string(COLUMN_NAME, 64).nullable();
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
