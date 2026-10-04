import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('specialist_schedule_exceptions');
  if (hasTable) {
    return;
  }

  await knex.schema.createTable('specialist_schedule_exceptions', (table) => {
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
    table.date('exception_date').notNullable();
    table.integer('starts_at_minute').nullable();
    table.integer('ends_at_minute').nullable();
    table.string('type').notNullable();
    table.string('note').nullable();
    table.timestamps(true, true);

    table.index(['specialist_id', 'exception_date'], 'specialist_schedule_exceptions_specialist_date_index');
    table.index(['account_id'], 'specialist_schedule_exceptions_account_id_index');
  });

  await knex.raw(`
    ALTER TABLE specialist_schedule_exceptions
    ADD CONSTRAINT specialist_schedule_exceptions_type_check
    CHECK (type IN ('day_off', 'vacation', 'interval', 'break'))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('specialist_schedule_exceptions');
}
