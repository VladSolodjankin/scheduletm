import type { Knex } from 'knex';

const TABLE = 'web_users';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE);
  if (!hasTable) {
    return;
  }

  await knex.schema.alterTable(TABLE, (table) => {
    table.string('first_name', 120);
    table.string('last_name', 120);
    table.string('phone', 50);
    table.string('telegram_username', 255);
  });
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE);
  if (!hasTable) {
    return;
  }

  await knex.schema.alterTable(TABLE, (table) => {
    table.dropColumn('telegram_username');
    table.dropColumn('phone');
    table.dropColumn('last_name');
    table.dropColumn('first_name');
  });
}
