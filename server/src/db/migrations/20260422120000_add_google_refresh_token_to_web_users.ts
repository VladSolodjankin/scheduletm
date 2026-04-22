import type { Knex } from 'knex';

const TABLE = 'web_users';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE);
  if (!hasTable) {
    return;
  }

  const hasGoogleRefreshToken = await knex.schema.hasColumn(TABLE, 'google_refresh_token');
  const hasGoogleTokenExpiresAt = await knex.schema.hasColumn(TABLE, 'google_token_expires_at');

  await knex.schema.alterTable(TABLE, (table) => {
    if (!hasGoogleRefreshToken) {
      table.string('google_refresh_token');
    }

    if (!hasGoogleTokenExpiresAt) {
      table.timestamp('google_token_expires_at', { useTz: true });
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE);
  if (!hasTable) {
    return;
  }

  const hasGoogleRefreshToken = await knex.schema.hasColumn(TABLE, 'google_refresh_token');
  const hasGoogleTokenExpiresAt = await knex.schema.hasColumn(TABLE, 'google_token_expires_at');

  await knex.schema.alterTable(TABLE, (table) => {
    if (hasGoogleTokenExpiresAt) {
      table.dropColumn('google_token_expires_at');
    }

    if (hasGoogleRefreshToken) {
      table.dropColumn('google_refresh_token');
    }
  });
}
