import type { Knex } from 'knex';

const APP_SETTINGS_TABLE = 'app_settings';
const WEB_USERS_TABLE = 'web_users';
const LOGIN_ATTEMPTS_TABLE = 'login_attempts';
const GOOGLE_OAUTH_STATES_TABLE = 'google_oauth_states';

export async function up(knex: Knex): Promise<void> {
  const hasAppSettings = await knex.schema.hasTable(APP_SETTINGS_TABLE);
  if (hasAppSettings) {
    const hasDailyDigest = await knex.schema.hasColumn(APP_SETTINGS_TABLE, 'daily_digest_enabled');
    const hasWeekStartsOnMonday = await knex.schema.hasColumn(APP_SETTINGS_TABLE, 'week_starts_on_monday');
    const hasLocale = await knex.schema.hasColumn(APP_SETTINGS_TABLE, 'locale');

    await knex.schema.alterTable(APP_SETTINGS_TABLE, (table) => {
      if (!hasDailyDigest) {
        table.boolean('daily_digest_enabled').notNullable().defaultTo(true);
      }

      if (!hasWeekStartsOnMonday) {
        table.boolean('week_starts_on_monday').notNullable().defaultTo(true);
      }

      if (!hasLocale) {
        table.string('locale', 16).notNullable().defaultTo('ru-RU');
      }
    });
  }

  const hasWebUsers = await knex.schema.hasTable(WEB_USERS_TABLE);
  if (hasWebUsers) {
    const hasTimezone = await knex.schema.hasColumn(WEB_USERS_TABLE, 'timezone');
    const hasLocale = await knex.schema.hasColumn(WEB_USERS_TABLE, 'locale');
    const hasUiThemeMode = await knex.schema.hasColumn(WEB_USERS_TABLE, 'ui_theme_mode');
    const hasUiPaletteVariantId = await knex.schema.hasColumn(WEB_USERS_TABLE, 'ui_palette_variant_id');

    await knex.schema.alterTable(WEB_USERS_TABLE, (table) => {
      if (!hasTimezone) {
        table.string('timezone', 64).notNullable().defaultTo('UTC');
      }

      if (!hasLocale) {
        table.string('locale', 16).notNullable().defaultTo('ru-RU');
      }

      if (!hasUiThemeMode) {
        table.string('ui_theme_mode', 8).notNullable().defaultTo('light');
      }

      if (!hasUiPaletteVariantId) {
        table.string('ui_palette_variant_id', 64).notNullable().defaultTo('default');
      }
    });

    await knex.raw(
      `ALTER TABLE "${WEB_USERS_TABLE}" DROP CONSTRAINT IF EXISTS "web_users_ui_theme_mode_check"`,
    );
    await knex.raw(
      `ALTER TABLE "${WEB_USERS_TABLE}" ADD CONSTRAINT "web_users_ui_theme_mode_check" CHECK (ui_theme_mode IN ('light', 'dark'))`,
    );
  }

  const hasLoginAttempts = await knex.schema.hasTable(LOGIN_ATTEMPTS_TABLE);
  if (!hasLoginAttempts) {
    await knex.schema.createTable(LOGIN_ATTEMPTS_TABLE, (table) => {
      table.increments('id').primary();
      table.string('ip', 128).notNullable().unique();
      table.integer('fail_count').notNullable().defaultTo(0);
      table.timestamp('locked_until', { useTz: true });
      table.timestamp('last_failed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamps(true, true);
    });
  }

  const hasGoogleOauthStates = await knex.schema.hasTable(GOOGLE_OAUTH_STATES_TABLE);
  if (!hasGoogleOauthStates) {
    await knex.schema.createTable(GOOGLE_OAUTH_STATES_TABLE, (table) => {
      table.increments('id').primary();
      table.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
      table.integer('web_user_id').notNullable().references('id').inTable('web_users').onDelete('CASCADE');
      table.string('state_token', 128).notNullable().unique();
      table.timestamp('expires_at', { useTz: true }).notNullable();
      table.timestamps(true, true);

      table.index(['account_id'], 'google_oauth_states_account_id_index');
      table.index(['web_user_id'], 'google_oauth_states_web_user_id_index');
      table.index(['expires_at'], 'google_oauth_states_expires_at_index');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(GOOGLE_OAUTH_STATES_TABLE);
  await knex.schema.dropTableIfExists(LOGIN_ATTEMPTS_TABLE);

  const hasWebUsers = await knex.schema.hasTable(WEB_USERS_TABLE);
  if (hasWebUsers) {
    await knex.raw(
      `ALTER TABLE "${WEB_USERS_TABLE}" DROP CONSTRAINT IF EXISTS "web_users_ui_theme_mode_check"`,
    );

    const dropIfExists = async (columnName: string) => {
      const hasColumn = await knex.schema.hasColumn(WEB_USERS_TABLE, columnName);
      if (!hasColumn) {
        return;
      }

      await knex.schema.alterTable(WEB_USERS_TABLE, (table) => {
        table.dropColumn(columnName);
      });
    };

    await dropIfExists('ui_palette_variant_id');
    await dropIfExists('ui_theme_mode');
    await dropIfExists('locale');
    await dropIfExists('timezone');
  }

  const hasAppSettings = await knex.schema.hasTable(APP_SETTINGS_TABLE);
  if (hasAppSettings) {
    const dropIfExists = async (columnName: string) => {
      const hasColumn = await knex.schema.hasColumn(APP_SETTINGS_TABLE, columnName);
      if (!hasColumn) {
        return;
      }

      await knex.schema.alterTable(APP_SETTINGS_TABLE, (table) => {
        table.dropColumn(columnName);
      });
    };

    await dropIfExists('locale');
    await dropIfExists('week_starts_on_monday');
    await dropIfExists('daily_digest_enabled');
  }
}
