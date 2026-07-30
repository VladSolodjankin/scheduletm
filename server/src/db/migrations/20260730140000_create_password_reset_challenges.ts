import type { Knex } from 'knex';

const TABLE = 'password_reset_challenges';

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(TABLE)) return;
  await knex.schema.createTable(TABLE, (table) => {
    table.increments('id').primary();
    table.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.integer('web_user_id').notNullable().references('id').inTable('web_users').onDelete('CASCADE');
    table.string('code_hash', 64).notNullable();
    table.string('code_salt', 64).notNullable();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.integer('failed_attempts').notNullable().defaultTo(0);
    table.timestamp('consumed_at', { useTz: true });
    table.timestamps(true, true);
    table.index(['web_user_id', 'created_at'], 'password_reset_challenges_user_created_idx');
    table.index(['web_user_id', 'consumed_at'], 'password_reset_challenges_user_consumed_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE);
}
