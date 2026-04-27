import type { Knex } from 'knex';

const TABLE = 'system_settings';
const BOT_TOKEN_COLUMN = 'error_alerts_telegram_bot_token_encrypted';
const CHAT_ID_COLUMN = 'error_alerts_telegram_chat_id_encrypted';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE);
  if (!hasTable) {
    return;
  }

  const hasBotTokenColumn = await knex.schema.hasColumn(TABLE, BOT_TOKEN_COLUMN);
  const hasChatIdColumn = await knex.schema.hasColumn(TABLE, CHAT_ID_COLUMN);

  if (hasBotTokenColumn && hasChatIdColumn) {
    return;
  }

  await knex.schema.alterTable(TABLE, (table) => {
    if (!hasBotTokenColumn) {
      table.text(BOT_TOKEN_COLUMN).nullable();
    }

    if (!hasChatIdColumn) {
      table.text(CHAT_ID_COLUMN).nullable();
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE);
  if (!hasTable) {
    return;
  }

  const hasBotTokenColumn = await knex.schema.hasColumn(TABLE, BOT_TOKEN_COLUMN);
  const hasChatIdColumn = await knex.schema.hasColumn(TABLE, CHAT_ID_COLUMN);

  if (!hasBotTokenColumn && !hasChatIdColumn) {
    return;
  }

  await knex.schema.alterTable(TABLE, (table) => {
    if (hasBotTokenColumn) {
      table.dropColumn(BOT_TOKEN_COLUMN);
    }

    if (hasChatIdColumn) {
      table.dropColumn(CHAT_ID_COLUMN);
    }
  });
}
