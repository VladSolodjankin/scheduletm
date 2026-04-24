import type { Knex } from 'knex';

const TABLE_NAME = 'web_user_integrations';

const INTEGRATION_COLUMNS = [
  'google_api_key',
  'google_refresh_token',
  'google_token_expires_at',
  'google_calendar_id',
  'google_connected_at',
  'telegram_bot_token',
  'telegram_bot_username',
  'telegram_bot_name',
] as const;

async function ensureTable(knex: Knex) {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (hasTable) {
    return;
  }

  await knex.schema.createTable(TABLE_NAME, (table) => {
    table.increments('id').primary();
    table
      .integer('account_id')
      .notNullable()
      .references('id')
      .inTable('accounts')
      .onDelete('CASCADE');
    table
      .integer('web_user_id')
      .notNullable()
      .references('id')
      .inTable('web_users')
      .onDelete('CASCADE');

    table.string('google_api_key');
    table.string('google_refresh_token');
    table.timestamp('google_token_expires_at', { useTz: true });
    table.string('google_calendar_id');
    table.timestamp('google_connected_at', { useTz: true });

    table.text('telegram_bot_token');
    table.string('telegram_bot_username', 255);
    table.string('telegram_bot_name', 255);

    table.timestamps(true, true);

    table.unique(['account_id', 'web_user_id'], {
      indexName: 'web_user_integrations_account_id_web_user_id_unique',
    });
    table.index(['account_id'], 'web_user_integrations_account_id_index');
    table.index(['web_user_id'], 'web_user_integrations_web_user_id_index');
  });
}

async function backfillFromWebUsers(knex: Knex) {
  const hasWebUsersTable = await knex.schema.hasTable('web_users');
  if (!hasWebUsersTable) {
    return;
  }

  const hasAllColumns = await Promise.all(
    INTEGRATION_COLUMNS.map((column) => knex.schema.hasColumn('web_users', column)),
  );

  if (hasAllColumns.some((hasColumn) => !hasColumn)) {
    return;
  }

  await knex.raw(`
    INSERT INTO ${TABLE_NAME} (
      account_id,
      web_user_id,
      google_api_key,
      google_refresh_token,
      google_token_expires_at,
      google_calendar_id,
      google_connected_at,
      telegram_bot_token,
      telegram_bot_username,
      telegram_bot_name,
      created_at,
      updated_at
    )
    SELECT
      wu.account_id,
      wu.id,
      wu.google_api_key,
      wu.google_refresh_token,
      wu.google_token_expires_at,
      wu.google_calendar_id,
      wu.google_connected_at,
      wu.telegram_bot_token,
      wu.telegram_bot_username,
      wu.telegram_bot_name,
      wu.created_at,
      wu.updated_at
    FROM web_users wu
    WHERE (
      wu.google_api_key IS NOT NULL OR
      wu.google_refresh_token IS NOT NULL OR
      wu.google_token_expires_at IS NOT NULL OR
      wu.google_calendar_id IS NOT NULL OR
      wu.google_connected_at IS NOT NULL OR
      wu.telegram_bot_token IS NOT NULL OR
      wu.telegram_bot_username IS NOT NULL OR
      wu.telegram_bot_name IS NOT NULL
    )
    ON CONFLICT (account_id, web_user_id) DO NOTHING
  `);
}

export async function up(knex: Knex): Promise<void> {
  await ensureTable(knex);
  await backfillFromWebUsers(knex);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE_NAME);
}
