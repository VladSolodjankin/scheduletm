import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasAppointmentGroups = await knex.schema.hasTable('appointment_groups');
  if (!hasAppointmentGroups) {
    await knex.schema.createTable('appointment_groups', (table) => {
      table.increments('id').primary();
      table.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.integer('service_id').notNullable().references('id').inTable('services').onDelete('RESTRICT');
      table.integer('specialist_id').notNullable().references('id').inTable('specialists').onDelete('RESTRICT');
      table.integer('total_sessions').notNullable().defaultTo(1);
      table.integer('total_price').notNullable().defaultTo(0);
      table.string('currency').notNullable().defaultTo('RUB');
      table.string('payment_status').notNullable().defaultTo('unpaid');
      table.timestamps(true, true);
    });
  }

  const hasGroupId = await knex.schema.hasColumn('appointments', 'group_id');
  const hasIsPaid = await knex.schema.hasColumn('appointments', 'is_paid');

  await knex.schema.alterTable('appointments', (table) => {
    if (!hasGroupId) {
      table.integer('group_id').nullable().references('id').inTable('appointment_groups').onDelete('SET NULL');
      table.index(['group_id']);
    }

    if (!hasIsPaid) {
      table.boolean('is_paid').notNullable().defaultTo(false);
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  const hasGroupId = await knex.schema.hasColumn('appointments', 'group_id');
  const hasIsPaid = await knex.schema.hasColumn('appointments', 'is_paid');

  await knex.schema.alterTable('appointments', (table) => {
    if (hasGroupId) {
      table.dropIndex(['group_id']);
      table.dropColumn('group_id');
    }
    if (hasIsPaid) {
      table.dropColumn('is_paid');
    }
  });

  await knex.schema.dropTableIfExists('appointment_groups');
}
