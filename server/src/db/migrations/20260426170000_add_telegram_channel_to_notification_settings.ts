import type { Knex } from 'knex';

const CHANNELS = ['email', 'telegram', 'viber', 'whatsapp', 'sms'];

function buildInClause(values: string[]) {
  return values.map((value) => `'${value}'`).join(', ');
}

async function replaceChannelCheck(knex: Knex, tableName: string, columnName: string) {
  const constraintName = `${tableName}_${columnName}_check`;
  await knex.raw(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${constraintName}"`);
  await knex.raw(
    `ALTER TABLE "${tableName}" ADD CONSTRAINT "${constraintName}" CHECK ("${columnName}" IN (${buildInClause(CHANNELS)}))`,
  );
}

export async function up(knex: Knex): Promise<void> {
  await replaceChannelCheck(knex, 'account_notification_defaults', 'preferred_channel');
  await replaceChannelCheck(knex, 'specialist_notification_settings', 'preferred_channel');
  await replaceChannelCheck(knex, 'client_notification_settings', 'channel');
}

export async function down(knex: Knex): Promise<void> {
  const channels = ['email', 'viber', 'whatsapp', 'sms'];
  const build = (values: string[]) => values.map((value) => `'${value}'`).join(', ');

  await knex.raw('ALTER TABLE "account_notification_defaults" DROP CONSTRAINT IF EXISTS "account_notification_defaults_preferred_channel_check"');
  await knex.raw(`ALTER TABLE "account_notification_defaults" ADD CONSTRAINT "account_notification_defaults_preferred_channel_check" CHECK ("preferred_channel" IN (${build(channels)}))`);

  await knex.raw('ALTER TABLE "specialist_notification_settings" DROP CONSTRAINT IF EXISTS "specialist_notification_settings_preferred_channel_check"');
  await knex.raw(`ALTER TABLE "specialist_notification_settings" ADD CONSTRAINT "specialist_notification_settings_preferred_channel_check" CHECK ("preferred_channel" IN (${build(channels)}))`);

  await knex.raw('ALTER TABLE "client_notification_settings" DROP CONSTRAINT IF EXISTS "client_notification_settings_channel_check"');
  await knex.raw(`ALTER TABLE "client_notification_settings" ADD CONSTRAINT "client_notification_settings_channel_check" CHECK ("channel" IN (${build(channels)}))`);
}
