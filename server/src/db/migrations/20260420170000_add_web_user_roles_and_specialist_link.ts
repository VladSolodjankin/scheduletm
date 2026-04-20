import type { Knex } from 'knex';
import { WEB_USER_ROLES, WebUserRole } from '../../types/webUserRole.js';

const WEB_USERS_TABLE = 'web_users';
const SPECIALISTS_TABLE = 'specialists';
const ROLE_CHECK = `role IN (${WEB_USER_ROLES.map((role) => `'${role}'`).join(', ')})`;

async function ensureWebUsersRole(knex: Knex) {
  const hasWebUsers = await knex.schema.hasTable(WEB_USERS_TABLE);
  if (!hasWebUsers) {
    return;
  }

  const hasRole = await knex.schema.hasColumn(WEB_USERS_TABLE, 'role');
  if (!hasRole) {
    await knex.schema.alterTable(WEB_USERS_TABLE, (table) => {
      table.string('role').notNullable().defaultTo(WebUserRole.Owner);
    });
  }

  await knex.raw(
    `ALTER TABLE "${WEB_USERS_TABLE}" DROP CONSTRAINT IF EXISTS "web_users_role_check"`,
  );
  await knex.raw(
    `ALTER TABLE "${WEB_USERS_TABLE}" ADD CONSTRAINT "web_users_role_check" CHECK (${ROLE_CHECK})`,
  );
}

async function ensureSpecialistsWebUserId(knex: Knex) {
  const hasSpecialists = await knex.schema.hasTable(SPECIALISTS_TABLE);
  if (!hasSpecialists) {
    return;
  }

  const hasWebUserId = await knex.schema.hasColumn(SPECIALISTS_TABLE, 'web_user_id');
  if (!hasWebUserId) {
    await knex.schema.alterTable(SPECIALISTS_TABLE, (table) => {
      table
        .integer('web_user_id')
        .references('id')
        .inTable(WEB_USERS_TABLE)
        .onDelete('SET NULL');
    });
  }

  await knex.raw(
    `CREATE UNIQUE INDEX IF NOT EXISTS "specialists_account_id_web_user_id_unique" ON "${SPECIALISTS_TABLE}" ("account_id", "web_user_id") WHERE "web_user_id" IS NOT NULL`,
  );
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "specialists_web_user_id_index" ON "${SPECIALISTS_TABLE}" ("web_user_id")`,
  );
}

export async function up(knex: Knex): Promise<void> {
  await ensureWebUsersRole(knex);
  await ensureSpecialistsWebUserId(knex);
}

export async function down(knex: Knex): Promise<void> {
  const hasSpecialists = await knex.schema.hasTable(SPECIALISTS_TABLE);
  if (hasSpecialists) {
    await knex.raw('DROP INDEX IF EXISTS "specialists_web_user_id_index"');
    await knex.raw('DROP INDEX IF EXISTS "specialists_account_id_web_user_id_unique"');

    const hasWebUserId = await knex.schema.hasColumn(SPECIALISTS_TABLE, 'web_user_id');
    if (hasWebUserId) {
      await knex.schema.alterTable(SPECIALISTS_TABLE, (table) => {
        table.dropColumn('web_user_id');
      });
    }
  }

  const hasWebUsers = await knex.schema.hasTable(WEB_USERS_TABLE);
  if (!hasWebUsers) {
    return;
  }

  await knex.raw(
    `ALTER TABLE "${WEB_USERS_TABLE}" DROP CONSTRAINT IF EXISTS "web_users_role_check"`,
  );

  const hasRole = await knex.schema.hasColumn(WEB_USERS_TABLE, 'role');
  if (hasRole) {
    await knex.schema.alterTable(WEB_USERS_TABLE, (table) => {
      table.dropColumn('role');
    });
  }
}
