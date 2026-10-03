import type { Knex } from 'knex';

const TABLE = 'appointment_management_tokens';

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(TABLE)) return;
  await knex.schema.createTable(TABLE, (table) => {
    table.increments('id').primary();
    table.integer('appointment_id').notNullable().references('id').inTable('appointments').onDelete('CASCADE');
    table.string('token', 64).notNullable().unique();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('revoked_at', { useTz: true });
    table.timestamps(true, true);
    table.index(['appointment_id'], 'appointment_management_tokens_appointment_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE);
}
