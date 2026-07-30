import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('public_pages', (table) => {
    table.string('id', 128).primary();
    table.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.enum('status', ['draft', 'published', 'archived']).notNullable().defaultTo('draft');
    table.jsonb('draft_document').notNullable();
    table.jsonb('published_document');
    table.integer('revision').notNullable().defaultTo(1);
    table.timestamp('published_at', { useTz: true });
    table.timestamp('archived_at', { useTz: true });
    table.timestamps(true, true);
    table.index(['account_id', 'status'], 'public_pages_account_status_index');
  });

  await knex.schema.createTable('public_page_slug_claims', (table) => {
    table.string('slug', 40).primary();
    table.string('draft_page_id', 128).references('id').inTable('public_pages').onDelete('CASCADE');
    table.string('published_page_id', 128).references('id').inTable('public_pages').onDelete('CASCADE');
    table.timestamps(true, true);
    table.check('draft_page_id is not null or published_page_id is not null');
    table.unique(['draft_page_id'], { indexName: 'public_page_slug_claims_draft_page_unique' });
    table.unique(['published_page_id'], { indexName: 'public_page_slug_claims_published_page_unique' });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('public_page_slug_claims');
  await knex.schema.dropTableIfExists('public_pages');
}
