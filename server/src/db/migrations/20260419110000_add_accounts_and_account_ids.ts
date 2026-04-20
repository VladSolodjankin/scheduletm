import type { Knex } from 'knex';

const DEFAULT_ACCOUNT = {
  code: 'default',
  name: 'Default workspace',
};

const TABLES_WITH_ACCOUNT_ID = [
  'users',
  'services',
  'specialists',
  'appointments',
  'app_settings',
  'user_sessions',
  'notifications',
] as const;

async function ensureAccountsTable(knex: Knex) {
  const hasAccounts = await knex.schema.hasTable('accounts');

  if (!hasAccounts) {
    await knex.schema.createTable('accounts', (table) => {
      table.increments('id').primary();
      table.string('code').notNullable().unique();
      table.string('name').notNullable();
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamps(true, true);
    });
  }
}

async function ensureDefaultAccount(knex: Knex) {
  const existing = await knex('accounts')
    .where({ code: DEFAULT_ACCOUNT.code })
    .first<{ id: number }>('id');

  if (existing) {
    return existing.id;
  }

  const [account] = await knex('accounts')
    .insert(DEFAULT_ACCOUNT)
    .returning<{ id: number }[]>('id');

  return account.id;
}

async function addAccountIdColumn(
  knex: Knex,
  tableName: (typeof TABLES_WITH_ACCOUNT_ID)[number],
  defaultAccountId: number,
) {
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) {
    return;
  }

  const hasAccountId = await knex.schema.hasColumn(tableName, 'account_id');
  if (!hasAccountId) {
    await knex.schema.alterTable(tableName, (table) => {
      table
        .integer('account_id')
        .references('id')
        .inTable('accounts')
        .onDelete('CASCADE');
    });
  }

  await knex(tableName).whereNull('account_id').update({ account_id: defaultAccountId });

  await knex.schema.alterTable(tableName, (table) => {
    table.integer('account_id').notNullable().alter();
  });

  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "${tableName}_account_id_index" ON "${tableName}" ("account_id")`,
  );
}

export async function up(knex: Knex): Promise<void> {
  await ensureAccountsTable(knex);
  const defaultAccountId = await ensureDefaultAccount(knex);

  for (const tableName of TABLES_WITH_ACCOUNT_ID) {
    await addAccountIdColumn(knex, tableName, defaultAccountId);
  }

  await knex.raw('ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_telegram_id_unique"');
  await knex.raw(
    'ALTER TABLE "users" ADD CONSTRAINT "users_account_id_telegram_id_unique" UNIQUE ("account_id", "telegram_id")',
  );

  await knex.raw(
    'ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "services_code_unique"',
  );
  await knex.raw(
    'ALTER TABLE "services" ADD CONSTRAINT "services_account_id_code_unique" UNIQUE ("account_id", "code")',
  );

  await knex.raw(
    'ALTER TABLE "specialists" DROP CONSTRAINT IF EXISTS "specialists_code_unique"',
  );
  await knex.raw(
    'ALTER TABLE "specialists" ADD CONSTRAINT "specialists_account_id_code_unique" UNIQUE ("account_id", "code")',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    'ALTER TABLE "specialists" DROP CONSTRAINT IF EXISTS "specialists_account_id_code_unique"',
  );
  await knex.raw(
    'ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "services_account_id_code_unique"',
  );
  await knex.raw(
    'ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_account_id_telegram_id_unique"',
  );

  await knex.raw(
    'ALTER TABLE "specialists" ADD CONSTRAINT "specialists_code_unique" UNIQUE ("code")',
  );
  await knex.raw(
    'ALTER TABLE "services" ADD CONSTRAINT "services_code_unique" UNIQUE ("code")',
  );
  await knex.raw(
    'ALTER TABLE "users" ADD CONSTRAINT "users_telegram_id_unique" UNIQUE ("telegram_id")',
  );

  for (const tableName of [...TABLES_WITH_ACCOUNT_ID].reverse()) {
    const hasTable = await knex.schema.hasTable(tableName);
    const hasAccountId = hasTable
      ? await knex.schema.hasColumn(tableName, 'account_id')
      : false;

    if (!hasAccountId) {
      continue;
    }

    await knex.raw(`DROP INDEX IF EXISTS "${tableName}_account_id_index"`);
    await knex.schema.alterTable(tableName, (table) => {
      table.dropColumn('account_id');
    });
  }

  await knex.schema.dropTableIfExists('accounts');
}
