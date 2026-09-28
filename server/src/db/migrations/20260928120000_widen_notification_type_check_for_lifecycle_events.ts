import type { Knex } from 'knex';

const NEW_NOTIFICATION_TYPES = [
  'appointment_created',
  'appointment_changed',
  'appointment_cancelled',
  'appointment_reminder',
  'payment_reminder',
];

const OLD_NOTIFICATION_TYPES = ['appointment_created', 'appointment_reminder', 'payment_reminder'];

function buildInClause(values: string[]) {
  return values.map((value) => `'${value}'`).join(', ');
}

async function setNotificationTypeCheck(knex: Knex, tableName: string, values: string[]) {
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) {
    return;
  }

  await knex.raw(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${tableName}_notification_type_check"`);
  await knex.raw(
    `ALTER TABLE "${tableName}" ADD CONSTRAINT "${tableName}_notification_type_check" CHECK ("notification_type" IN (${buildInClause(values)}))`,
  );
}

const TABLES = ['account_notification_defaults', 'specialist_notification_settings', 'client_notification_settings'];

export async function up(knex: Knex): Promise<void> {
  for (const table of TABLES) {
    await setNotificationTypeCheck(knex, table, NEW_NOTIFICATION_TYPES);
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const table of TABLES) {
    await setNotificationTypeCheck(knex, table, OLD_NOTIFICATION_TYPES);
  }
}
