import type { Knex } from 'knex';

const CONSTRAINT = 'payment_orders_amount_positive_check';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('payment_orders'))) {
    return;
  }
  await knex.raw(`ALTER TABLE payment_orders DROP CONSTRAINT IF EXISTS ${CONSTRAINT}`);
  await knex.raw(`ALTER TABLE payment_orders ADD CONSTRAINT ${CONSTRAINT} CHECK (amount > 0)`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE payment_orders DROP CONSTRAINT IF EXISTS ${CONSTRAINT}`);
}
