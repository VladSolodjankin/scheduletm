import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_management_events', (table) => {
    table.increments('id').primary();
    table.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.integer('target_web_user_id').nullable().references('id').inTable('web_users').onDelete('SET NULL');
    table.integer('actor_web_user_id').nullable().references('id').inTable('web_users').onDelete('SET NULL');
    table.string('action').notNullable();
    table.text('metadata_json').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['account_id', 'target_web_user_id']);
    table.index(['target_web_user_id', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_management_events');
}
