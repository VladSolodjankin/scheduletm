import type { Knex } from 'knex';

const TABLE = 'account_settings';
const COLUMNS = [
  'custom_bot_token_encrypted',
  'custom_bot_username',
  'custom_bot_name',
  'custom_bot_webhook_hash',
] as const;

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn(TABLE, 'custom_bot_token_encrypted'))) {
    await knex.schema.alterTable(TABLE, (table) => {
      table.text('custom_bot_token_encrypted').nullable();
      table.string('custom_bot_username', 255).nullable();
      table.string('custom_bot_name', 255).nullable();
      // sha256 of the token the webhook was last registered for; null means "needs registering".
      table.string('custom_bot_webhook_hash', 64).nullable();
    });
  }

  // Move the account's existing bot token (owner first) from the profile integration, as-is.
  // The default account is skipped: its token belongs to the shared platform bot.
  await knex.raw(`
    UPDATE account_settings AS settings
    SET custom_bot_token_encrypted = source.token,
        custom_bot_username = source.username,
        custom_bot_name = source.name
    FROM (
      SELECT DISTINCT ON (wui.account_id)
        wui.account_id,
        wui.telegram_bot_token_encrypted AS token,
        wui.telegram_bot_username AS username,
        wui.telegram_bot_name AS name
      FROM web_user_integrations AS wui
      JOIN web_users AS wu ON wu.id = wui.web_user_id AND wu.account_id = wui.account_id
      JOIN accounts AS acc ON acc.id = wui.account_id AND acc.code <> 'default'
      WHERE wui.telegram_bot_token_encrypted IS NOT NULL
        AND wu.is_active = true
        AND wu.role = 'owner'
      ORDER BY wui.account_id, wui.updated_at DESC
    ) AS source
    WHERE settings.account_id = source.account_id
      AND settings.custom_bot_token_encrypted IS NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn(TABLE, 'custom_bot_token_encrypted')) {
    await knex.schema.alterTable(TABLE, (table) => {
      table.dropColumns(...COLUMNS);
    });
  }
}
