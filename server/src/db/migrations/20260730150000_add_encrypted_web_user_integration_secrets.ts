import type { Knex } from 'knex';

const TABLE_NAME = 'web_user_integrations';
const ENCRYPTED_COLUMNS = [
  'google_access_token_encrypted',
  'google_refresh_token_encrypted',
  'zoom_access_token_encrypted',
  'zoom_refresh_token_encrypted',
  'telegram_bot_token_encrypted',
] as const;

export async function up(knex: Knex): Promise<void> {
  for (const column of ENCRYPTED_COLUMNS) {
    const hasColumn = await knex.schema.hasColumn(TABLE_NAME, column);
    if (!hasColumn) {
      await knex.schema.alterTable(TABLE_NAME, (table) => {
        table.text(column).nullable();
      });
    }
  }
}

export async function down(_knex: Knex): Promise<void> {
  throw new Error(
    'Forward-only migration: encrypted integration credential columns cannot be dropped safely',
  );
}
