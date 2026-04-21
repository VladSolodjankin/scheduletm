import type { Knex } from 'knex';

const TELEGRAM_USERS_TABLE = 'telegram_users';
const TELEGRAM_USER_SESSION_TABLE = 'telegram_user_sessions';

async function renameUsersTable(knex: Knex, from: string, to: string): Promise<void> {
  const hasFrom = await knex.schema.hasTable(from);
  const hasTo = await knex.schema.hasTable(to);

  if (hasFrom && !hasTo) {
    await knex.schema.renameTable(from, to);
  }
}

async function renameUserSessionTable(knex: Knex, from: string, to: string): Promise<void> {
  const hasFrom = await knex.schema.hasTable(from);
  const hasTo = await knex.schema.hasTable(to);

  if (hasFrom && !hasTo) {
    await knex.schema.renameTable(from, to);
  }
}

export async function up(knex: Knex): Promise<void> {
  await renameUsersTable(knex, 'users', TELEGRAM_USERS_TABLE);

  if (!(await knex.schema.hasTable(TELEGRAM_USER_SESSION_TABLE))) {
    await renameUserSessionTable(knex, 'user_sessions', TELEGRAM_USER_SESSION_TABLE);
    await renameUserSessionTable(knex, 'users_session', TELEGRAM_USER_SESSION_TABLE);
  }
}

export async function down(knex: Knex): Promise<void> {
  await renameUsersTable(knex, TELEGRAM_USERS_TABLE, 'users');
  await renameUserSessionTable(knex, TELEGRAM_USER_SESSION_TABLE, 'user_sessions');
}
