import type { Knex } from 'knex';

const TABLE_NAME = 'web_user_integrations';

const PLAINTEXT_COLUMNS = [
  'google_api_key',
  'google_refresh_token',
  'telegram_bot_token',
  'zoom_access_token',
  'zoom_refresh_token',
] as const;

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) {
    return;
  }

  const columnsToDrop: string[] = [];
  for (const column of PLAINTEXT_COLUMNS) {
    if (await knex.schema.hasColumn(TABLE_NAME, column)) {
      columnsToDrop.push(column);
    }
  }

  if (columnsToDrop.length === 0) {
    return;
  }

  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.dropColumns(...columnsToDrop);
  });
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) {
    return;
  }

  await knex.schema.alterTable(TABLE_NAME, (table) => {
    for (const column of PLAINTEXT_COLUMNS) {
      table.text(column).nullable();
    }
  });
}
