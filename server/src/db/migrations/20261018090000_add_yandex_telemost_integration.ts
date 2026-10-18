import type { Knex } from 'knex';

const INTEGRATIONS_TABLE = 'web_user_integrations';
const YANDEX_OAUTH_STATES_TABLE = 'yandex_oauth_states';

export async function up(knex: Knex): Promise<void> {
  const columns: Array<[string, (table: Knex.AlterTableBuilder) => void]> = [
    ['yandex_access_token_encrypted', (table) => { table.text('yandex_access_token_encrypted').nullable(); }],
    ['yandex_refresh_token_encrypted', (table) => { table.text('yandex_refresh_token_encrypted').nullable(); }],
    ['yandex_token_expires_at', (table) => { table.timestamp('yandex_token_expires_at', { useTz: true }); }],
    ['yandex_connected_at', (table) => { table.timestamp('yandex_connected_at', { useTz: true }); }],
    ['yandex_last_meeting_id', (table) => { table.string('yandex_last_meeting_id', 255); }],
    ['yandex_last_join_url', (table) => { table.text('yandex_last_join_url'); }],
  ];
  for (const [name, add] of columns) {
    if (!(await knex.schema.hasColumn(INTEGRATIONS_TABLE, name))) {
      await knex.schema.alterTable(INTEGRATIONS_TABLE, add);
    }
  }

  if (!(await knex.schema.hasTable(YANDEX_OAUTH_STATES_TABLE))) {
    await knex.schema.createTable(YANDEX_OAUTH_STATES_TABLE, (table) => {
      table.increments('id').primary();
      table.integer('account_id').notNullable();
      table.integer('web_user_id').notNullable();
      table.string('state_token', 255).notNullable().unique();
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('expires_at', { useTz: true }).notNullable();

      table.index(['account_id'], 'yandex_oauth_states_account_id_index');
      table.index(['web_user_id'], 'yandex_oauth_states_web_user_id_index');
      table.index(['expires_at'], 'yandex_oauth_states_expires_at_index');

      table.foreign('account_id').references('id').inTable('accounts').onDelete('CASCADE');
      table.foreign('web_user_id').references('id').inTable('web_users').onDelete('CASCADE');
    });
  }

  await knex.raw('ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_meeting_provider_check"');
  await knex.raw(
    'ALTER TABLE "appointments" ADD CONSTRAINT "appointments_meeting_provider_check" CHECK (meeting_provider IN (\'manual\',\'zoom\',\'yandex_telemost\',\'offline\'))',
  );
  await knex.raw('ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_preferred_meeting_provider_check"');
  await knex.raw(
    'ALTER TABLE "clients" ADD CONSTRAINT "clients_preferred_meeting_provider_check" CHECK (preferred_meeting_provider IN (\'manual\',\'zoom\',\'yandex_telemost\',\'offline\') OR preferred_meeting_provider IS NULL)',
  );
  // appointments.meeting_provider is varchar(20) and specialist_booking_policies provider lists are
  // varchar(120); 'yandex_telemost' (15 chars) fits both, so no column widening is required.
}

export async function down(knex: Knex): Promise<void> {
  // Rows using the new provider would violate the restored constraints; keep the link, drop the provider.
  await knex('appointments').where({ meeting_provider: 'yandex_telemost' }).update({ meeting_provider: 'manual' });
  await knex('clients').where({ preferred_meeting_provider: 'yandex_telemost' }).update({ preferred_meeting_provider: null });

  await knex.raw('ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_meeting_provider_check"');
  await knex.raw(
    'ALTER TABLE "appointments" ADD CONSTRAINT "appointments_meeting_provider_check" CHECK (meeting_provider IN (\'manual\',\'zoom\',\'offline\'))',
  );
  await knex.raw('ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_preferred_meeting_provider_check"');
  await knex.raw(
    'ALTER TABLE "clients" ADD CONSTRAINT "clients_preferred_meeting_provider_check" CHECK (preferred_meeting_provider IN (\'manual\',\'zoom\',\'offline\') OR preferred_meeting_provider IS NULL)',
  );

  if (await knex.schema.hasTable(YANDEX_OAUTH_STATES_TABLE)) {
    await knex.schema.dropTable(YANDEX_OAUTH_STATES_TABLE);
  }

  for (const name of [
    'yandex_access_token_encrypted',
    'yandex_refresh_token_encrypted',
    'yandex_token_expires_at',
    'yandex_connected_at',
    'yandex_last_meeting_id',
    'yandex_last_join_url',
  ]) {
    if (await knex.schema.hasColumn(INTEGRATIONS_TABLE, name)) {
      await knex.schema.alterTable(INTEGRATIONS_TABLE, (table) => {
        table.dropColumn(name);
      });
    }
  }
}
