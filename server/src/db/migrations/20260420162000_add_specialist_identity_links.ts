import type { Knex } from 'knex';

const TABLE = 'specialist_identity_links';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE);
  if (hasTable) {
    return;
  }

  await knex.schema.createTable(TABLE, (table) => {
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

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE);
}

