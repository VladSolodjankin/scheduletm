import type { Knex } from 'knex';
import { WEB_USER_ROLES } from '../../types/webUserRole.js';

const TABLE = 'web_users';
const ROLE_CHECK = `role IN (${WEB_USER_ROLES.map((role) => `'${role}'`).join(', ')})`;

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE);
  if (!hasTable) {
    return;
  }

  await knex.raw(`ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "web_users_role_check"`);
  await knex.raw(`ALTER TABLE "${TABLE}" ADD CONSTRAINT "web_users_role_check" CHECK (${ROLE_CHECK})`);
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE);
  if (!hasTable) {
    return;
  }

  await knex.raw(`ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "web_users_role_check"`);
  await knex.raw(
    `ALTER TABLE "${TABLE}" ADD CONSTRAINT "web_users_role_check" CHECK (role IN ('owner', 'specialist'))`,
  );
}
