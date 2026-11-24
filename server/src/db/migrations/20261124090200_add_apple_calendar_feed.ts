import type { Knex } from 'knex';

const INTEGRATIONS_TABLE = 'web_user_integrations';
const FEED_TOKEN_INDEX = 'web_user_integrations_calendar_feed_token_hash_uq';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn(INTEGRATIONS_TABLE, 'calendar_feed_token_hash'))) {
    await knex.schema.alterTable(INTEGRATIONS_TABLE, (table) => {
      // SHA-256 hex of the feed token; the token itself is never stored.
      table.string('calendar_feed_token_hash', 64).nullable();
    });
  }
  if (!(await knex.schema.hasColumn(INTEGRATIONS_TABLE, 'calendar_feed_created_at'))) {
    await knex.schema.alterTable(INTEGRATIONS_TABLE, (table) => {
      table.timestamp('calendar_feed_created_at', { useTz: true }).nullable();
    });
  }
  await knex.raw(
    `CREATE UNIQUE INDEX IF NOT EXISTS ${FEED_TOKEN_INDEX} ON ${INTEGRATIONS_TABLE} (calendar_feed_token_hash) WHERE calendar_feed_token_hash IS NOT NULL`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS ${FEED_TOKEN_INDEX}`);
  for (const name of ['calendar_feed_token_hash', 'calendar_feed_created_at']) {
    if (await knex.schema.hasColumn(INTEGRATIONS_TABLE, name)) {
      await knex.schema.alterTable(INTEGRATIONS_TABLE, (table) => {
        table.dropColumn(name);
      });
    }
  }
}
