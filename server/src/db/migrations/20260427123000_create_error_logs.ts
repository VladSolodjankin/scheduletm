import type { Knex } from 'knex';

const SOURCE_CHECK = `source IN ('web', 'server')`;

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('error_logs');
  if (hasTable) {
    return;
  }

  await knex.schema.createTable('error_logs', (table) => {
    table.increments('id').primary();
    table.integer('account_id').unsigned().nullable().references('id').inTable('accounts').onDelete('SET NULL');
    table.integer('web_user_id').unsigned().nullable().references('id').inTable('web_users').onDelete('SET NULL');
    table.string('source', 16).notNullable();
    table.string('level', 16).notNullable().defaultTo('error');
    table.string('method', 16).nullable();
    table.string('path', 255).nullable();
    table.text('message').notNullable();
    table.text('stack').nullable();
    table.jsonb('metadata_json').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(
    `ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_source_check" CHECK (${SOURCE_CHECK})`,
  );

  await knex.raw('CREATE INDEX IF NOT EXISTS "error_logs_created_at_idx" ON "error_logs" ("created_at" DESC)');
  await knex.raw('CREATE INDEX IF NOT EXISTS "error_logs_source_created_at_idx" ON "error_logs" ("source", "created_at" DESC)');
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('error_logs');
  if (!hasTable) {
    return;
  }

  await knex.raw('DROP INDEX IF EXISTS "error_logs_source_created_at_idx"');
  await knex.raw('DROP INDEX IF EXISTS "error_logs_created_at_idx"');
  await knex.schema.dropTable('error_logs');
}
