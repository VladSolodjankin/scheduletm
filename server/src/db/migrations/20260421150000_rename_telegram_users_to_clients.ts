import type { Knex } from 'knex';

const LEGACY_TABLES = ['telegram_users', 'users'] as const;
const TARGET_TABLE = 'clients';

async function ensureClientsTable(knex: Knex): Promise<void> {
  const hasClients = await knex.schema.hasTable(TARGET_TABLE);
  if (hasClients) {
    return;
  }

  for (const source of LEGACY_TABLES) {
    const hasSource = await knex.schema.hasTable(source);
    if (hasSource) {
      await knex.schema.renameTable(source, TARGET_TABLE);
      return;
    }
  }
}

async function dropLegacyConstraints(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "users_account_id_telegram_id_unique"');
  await knex.raw('ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "users_telegram_id_unique"');
  await knex.raw('ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "telegram_users_account_id_telegram_id_unique"');
}

export async function up(knex: Knex): Promise<void> {
  await ensureClientsTable(knex);

  const hasClients = await knex.schema.hasTable(TARGET_TABLE);
  if (!hasClients) {
    return;
  }

  await dropLegacyConstraints(knex);

  await knex.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS "clients_account_id_telegram_id_unique" ON "clients" ("account_id", "telegram_id") WHERE "telegram_id" IS NOT NULL',
  );

  await knex.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS "clients_account_id_phone_unique" ON "clients" ("account_id", "phone") WHERE "phone" IS NOT NULL',
  );

  await knex.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS "clients_account_id_email_ci_unique" ON "clients" ("account_id", LOWER("email")) WHERE "email" IS NOT NULL',
  );
}

export async function down(knex: Knex): Promise<void> {
  const hasClients = await knex.schema.hasTable(TARGET_TABLE);
  if (!hasClients) {
    return;
  }

  await knex.raw('DROP INDEX IF EXISTS "clients_account_id_email_ci_unique"');
  await knex.raw('DROP INDEX IF EXISTS "clients_account_id_phone_unique"');
  await knex.raw('DROP INDEX IF EXISTS "clients_account_id_telegram_id_unique"');

  const hasTelegramUsers = await knex.schema.hasTable('telegram_users');
  if (!hasTelegramUsers) {
    await knex.schema.renameTable(TARGET_TABLE, 'telegram_users');
  }
}
