import type { Knex } from 'knex';
import { WEB_USER_ROLES } from '../../types/webUserRole.js';

const WEB_USERS_TABLE = 'web_users';
const CLIENTS_TABLE = 'clients';
const ROLE_CHECK = `role IN (${WEB_USER_ROLES.map((role) => `'${role}'`).join(', ')})`;

export async function up(knex: Knex): Promise<void> {
  const hasWebUsers = await knex.schema.hasTable(WEB_USERS_TABLE);
  if (!hasWebUsers) {
    return;
  }

  const hasClientId = await knex.schema.hasColumn(WEB_USERS_TABLE, 'client_id');
  if (!hasClientId) {
    await knex.schema.alterTable(WEB_USERS_TABLE, (table) => {
      table
        .integer('client_id')
        .references('id')
        .inTable(CLIENTS_TABLE)
        .onDelete('SET NULL');
    });
  }

  await knex.raw(
    `CREATE UNIQUE INDEX IF NOT EXISTS "web_users_account_id_client_id_unique" ON "${WEB_USERS_TABLE}" ("account_id", "client_id") WHERE "client_id" IS NOT NULL`,
  );
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "web_users_client_id_index" ON "${WEB_USERS_TABLE}" ("client_id")`,
  );

  await knex.raw(`ALTER TABLE "${WEB_USERS_TABLE}" DROP CONSTRAINT IF EXISTS "web_users_role_check"`);
  await knex.raw(`ALTER TABLE "${WEB_USERS_TABLE}" ADD CONSTRAINT "web_users_role_check" CHECK (${ROLE_CHECK})`);
}

export async function down(knex: Knex): Promise<void> {
  const hasWebUsers = await knex.schema.hasTable(WEB_USERS_TABLE);
  if (!hasWebUsers) {
    return;
  }

  await knex.raw('DROP INDEX IF EXISTS "web_users_client_id_index"');
  await knex.raw('DROP INDEX IF EXISTS "web_users_account_id_client_id_unique"');

  const hasClientId = await knex.schema.hasColumn(WEB_USERS_TABLE, 'client_id');
  if (hasClientId) {
    await knex.schema.alterTable(WEB_USERS_TABLE, (table) => {
      table.dropColumn('client_id');
    });
  }

  await knex.raw(`ALTER TABLE "${WEB_USERS_TABLE}" DROP CONSTRAINT IF EXISTS "web_users_role_check"`);
  await knex.raw(
    `ALTER TABLE "${WEB_USERS_TABLE}" ADD CONSTRAINT "web_users_role_check" CHECK (role IN ('owner', 'admin', 'specialist'))`,
  );
}
