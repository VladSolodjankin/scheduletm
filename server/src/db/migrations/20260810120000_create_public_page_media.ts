import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('public_page_media', (table) => {
    table.uuid('id').primary();
    table.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.string('object_key', 255).notNullable().unique();
    table.string('mime', 32).notNullable();
    table.integer('bytes').notNullable();
    table.integer('width');
    table.integer('height');
    table.timestamps(true, true);
    table.index(['account_id', 'created_at'], 'public_page_media_account_created_index');
    table.check('bytes > 0 and bytes <= 5242880');
    table.check("mime in ('image/jpeg', 'image/png', 'image/webp')");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('public_page_media');
}
