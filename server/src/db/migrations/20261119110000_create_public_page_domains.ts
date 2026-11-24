import type { Knex } from 'knex';

// A page can be served from the owner's own domain once the domain's DNS points at us (verified_at is set).
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('public_page_domains', (table) => {
    table.string('domain', 253).primary();
    table.string('page_id', 128).notNullable().unique().references('id').inTable('public_pages').onDelete('CASCADE');
    table.timestamp('verified_at', { useTz: true });
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw(`ALTER TABLE public_page_domains
    ADD CONSTRAINT public_page_domains_domain_lowercase_check CHECK (domain = lower(domain))`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('public_page_domains');
}
