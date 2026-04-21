import type { Knex } from 'knex';

const TABLE_NAME = 'web_user_sessions';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (hasTable) {
    return;
  }

  await knex.schema.createTable(TABLE_NAME, (table) => {
    table.increments('id').primary();
    table
      .integer('account_id')
      .notNullable()
      .references('id')
      .inTable('accounts')
      .onDelete('CASCADE');
    table
      .integer('web_user_id')
      .notNullable()
      .references('id')
      .inTable('web_users')
      .onDelete('CASCADE');
    table.string('token').notNullable().unique();
    table.string('session_type').notNullable();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('revoked_at', { useTz: true });
    table.timestamps(true, true);

    table.index(['account_id'], 'web_user_sessions_account_id_index');
    table.index(['account_id', 'web_user_id'], 'web_user_sessions_account_user_index');
    table.index(['session_type'], 'web_user_sessions_type_index');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE_NAME);
}
