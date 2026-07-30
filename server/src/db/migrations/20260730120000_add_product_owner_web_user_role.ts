import type { Knex } from 'knex';
import { WEB_USER_ROLES } from '../../types/webUserRole.js';

const TABLE = 'web_users';
const CONSTRAINT = 'web_users_role_check';
const ROLE_CHECK = `role IN (${WEB_USER_ROLES.map((role) => `'${role}'`).join(', ')})`;

export async function up(knex: Knex): Promise<void> {
  if (!await knex.schema.hasTable(TABLE)) {
    return;
  }

  await knex.raw(`ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "${CONSTRAINT}"`);
  await knex.raw(`ALTER TABLE "${TABLE}" ADD CONSTRAINT "${CONSTRAINT}" CHECK (${ROLE_CHECK})`);
}

export async function down(knex: Knex): Promise<void> {
  if (!await knex.schema.hasTable(TABLE)) {
    return;
  }

  await knex(TABLE)
    .where({ role: 'product_owner' })
    .update({ role: 'owner' });
  await knex.raw(`ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "${CONSTRAINT}"`);
  await knex.raw(
    `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${CONSTRAINT}" CHECK (role IN ('owner', 'admin', 'specialist', 'client'))`,
  );
}
