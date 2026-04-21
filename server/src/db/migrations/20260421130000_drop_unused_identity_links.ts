import type { Knex } from 'knex';

const USER_IDENTITY_LINKS_TABLE = 'user_identity_links';
const SPECIALIST_IDENTITY_LINKS_TABLE = 'specialist_identity_links';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(SPECIALIST_IDENTITY_LINKS_TABLE);
  await knex.schema.dropTableIfExists(USER_IDENTITY_LINKS_TABLE);
}

export async function down(knex: Knex): Promise<void> {
  const hasUserIdentityLinks = await knex.schema.hasTable(USER_IDENTITY_LINKS_TABLE);
  if (!hasUserIdentityLinks) {
    await knex.schema.createTable(USER_IDENTITY_LINKS_TABLE, (table) => {
      table.increments('id').primary();
      table
        .integer('account_id')
        .notNullable()
        .references('id')
        .inTable('accounts')
        .onDelete('CASCADE');
      table
        .integer('telegram_user_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE');
      table
        .integer('web_user_id')
        .notNullable()
        .references('id')
        .inTable('web_users')
        .onDelete('CASCADE');
      table.string('link_source').notNullable().defaultTo('manual');
      table.timestamp('linked_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamps(true, true);

      table.unique(['account_id', 'telegram_user_id'], {
        indexName: 'identity_links_account_id_telegram_user_id_unique',
      });
      table.unique(['account_id', 'web_user_id'], {
        indexName: 'identity_links_account_id_web_user_id_unique',
      });
      table.index(['account_id'], 'identity_links_account_id_index');
    });
  }

  const hasSpecialistIdentityLinks = await knex.schema.hasTable(SPECIALIST_IDENTITY_LINKS_TABLE);
  if (!hasSpecialistIdentityLinks) {
    await knex.schema.createTable(SPECIALIST_IDENTITY_LINKS_TABLE, (table) => {
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
      table
        .integer('web_user_id')
        .notNullable()
        .references('id')
        .inTable('web_users')
        .onDelete('CASCADE');
      table.string('link_source').notNullable().defaultTo('manual');
      table.timestamp('linked_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamps(true, true);

      table.unique(['account_id', 'specialist_id'], {
        indexName: 'specialist_identity_links_account_id_specialist_id_unique',
      });
      table.unique(['account_id', 'web_user_id'], {
        indexName: 'specialist_identity_links_account_id_web_user_id_unique',
      });
      table.index(['account_id'], 'specialist_identity_links_account_id_index');
    });
  }
}
