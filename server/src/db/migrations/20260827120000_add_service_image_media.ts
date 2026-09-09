import type { Knex } from 'knex';

const MEDIA_ACCOUNT_ID_UNIQUE = 'public_page_media_account_id_id_unique';
const SERVICE_MEDIA_FOREIGN = 'services_account_image_media_foreign';
const SERVICE_MEDIA_INDEX = 'services_account_image_media_index';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('public_page_media', (table) => {
    table.unique(['account_id', 'id'], { indexName: MEDIA_ACCOUNT_ID_UNIQUE });
  });

  await knex.schema.alterTable('services', (table) => {
    table.uuid('image_media_id');
    table.index(['account_id', 'image_media_id'], SERVICE_MEDIA_INDEX);
    table.foreign(['account_id', 'image_media_id'], SERVICE_MEDIA_FOREIGN)
      .references(['account_id', 'id'])
      .inTable('public_page_media')
      .onDelete('RESTRICT');
  });

  await knex.schema.alterTable('services', (table) => {
    table.dropColumn('image_url');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('services', (table) => {
    table.text('image_url');
  });

  await knex.schema.alterTable('services', (table) => {
    table.dropForeign(['account_id', 'image_media_id'], SERVICE_MEDIA_FOREIGN);
    table.dropIndex(['account_id', 'image_media_id'], SERVICE_MEDIA_INDEX);
    table.dropColumn('image_media_id');
  });

  await knex.schema.alterTable('public_page_media', (table) => {
    table.dropUnique(['account_id', 'id'], MEDIA_ACCOUNT_ID_UNIQUE);
  });
}
