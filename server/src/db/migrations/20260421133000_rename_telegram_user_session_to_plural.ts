import type { Knex } from 'knex';

const SINGULAR_TABLE = 'telegram_user_session';
const PLURAL_TABLE = 'telegram_user_sessions';

async function renameTableIfNeeded(knex: Knex, from: string, to: string): Promise<void> {
  const hasFrom = await knex.schema.hasTable(from);
  const hasTo = await knex.schema.hasTable(to);

  if (hasFrom && !hasTo) {
    await knex.schema.renameTable(from, to);
  }
}

export async function up(knex: Knex): Promise<void> {
  await renameTableIfNeeded(knex, SINGULAR_TABLE, PLURAL_TABLE);
}

export async function down(knex: Knex): Promise<void> {
  await renameTableIfNeeded(knex, PLURAL_TABLE, SINGULAR_TABLE);
}
