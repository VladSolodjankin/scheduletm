import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('users');
  if (!hasTable) {
    return;
  }

  const hasReminderComment = await knex.schema.hasColumn('users', 'reminder_comment');
  if (hasReminderComment) {
    return;
  }

  await knex.schema.alterTable('users', (table) => {
    table.text('reminder_comment').notNullable().defaultTo('');
  });
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('users');
  if (!hasTable) {
    return;
  }

  const hasReminderComment = await knex.schema.hasColumn('users', 'reminder_comment');
  if (!hasReminderComment) {
    return;
  }

  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('reminder_comment');
  });
}
