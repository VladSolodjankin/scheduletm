import type { Knex } from 'knex';

async function createSystemSettingsTable(knex: Knex) {
  const hasTable = await knex.schema.hasTable('system_settings');
  if (hasTable) {
    return;
  }

  await knex.schema.createTable('system_settings', (table) => {
    table.increments('id').primary();
    table.boolean('daily_digest_enabled').notNullable().defaultTo(true);
    table.integer('default_meeting_duration').notNullable().defaultTo(30);
    table.boolean('week_starts_on_monday').notNullable().defaultTo(true);
    table.integer('refresh_token_ttl_days').notNullable().defaultTo(30);
    table.integer('access_token_ttl_seconds').notNullable().defaultTo(900);
    table.string('session_cookie_name', 128).notNullable().defaultTo('meetli_refresh_token');
    table.string('google_oauth_client_id', 255);
    table.string('google_oauth_client_secret', 255);
    table.string('google_oauth_redirect_uri', 1024);
    table.timestamps(true, true);
  });
}

async function createAccountSettingsTable(knex: Knex) {
  const hasTable = await knex.schema.hasTable('account_settings');
  if (hasTable) {
    return;
  }

  await knex.schema.createTable('account_settings', (table) => {
    table.increments('id').primary();
    table
      .integer('account_id')
      .notNullable()
      .references('id')
      .inTable('accounts')
      .onDelete('CASCADE');
    table.string('timezone', 64).notNullable().defaultTo('UTC');
    table.integer('slot_duration_min').notNullable().defaultTo(30);
    table.boolean('daily_digest_enabled').notNullable().defaultTo(true);
    table.boolean('week_starts_on_monday').notNullable().defaultTo(true);
    table.string('locale', 16).notNullable().defaultTo('ru-RU');
    table.timestamps(true, true);

    table.unique(['account_id'], { indexName: 'account_settings_account_id_unique' });
    table.index(['account_id'], 'account_settings_account_id_index');
  });
}

async function createUserSettingsTable(knex: Knex) {
  const hasTable = await knex.schema.hasTable('user_settings');
  if (hasTable) {
    return;
  }

  await knex.schema.createTable('user_settings', (table) => {
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
    table.string('timezone', 64).notNullable().defaultTo('UTC');
    table.string('locale', 16).notNullable().defaultTo('ru-RU');
    table.string('ui_theme_mode', 10).notNullable().defaultTo('light');
    table.string('ui_palette_variant_id', 64).notNullable().defaultTo('default');
    table.timestamps(true, true);

    table.unique(['account_id', 'web_user_id'], { indexName: 'user_settings_account_id_web_user_id_unique' });
    table.index(['account_id'], 'user_settings_account_id_index');
    table.index(['web_user_id'], 'user_settings_web_user_id_index');
  });
}

async function createUserIntegrationsTable(knex: Knex) {
  const hasTable = await knex.schema.hasTable('user_integrations');
  if (hasTable) {
    return;
  }

  await knex.schema.createTable('user_integrations', (table) => {
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

    table.unique(['account_id', 'web_user_id'], { indexName: 'user_integrations_account_id_web_user_id_unique' });
    table.index(['account_id'], 'user_integrations_account_id_index');
    table.index(['web_user_id'], 'user_integrations_web_user_id_index');
  });
}

async function backfillAccountSettings(knex: Knex) {
  const hasAppSettings = await knex.schema.hasTable('app_settings');
  if (!hasAppSettings) {
    return;
  }

  await knex.raw(`
    INSERT INTO account_settings (
      account_id,
      timezone,
      slot_duration_min,
      daily_digest_enabled,
      week_starts_on_monday,
      locale,
      created_at,
      updated_at
    )
    SELECT
      app.account_id,
      app.timezone,
      app.slot_duration_min,
      app.daily_digest_enabled,
      app.week_starts_on_monday,
      app.locale,
      app.created_at,
      app.updated_at
    FROM app_settings app
    WHERE app.account_id IS NOT NULL
    ON CONFLICT (account_id) DO NOTHING
  `);
}

async function backfillUserSettings(knex: Knex) {
  await knex.raw(`
    INSERT INTO user_settings (
      account_id,
      web_user_id,
      timezone,
      locale,
      ui_theme_mode,
      ui_palette_variant_id,
      created_at,
      updated_at
    )
    SELECT
      wu.account_id,
      wu.id,
      wu.timezone,
      wu.locale,
      wu.ui_theme_mode,
      wu.ui_palette_variant_id,
      wu.created_at,
      wu.updated_at
    FROM web_users wu
    ON CONFLICT (account_id, web_user_id) DO NOTHING
  `);
}

async function backfillUserIntegrations(knex: Knex) {
  const hasWebUserIntegrations = await knex.schema.hasTable('web_user_integrations');
  if (!hasWebUserIntegrations) {
    return;
  }

  await knex.raw(`
    INSERT INTO user_integrations (
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
      wui.account_id,
      wui.web_user_id,
      wui.google_api_key,
      wui.google_refresh_token,
      wui.google_token_expires_at,
      wui.google_calendar_id,
      wui.google_connected_at,
      wui.telegram_bot_token,
      wui.telegram_bot_username,
      wui.telegram_bot_name,
      wui.created_at,
      wui.updated_at
    FROM web_user_integrations wui
    ON CONFLICT (account_id, web_user_id) DO NOTHING
  `);
}

async function backfillSystemSettings(knex: Knex) {
  const hasAppSettings = await knex.schema.hasTable('app_settings');
  const base = hasAppSettings
    ? await knex('app_settings').orderBy('id', 'asc').first<{
      slot_duration_min: number;
      daily_digest_enabled: boolean;
      week_starts_on_monday: boolean;
      created_at: Date;
      updated_at: Date;
    }>('slot_duration_min', 'daily_digest_enabled', 'week_starts_on_monday', 'created_at', 'updated_at')
    : null;

  const exists = await knex('system_settings').first<{ id: number }>('id');
  if (exists) {
    return;
  }

  await knex('system_settings').insert({
    daily_digest_enabled: base?.daily_digest_enabled ?? true,
    default_meeting_duration: base?.slot_duration_min ?? 30,
    week_starts_on_monday: base?.week_starts_on_monday ?? true,
    created_at: base?.created_at ?? knex.fn.now(),
    updated_at: base?.updated_at ?? knex.fn.now(),
  });
}

export async function up(knex: Knex): Promise<void> {
  await createSystemSettingsTable(knex);
  await createAccountSettingsTable(knex);
  await createUserSettingsTable(knex);
  await createUserIntegrationsTable(knex);

  await backfillAccountSettings(knex);
  await backfillUserSettings(knex);
  await backfillUserIntegrations(knex);
  await backfillSystemSettings(knex);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_integrations');
  await knex.schema.dropTableIfExists('user_settings');
  await knex.schema.dropTableIfExists('account_settings');
  await knex.schema.dropTableIfExists('system_settings');
}
