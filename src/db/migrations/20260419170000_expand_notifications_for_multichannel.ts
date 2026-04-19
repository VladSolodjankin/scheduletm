import type { Knex } from 'knex';

const CHANNEL_CHECK = `channel IN ('telegram', 'email', 'sms')`;
const STATUS_CHECK = `status IN ('pending', 'retry', 'sent', 'failed', 'cancelled')`;

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('notifications');
  if (!hasTable) {
    return;
  }

  const hasAccountId = await knex.schema.hasColumn('notifications', 'account_id');
  const hasUserId = await knex.schema.hasColumn('notifications', 'user_id');
  const hasAttempts = await knex.schema.hasColumn('notifications', 'attempts');
  const hasMaxAttempts = await knex.schema.hasColumn('notifications', 'max_attempts');
  const hasLastError = await knex.schema.hasColumn('notifications', 'last_error');
  const hasNextRetryAt = await knex.schema.hasColumn('notifications', 'next_retry_at');
  const hasPayloadJson = await knex.schema.hasColumn('notifications', 'payload_json');
  const hasRecipientEmail = await knex.schema.hasColumn('notifications', 'recipient_email');
  const hasRecipientPhone = await knex.schema.hasColumn('notifications', 'recipient_phone');
  const hasRecipientChatId = await knex.schema.hasColumn('notifications', 'recipient_chat_id');

  await knex.schema.alterTable('notifications', (table) => {
    if (!hasAccountId) {
      table.integer('account_id').references('id').inTable('accounts').onDelete('CASCADE');
    }

    if (!hasUserId) {
      table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
    }

    if (!hasAttempts) {
      table.integer('attempts').notNullable().defaultTo(0);
    }

    if (!hasMaxAttempts) {
      table.integer('max_attempts').notNullable().defaultTo(3);
    }

    if (!hasLastError) {
      table.text('last_error');
    }

    if (!hasNextRetryAt) {
      table.timestamp('next_retry_at', { useTz: true });
    }

    if (!hasPayloadJson) {
      table.jsonb('payload_json').notNullable().defaultTo('{}');
    }

    if (!hasRecipientEmail) {
      table.string('recipient_email');
    }

    if (!hasRecipientPhone) {
      table.string('recipient_phone');
    }

    if (!hasRecipientChatId) {
      table.bigInteger('recipient_chat_id');
    }
  });

  await knex.raw(
    `ALTER TABLE "notifications" ADD CONSTRAINT "notifications_channel_check" CHECK (${CHANNEL_CHECK})`,
  ).catch(() => undefined);
  await knex.raw(
    `ALTER TABLE "notifications" ADD CONSTRAINT "notifications_status_check" CHECK (${STATUS_CHECK})`,
  ).catch(() => undefined);

  await knex.raw(
    'CREATE INDEX IF NOT EXISTS "notifications_account_id_index" ON "notifications" ("account_id")',
  );
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS "notifications_user_id_index" ON "notifications" ("user_id")',
  );
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS "notifications_channel_status_send_at_index" ON "notifications" ("channel", "status", "send_at")',
  );
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS "notifications_status_next_retry_at_index" ON "notifications" ("status", "next_retry_at")',
  );
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('notifications');
  if (!hasTable) {
    return;
  }

  await knex.raw('DROP INDEX IF EXISTS "notifications_status_next_retry_at_index"');
  await knex.raw('DROP INDEX IF EXISTS "notifications_channel_status_send_at_index"');
  await knex.raw('DROP INDEX IF EXISTS "notifications_user_id_index"');
  await knex.raw('DROP INDEX IF EXISTS "notifications_account_id_index"');

  await knex.raw(
    'ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_status_check"',
  );
  await knex.raw(
    'ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_channel_check"',
  );

  const dropIfExists = async (columnName: string) => {
    const hasColumn = await knex.schema.hasColumn('notifications', columnName);
    if (!hasColumn) {
      return;
    }

    await knex.schema.alterTable('notifications', (table) => {
      table.dropColumn(columnName);
    });
  };

  await dropIfExists('recipient_chat_id');
  await dropIfExists('recipient_phone');
  await dropIfExists('recipient_email');
  await dropIfExists('payload_json');
  await dropIfExists('next_retry_at');
  await dropIfExists('last_error');
  await dropIfExists('max_attempts');
  await dropIfExists('attempts');
  await dropIfExists('user_id');
  await dropIfExists('account_id');
}
