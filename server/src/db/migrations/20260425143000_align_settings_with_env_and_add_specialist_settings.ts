import type { Knex } from 'knex';

const SYSTEM_SETTINGS_TABLE = 'system_settings';
const SPECIALISTS_TABLE = 'specialists';
const SPECIALIST_SETTINGS_TABLE = 'specialist_settings';

async function dropOAuthColumnsFromSystemSettings(knex: Knex) {
  const hasSystemSettings = await knex.schema.hasTable(SYSTEM_SETTINGS_TABLE);
  if (!hasSystemSettings) {
    return;
  }

  const hasClientId = await knex.schema.hasColumn(SYSTEM_SETTINGS_TABLE, 'google_oauth_client_id');
  const hasClientSecret = await knex.schema.hasColumn(SYSTEM_SETTINGS_TABLE, 'google_oauth_client_secret');
  const hasRedirectUri = await knex.schema.hasColumn(SYSTEM_SETTINGS_TABLE, 'google_oauth_redirect_uri');

  if (!hasClientId && !hasClientSecret && !hasRedirectUri) {
    return;
  }

  await knex.schema.alterTable(SYSTEM_SETTINGS_TABLE, (table) => {
    if (hasClientId) {
      table.dropColumn('google_oauth_client_id');
    }

    if (hasClientSecret) {
      table.dropColumn('google_oauth_client_secret');
    }

    if (hasRedirectUri) {
      table.dropColumn('google_oauth_redirect_uri');
    }
  });
}

async function createSpecialistSettingsTable(knex: Knex) {
  const hasTable = await knex.schema.hasTable(SPECIALIST_SETTINGS_TABLE);
  if (hasTable) {
    return;
  }

  await knex.schema.createTable(SPECIALIST_SETTINGS_TABLE, (table) => {
    table.increments('id').primary();
    table
      .integer('account_id')
      .notNullable()
      .references('id')
      .inTable('accounts')
      .onDelete('CASCADE');
    table
      .integer('specialist_id')
      .notNullable()
      .references('id')
      .inTable(SPECIALISTS_TABLE)
      .onDelete('CASCADE');
    table.integer('base_session_price').notNullable().defaultTo(0);
    table.integer('base_hour_price').notNullable().defaultTo(0);
    table.integer('work_start_hour').notNullable().defaultTo(9);
    table.integer('work_end_hour').notNullable().defaultTo(20);
    table.integer('slot_duration_min').notNullable().defaultTo(90);
    table.integer('slot_step_min').notNullable().defaultTo(30);
    table.integer('default_session_continuation_min').notNullable().defaultTo(60);
    table.timestamps(true, true);

    table.unique(['specialist_id'], { indexName: 'specialist_settings_specialist_id_unique' });
    table.index(['account_id'], 'specialist_settings_account_id_index');
  });
}

async function backfillSpecialistSettings(knex: Knex) {
  const hasSpecialists = await knex.schema.hasTable(SPECIALISTS_TABLE);
  const hasSpecialistSettings = await knex.schema.hasTable(SPECIALIST_SETTINGS_TABLE);

  if (!hasSpecialists || !hasSpecialistSettings) {
    return;
  }

  await knex.raw(`
    INSERT INTO specialist_settings (
      account_id,
      specialist_id,
      base_session_price,
      base_hour_price,
      work_start_hour,
      work_end_hour,
      slot_duration_min,
      slot_step_min,
      default_session_continuation_min,
      created_at,
      updated_at
    )
    SELECT
      s.account_id,
      s.id,
      COALESCE(s.base_session_price, 0),
      COALESCE(s.base_hour_price, 0),
      COALESCE(s.work_start_hour, 9),
      COALESCE(s.work_end_hour, 20),
      COALESCE(s.slot_duration_min, 90),
      COALESCE(s.slot_step_min, 30),
      COALESCE(s.slot_duration_min, 90),
      s.created_at,
      s.updated_at
    FROM specialists s
    ON CONFLICT (specialist_id) DO NOTHING
  `);
}

export async function up(knex: Knex): Promise<void> {
  await dropOAuthColumnsFromSystemSettings(knex);
  await createSpecialistSettingsTable(knex);
  await backfillSpecialistSettings(knex);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(SPECIALIST_SETTINGS_TABLE);

  const hasSystemSettings = await knex.schema.hasTable(SYSTEM_SETTINGS_TABLE);
  if (!hasSystemSettings) {
    return;
  }

  const hasClientId = await knex.schema.hasColumn(SYSTEM_SETTINGS_TABLE, 'google_oauth_client_id');
  const hasClientSecret = await knex.schema.hasColumn(SYSTEM_SETTINGS_TABLE, 'google_oauth_client_secret');
  const hasRedirectUri = await knex.schema.hasColumn(SYSTEM_SETTINGS_TABLE, 'google_oauth_redirect_uri');

  if (hasClientId && hasClientSecret && hasRedirectUri) {
    return;
  }

  await knex.schema.alterTable(SYSTEM_SETTINGS_TABLE, (table) => {
    if (!hasClientId) {
      table.string('google_oauth_client_id', 255);
    }

    if (!hasClientSecret) {
      table.string('google_oauth_client_secret', 255);
    }

    if (!hasRedirectUri) {
      table.string('google_oauth_redirect_uri', 1024);
    }
  });
}
