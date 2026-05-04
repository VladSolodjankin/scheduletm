import type { Knex } from 'knex';

const TABLE_NAME = 'web_users';
const COLUMN_NAME = 'delete_scheduled_at';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) {
    return;
  }

  const hasColumn = await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME);
  if (hasColumn) {
    return;
  }

  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.timestamp(COLUMN_NAME, { useTz: true }).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) {
    return;
  }

  const hasColumn = await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME);
  if (!hasColumn) {
    return;
  }

  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.dropColumn(COLUMN_NAME);
  });
}
