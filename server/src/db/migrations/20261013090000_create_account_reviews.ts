import type { Knex } from 'knex';

const TABLE = 'account_reviews';
const MEDIA_FOREIGN = 'account_reviews_account_screenshot_media_foreign';
const MEDIA_INDEX = 'account_reviews_account_screenshot_media_index';
const LIST_INDEX = 'account_reviews_account_status_created_index';
const MEDIA_ACCOUNT_ID_UNIQUE = 'public_page_media_account_id_id_unique';

export async function up(knex: Knex): Promise<void> {
  // Normally created by 20260827120000_add_service_image_media; keep idempotent for safety.
  const hasUnique = await knex.raw(
    'select 1 from pg_constraint where conname = ?', [MEDIA_ACCOUNT_ID_UNIQUE],
  );
  const hasIndex = await knex.raw(
    'select 1 from pg_indexes where indexname = ?', [MEDIA_ACCOUNT_ID_UNIQUE],
  );
  if (hasUnique.rows.length === 0 && hasIndex.rows.length === 0) {
    await knex.schema.alterTable('public_page_media', (table) => {
      table.unique(['account_id', 'id'], { indexName: MEDIA_ACCOUNT_ID_UNIQUE });
    });
  }

  await knex.schema.createTable(TABLE, (table) => {
    table.increments('id').primary();
    table.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.string('name', 80).notNullable();
    table.string('text', 1500).notNullable();
    table.smallint('rating').notNullable();
    table.string('review_date', 40).notNullable().defaultTo('');
    table.uuid('screenshot_media_id');
    table.string('screenshot_alt', 200).notNullable().defaultTo('');
    table.string('status', 16).notNullable().defaultTo('published');
    table.string('source', 16).notNullable().defaultTo('manual');
    table.integer('created_by').references('id').inTable('web_users').onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.foreign(['account_id', 'screenshot_media_id'], MEDIA_FOREIGN)
      .references(['account_id', 'id'])
      .inTable('public_page_media')
      .onDelete('RESTRICT');
    table.index(['account_id', 'screenshot_media_id'], MEDIA_INDEX);
  });

  await knex.raw(`alter table ${TABLE} add constraint account_reviews_rating_check check (rating between 1 and 5)`);
  await knex.raw(`alter table ${TABLE} add constraint account_reviews_status_check check (status in ('published', 'hidden'))`);
  await knex.raw(`alter table ${TABLE} add constraint account_reviews_source_check check (source in ('manual', 'client'))`);
  await knex.raw(`alter table ${TABLE} add constraint account_reviews_screenshot_alt_check check (screenshot_media_id is null or length(screenshot_alt) > 0)`);
  await knex.raw(`create index ${LIST_INDEX} on ${TABLE} (account_id, status, created_at desc, id desc)`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE);
}
