import type { Knex } from 'knex';

const TABLE_NAME = 'clients';
const COLUMN_NAME = 'telegram_id';

export async function up(knex: Knex): Promise<void> {
  const hasClients = await knex.schema.hasTable(TABLE_NAME);
  if (!hasClients) {
    return;
  }

  await knex.raw(`ALTER TABLE "${TABLE_NAME}" ALTER COLUMN "${COLUMN_NAME}" DROP NOT NULL`);
}

export async function down(knex: Knex): Promise<void> {
  const hasClients = await knex.schema.hasTable(TABLE_NAME);
  if (!hasClients) {
    return;
  }

  await knex.raw(
    `UPDATE "${TABLE_NAME}" SET "${COLUMN_NAME}" = id * -1 WHERE "${COLUMN_NAME}" IS NULL`,
  );
  await knex.raw(`ALTER TABLE "${TABLE_NAME}" ALTER COLUMN "${COLUMN_NAME}" SET NOT NULL`);
}
