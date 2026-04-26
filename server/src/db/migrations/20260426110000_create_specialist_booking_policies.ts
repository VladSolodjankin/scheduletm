import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('specialist_booking_policies');
  if (hasTable) {
    return;
  }

  await knex.schema.createTable('specialist_booking_policies', (table) => {
    table.increments('id').primary();
    table
      .integer('account_id')
      .notNullable()
      .references('id')
      .inTable('accounts')
      .onDelete('CASCADE');
    table
      .integer('specialist_id')
      .notNullable()
      .references('id')
      .inTable('specialists')
      .onDelete('CASCADE');
    table.integer('cancel_grace_period_hours').notNullable().defaultTo(24);
    table.boolean('refund_on_late_cancel').notNullable().defaultTo(false);
    table.boolean('auto_cancel_unpaid_enabled').notNullable().defaultTo(false);
    table.integer('unpaid_auto_cancel_after_hours').notNullable().defaultTo(72);
    table.timestamps(true, true);

    table.unique(['account_id', 'specialist_id'], {
      indexName: 'specialist_booking_policies_account_id_specialist_id_unique',
    });
    table.index(['account_id'], 'specialist_booking_policies_account_id_index');
    table.index(['specialist_id'], 'specialist_booking_policies_specialist_id_index');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('specialist_booking_policies');
}
