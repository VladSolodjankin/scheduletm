import type { Knex } from 'knex';

const ACCOUNT_SETTINGS_TABLE = 'account_settings';
const BINDINGS_TABLE = 'telegram_account_bindings';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn(ACCOUNT_SETTINGS_TABLE, 'bot_slug'))) {
    await knex.schema.alterTable(ACCOUNT_SETTINGS_TABLE, (table) => {
      table.string('bot_slug', 40).nullable();
      table.unique(['bot_slug'], { indexName: 'account_settings_bot_slug_unique' });
    });
  }

  if (!(await knex.schema.hasColumn(ACCOUNT_SETTINGS_TABLE, 'telegram_bot_enabled'))) {
    await knex.schema.alterTable(ACCOUNT_SETTINGS_TABLE, (table) => {
      table.boolean('telegram_bot_enabled').notNullable().defaultTo(true);
    });
  }

  if (!(await knex.schema.hasColumn(ACCOUNT_SETTINGS_TABLE, 'bot_welcome_message'))) {
    await knex.schema.alterTable(ACCOUNT_SETTINGS_TABLE, (table) => {
      table.text('bot_welcome_message').nullable();
    });
  }

  if (!(await knex.schema.hasTable(BINDINGS_TABLE))) {
    await knex.schema.createTable(BINDINGS_TABLE, (table) => {
      table.bigInteger('telegram_id').primary();
      table
        .integer('account_id')
        .notNullable()
        .references('id')
        .inTable('accounts')
        .onDelete('CASCADE');
      table.timestamps(true, true);

      table.index(['account_id'], 'telegram_account_bindings_account_id_index');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(BINDINGS_TABLE);

  if (await knex.schema.hasColumn(ACCOUNT_SETTINGS_TABLE, 'bot_welcome_message')) {
    await knex.schema.alterTable(ACCOUNT_SETTINGS_TABLE, (table) => {
      table.dropColumn('bot_welcome_message');
    });
  }

  if (await knex.schema.hasColumn(ACCOUNT_SETTINGS_TABLE, 'telegram_bot_enabled')) {
    await knex.schema.alterTable(ACCOUNT_SETTINGS_TABLE, (table) => {
      table.dropColumn('telegram_bot_enabled');
    });
  }

  if (await knex.schema.hasColumn(ACCOUNT_SETTINGS_TABLE, 'bot_slug')) {
    await knex.schema.alterTable(ACCOUNT_SETTINGS_TABLE, (table) => {
      table.dropUnique(['bot_slug'], 'account_settings_bot_slug_unique');
      table.dropColumn('bot_slug');
    });
  }
}
