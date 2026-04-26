import type { Knex } from 'knex';

const NOTIFICATION_TYPES = ['appointment_created', 'appointment_reminder', 'payment_reminder'];
const CHANNELS = ['email', 'viber', 'whatsapp', 'sms'];
const FREQUENCIES = ['immediate', 'daily'];

function buildInClause(values: string[]) {
  return values.map((value) => `'${value}'`).join(', ');
}

function addNotificationTypeCheck(knex: Knex, tableName: string, columnName: string) {
  return knex.raw(
    `ALTER TABLE "${tableName}" ADD CONSTRAINT "${tableName}_${columnName}_check" CHECK ("${columnName}" IN (${buildInClause(NOTIFICATION_TYPES)}))`,
  );
}

function addChannelCheck(knex: Knex, tableName: string, columnName: string) {
  return knex.raw(
    `ALTER TABLE "${tableName}" ADD CONSTRAINT "${tableName}_${columnName}_check" CHECK ("${columnName}" IN (${buildInClause(CHANNELS)}))`,
  );
}

async function createAccountNotificationDefaultsTable(knex: Knex) {
  const hasTable = await knex.schema.hasTable('account_notification_defaults');
  if (hasTable) {
    return;
  }

  await knex.schema.createTable('account_notification_defaults', (table) => {
    table.increments('id').primary();
    table.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.string('notification_type', 64).notNullable();
    table.string('preferred_channel', 32).notNullable();
    table.boolean('enabled').notNullable().defaultTo(true);
    table.jsonb('send_timings').notNullable().defaultTo('[]');
    table.string('frequency', 32).notNullable().defaultTo('immediate');
    table.timestamps(true, true);

    table.unique(['account_id', 'notification_type', 'preferred_channel'], {
      indexName: 'account_notification_defaults_account_type_channel_unique',
    });
    table.index(['account_id'], 'account_notification_defaults_account_id_index');
  });

  await addNotificationTypeCheck(knex, 'account_notification_defaults', 'notification_type');
  await addChannelCheck(knex, 'account_notification_defaults', 'preferred_channel');
  await knex.raw(
    `ALTER TABLE "account_notification_defaults" ADD CONSTRAINT "account_notification_defaults_frequency_check" CHECK ("frequency" IN (${buildInClause(FREQUENCIES)}))`,
  );
}

async function createSpecialistNotificationSettingsTable(knex: Knex) {
  const hasTable = await knex.schema.hasTable('specialist_notification_settings');
  if (hasTable) {
    return;
  }

  await knex.schema.createTable('specialist_notification_settings', (table) => {
    table.increments('id').primary();
    table.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.integer('specialist_id').notNullable().references('id').inTable('specialists').onDelete('CASCADE');
    table.string('notification_type', 64).notNullable();
    table.string('preferred_channel', 32).notNullable();
    table.boolean('enabled').notNullable().defaultTo(true);
    table.jsonb('send_timings').notNullable().defaultTo('[]');
    table.string('frequency', 32).notNullable().defaultTo('immediate');
    table.timestamps(true, true);

    table.unique(['account_id', 'specialist_id', 'notification_type', 'preferred_channel'], {
      indexName: 'specialist_notification_settings_account_specialist_type_channel_unique',
    });
    table.index(['account_id'], 'specialist_notification_settings_account_id_index');
    table.index(['specialist_id'], 'specialist_notification_settings_specialist_id_index');
  });

  await addNotificationTypeCheck(knex, 'specialist_notification_settings', 'notification_type');
  await addChannelCheck(knex, 'specialist_notification_settings', 'preferred_channel');
  await knex.raw(
    `ALTER TABLE "specialist_notification_settings" ADD CONSTRAINT "specialist_notification_settings_frequency_check" CHECK ("frequency" IN (${buildInClause(FREQUENCIES)}))`,
  );
}

async function createClientNotificationSettingsTable(knex: Knex) {
  const hasTable = await knex.schema.hasTable('client_notification_settings');
  if (hasTable) {
    return;
  }

  await knex.schema.createTable('client_notification_settings', (table) => {
    table.increments('id').primary();
    table.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.integer('client_id').notNullable().references('id').inTable('clients').onDelete('CASCADE');
    table.string('notification_type', 64).notNullable();
    table.string('channel', 32).notNullable();
    table.boolean('enabled').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.unique(['account_id', 'client_id', 'notification_type', 'channel'], {
      indexName: 'client_notification_settings_account_client_type_channel_unique',
    });
    table.index(['account_id'], 'client_notification_settings_account_id_index');
    table.index(['client_id'], 'client_notification_settings_client_id_index');
  });

  await addNotificationTypeCheck(knex, 'client_notification_settings', 'notification_type');
  await addChannelCheck(knex, 'client_notification_settings', 'channel');
}

export async function up(knex: Knex): Promise<void> {
  await createAccountNotificationDefaultsTable(knex);
  await createSpecialistNotificationSettingsTable(knex);
  await createClientNotificationSettingsTable(knex);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('client_notification_settings');
  await knex.schema.dropTableIfExists('specialist_notification_settings');
  await knex.schema.dropTableIfExists('account_notification_defaults');
}
