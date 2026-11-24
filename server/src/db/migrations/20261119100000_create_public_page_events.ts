import type { Knex } from 'knex';

// Privacy-friendly page analytics: no cookies and no visitor identifiers, only counted views and block clicks.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('public_page_events', (table) => {
    table.bigIncrements('id');
    table.string('page_id', 128).notNullable().references('id').inTable('public_pages').onDelete('CASCADE');
    table.enum('type', ['view', 'click']).notNullable();
    table.string('block_id', 128);
    table.string('source', 255);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['page_id', 'created_at'], 'public_page_events_page_created_index');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('public_page_events');
}
