import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('services', (table) => {
    table.text('description');
    table.text('image_url');
  });

  await knex.schema.createTable('specialist_services', (table) => {
    table.increments('id').primary();
    table.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.integer('service_id').notNullable().references('id').inTable('services').onDelete('CASCADE');
    table.integer('specialist_id').notNullable().references('id').inTable('specialists').onDelete('CASCADE');
    table.integer('price_override');
    table.integer('duration_override_minutes');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);
    table.unique(['account_id', 'service_id', 'specialist_id']);
    table.index(['account_id', 'service_id']);
    table.index(['account_id', 'specialist_id']);
  });

  await knex.raw(`
    INSERT INTO specialist_services (account_id, service_id, specialist_id, is_active, created_at, updated_at)
    SELECT s.account_id, s.id, sp.id, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM services s
    JOIN specialists sp ON sp.account_id = s.account_id AND sp.is_active = TRUE
    WHERE s.is_active = TRUE
    ON CONFLICT (account_id, service_id, specialist_id) DO NOTHING
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('specialist_services');
  await knex.schema.alterTable('services', (table) => {
    table.dropColumn('image_url');
    table.dropColumn('description');
  });
}
