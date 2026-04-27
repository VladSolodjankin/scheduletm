import type { Knex } from 'knex';

const STATUS_CHECK = `status IN ('pending', 'processing', 'retry', 'sent', 'failed', 'cancelled')`;

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('notifications');
  if (!hasTable) {
    return;
  }

  await knex.raw(
    'ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_status_check"',
  );
  await knex.raw(
    `ALTER TABLE "notifications" ADD CONSTRAINT "notifications_status_check" CHECK (${STATUS_CHECK})`,
  );

  await knex.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS "notifications_idempotency_unique_index" ON "notifications" ("appointment_id", "type", "channel")',
  );
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('notifications');
  if (!hasTable) {
    return;
  }

  await knex.raw('DROP INDEX IF EXISTS "notifications_idempotency_unique_index"');

  await knex.raw(
    'ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_status_check"',
  );
  await knex.raw(
    `ALTER TABLE "notifications" ADD CONSTRAINT "notifications_status_check" CHECK (status IN ('pending', 'retry', 'sent', 'failed', 'cancelled'))`,
  );
}
