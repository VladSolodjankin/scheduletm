import type { Knex } from 'knex';

const WEB_USERS_TABLE = 'web_users';
const IDENTITY_LINKS_TABLE = 'user_identity_links';

async function ensureWebUsersTable(knex: Knex) {
  const hasWebUsers = await knex.schema.hasTable(WEB_USERS_TABLE);
  if (hasWebUsers) {
    return;
  }

  await knex.schema.createTable(WEB_USERS_TABLE, (table) => {
    table.increments('id').primary();
    table
      .integer('account_id')
      .notNullable()
      .references('id')
      .inTable('accounts')
      .onDelete('CASCADE');
    table.string('email').notNullable();
    table.text('password_hash').notNullable();
    table.string('password_salt').notNullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('last_login_at', { useTz: true });
    table.timestamps(true, true);

    table.unique(['account_id', 'email'], {
      indexName: 'web_users_account_id_email_unique',
    });
    table.index(['account_id'], 'web_users_account_id_index');
  });
}

async function ensureIdentityLinksTable(knex: Knex) {
  const hasIdentityLinks = await knex.schema.hasTable(IDENTITY_LINKS_TABLE);
  if (hasIdentityLinks) {
    return;
  }

  await knex.schema.createTable(IDENTITY_LINKS_TABLE, (table) => {
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
      .inTable(WEB_USERS_TABLE)
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

export async function up(knex: Knex): Promise<void> {
  await ensureWebUsersTable(knex);
  await ensureIdentityLinksTable(knex);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(IDENTITY_LINKS_TABLE);
  await knex.schema.dropTableIfExists(WEB_USERS_TABLE);
}
