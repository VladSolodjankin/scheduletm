import type { Knex } from 'knex';

const PROCESSED_UPDATES_TABLE = 'processed_updates';
const USER_LEASES_TABLE = 'telegram_user_processing_leases';

export async function up(knex: Knex): Promise<void> {
  const hasProcessingToken = await knex.schema.hasColumn(PROCESSED_UPDATES_TABLE, 'processing_token');
  const hasLeaseExpiresAt = await knex.schema.hasColumn(PROCESSED_UPDATES_TABLE, 'lease_expires_at');

  if (!hasProcessingToken || !hasLeaseExpiresAt) {
    await knex.schema.alterTable(PROCESSED_UPDATES_TABLE, (table) => {
      if (!hasProcessingToken) {
        table.string('processing_token', 64).nullable();
      }
      if (!hasLeaseExpiresAt) {
        table.timestamp('lease_expires_at', { useTz: true }).nullable();
      }
    });
  }

  const hasUserLeasesTable = await knex.schema.hasTable(USER_LEASES_TABLE);
  if (!hasUserLeasesTable) {
    await knex.schema.createTable(USER_LEASES_TABLE, (table) => {
      table.bigInteger('telegram_user_id').primary();
      table.string('processing_token', 64).notNullable();
      table.timestamp('lease_expires_at', { useTz: true }).notNullable();
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.index(['lease_expires_at'], 'telegram_user_processing_leases_expiry_index');
    });
  }

  await knex.schema.alterTable(PROCESSED_UPDATES_TABLE, (table) => {
    table.index(['status', 'updated_at'], 'processed_updates_retention_index');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(USER_LEASES_TABLE);

  const hasProcessedUpdates = await knex.schema.hasTable(PROCESSED_UPDATES_TABLE);
  if (!hasProcessedUpdates) {
    return;
  }

  await knex.schema.alterTable(PROCESSED_UPDATES_TABLE, (table) => {
    table.dropIndex(['status', 'updated_at'], 'processed_updates_retention_index');
  });

  const hasProcessingToken = await knex.schema.hasColumn(PROCESSED_UPDATES_TABLE, 'processing_token');
  const hasLeaseExpiresAt = await knex.schema.hasColumn(PROCESSED_UPDATES_TABLE, 'lease_expires_at');
  if (hasProcessingToken || hasLeaseExpiresAt) {
    await knex.schema.alterTable(PROCESSED_UPDATES_TABLE, (table) => {
      if (hasProcessingToken) {
        table.dropColumn('processing_token');
      }
      if (hasLeaseExpiresAt) {
        table.dropColumn('lease_expires_at');
      }
    });
  }
}
