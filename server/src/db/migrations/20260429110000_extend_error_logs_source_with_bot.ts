import type { Knex } from 'knex';

const OLD_CONSTRAINT = `source IN ('web', 'server')`;
const NEW_CONSTRAINT = `source IN ('web', 'server', 'bot')`;

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('error_logs');
  if (!hasTable) {
    return;
  }

  await knex.raw('ALTER TABLE "error_logs" DROP CONSTRAINT IF EXISTS "error_logs_source_check"');
  await knex.raw(`ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_source_check" CHECK (${NEW_CONSTRAINT})`);
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('error_logs');
  if (!hasTable) {
    return;
  }

  await knex.raw('ALTER TABLE "error_logs" DROP CONSTRAINT IF EXISTS "error_logs_source_check"');
  await knex.raw(`ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_source_check" CHECK (${OLD_CONSTRAINT})`);
}
