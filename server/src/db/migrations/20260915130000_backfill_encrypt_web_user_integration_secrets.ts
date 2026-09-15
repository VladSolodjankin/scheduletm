import type { Knex } from 'knex';
import { env } from '../../config/env.js';
import { encryptText } from '../../utils/crypto.js';

const TABLE_NAME = 'web_user_integrations';

const SECRET_COLUMNS = [
  { plaintext: 'google_api_key', encrypted: 'google_access_token_encrypted', label: 'Google access token' },
  { plaintext: 'google_refresh_token', encrypted: 'google_refresh_token_encrypted', label: 'Google refresh token' },
  { plaintext: 'telegram_bot_token', encrypted: 'telegram_bot_token_encrypted', label: 'Telegram bot token' },
  { plaintext: 'zoom_access_token', encrypted: 'zoom_access_token_encrypted', label: 'Zoom access token' },
  { plaintext: 'zoom_refresh_token', encrypted: 'zoom_refresh_token_encrypted', label: 'Zoom refresh token' },
] as const;

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) {
    return;
  }

  for (const column of SECRET_COLUMNS) {
    const [hasPlaintext, hasEncrypted] = await Promise.all([
      knex.schema.hasColumn(TABLE_NAME, column.plaintext),
      knex.schema.hasColumn(TABLE_NAME, column.encrypted),
    ]);
    if (!hasPlaintext || !hasEncrypted) {
      continue;
    }

    const staleRows = await knex(TABLE_NAME)
      .whereNotNull(column.plaintext)
      .whereNull(column.encrypted)
      .select('id', column.plaintext);

    if (staleRows.length === 0) {
      continue;
    }

    if (!env.APP_ENCRYPTION_KEY) {
      throw new Error(
        `APP_ENCRYPTION_KEY is required to backfill encrypted ${column.label} for ${staleRows.length} row(s)`,
      );
    }

    for (const row of staleRows as Array<{ id: number } & Record<string, string>>) {
      const plaintextValue = row[column.plaintext];
      await knex(TABLE_NAME)
        .where({ id: row.id })
        .update({
          [column.encrypted]: encryptText(plaintextValue, env.APP_ENCRYPTION_KEY),
          [column.plaintext]: null,
        });
    }
  }
}

export async function down(_knex: Knex): Promise<void> {
  throw new Error(
    'Forward-only migration: re-encrypting backfilled integration secrets cannot be safely reversed',
  );
}
