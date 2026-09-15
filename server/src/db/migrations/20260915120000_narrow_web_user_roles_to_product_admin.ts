import type { Knex } from 'knex';
import { WEB_USER_ROLES } from '../../types/webUserRole.js';

const TABLE = 'web_users';
const CONSTRAINT = 'web_users_role_check';
const ROLE_CHECK = `role IN (${WEB_USER_ROLES.map((role) => `'${role}'`).join(', ')})`;

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE);
  if (!hasTable) {
    return;
  }

  await knex(TABLE)
    .where({ role: 'admin' })
    .update({ role: 'owner' });
  await knex(TABLE)
    .where({ role: 'product_owner' })
    .update({ role: 'product_admin' });

  await knex.raw(`ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "${CONSTRAINT}"`);
  await knex.raw(`ALTER TABLE "${TABLE}" ADD CONSTRAINT "${CONSTRAINT}" CHECK (${ROLE_CHECK})`);
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE);
  if (!hasTable) {
    return;
  }

  await knex(TABLE)
    .where({ role: 'product_admin' })
    .update({ role: 'product_owner' });
  // NOTE: rows that were merged from 'admin' into 'owner' in up() cannot be
  // reliably distinguished from rows that were already 'owner', so they are
  // intentionally left as 'owner' on rollback rather than guessed back to 'admin'.

  await knex.raw(`ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "${CONSTRAINT}"`);
  await knex.raw(
    `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${CONSTRAINT}" CHECK (role IN ('product_owner', 'owner', 'admin', 'specialist', 'client'))`,
  );
}
