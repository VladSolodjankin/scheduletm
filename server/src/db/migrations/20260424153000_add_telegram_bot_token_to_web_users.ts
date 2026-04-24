import type { Knex } from 'knex';

const TABLE_NAME = 'web_users';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) {
    return;
  }

  const hasTelegramBotToken = await knex.schema.hasColumn(TABLE_NAME, 'telegram_bot_token');
  const hasTelegramBotUsername = await knex.schema.hasColumn(TABLE_NAME, 'telegram_bot_username');
  const hasTelegramBotName = await knex.schema.hasColumn(TABLE_NAME, 'telegram_bot_name');

  if (!hasTelegramBotToken || !hasTelegramBotUsername || !hasTelegramBotName) {
    await knex.schema.alterTable(TABLE_NAME, (table) => {
      if (!hasTelegramBotToken) {
        table.text('telegram_bot_token').nullable();
      }
      if (!hasTelegramBotUsername) {
        table.string('telegram_bot_username', 255).nullable();
      }
      if (!hasTelegramBotName) {
        table.string('telegram_bot_name', 255).nullable();
      }
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) {
    return;
  }

  const hasTelegramBotToken = await knex.schema.hasColumn(TABLE_NAME, 'telegram_bot_token');
  const hasTelegramBotUsername = await knex.schema.hasColumn(TABLE_NAME, 'telegram_bot_username');
  const hasTelegramBotName = await knex.schema.hasColumn(TABLE_NAME, 'telegram_bot_name');

  if (hasTelegramBotToken || hasTelegramBotUsername || hasTelegramBotName) {
    await knex.schema.alterTable(TABLE_NAME, (table) => {
      if (hasTelegramBotName) {
        table.dropColumn('telegram_bot_name');
      }
      if (hasTelegramBotUsername) {
        table.dropColumn('telegram_bot_username');
      }
      if (hasTelegramBotToken) {
        table.dropColumn('telegram_bot_token');
      }
    });
  }
}
