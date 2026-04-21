import type { Knex } from 'knex';

const SPECIALISTS_TABLE = 'specialists';
const WEB_USERS_TABLE = 'web_users';

async function dropSpecialistsGoogleColumns(knex: Knex) {
  const hasGoogleApiKey = await knex.schema.hasColumn(SPECIALISTS_TABLE, 'google_api_key');
  const hasGoogleCalendarId = await knex.schema.hasColumn(SPECIALISTS_TABLE, 'google_calendar_id');

  if (!hasGoogleApiKey && !hasGoogleCalendarId) {
    return;
  }

  await knex.schema.alterTable(SPECIALISTS_TABLE, (table) => {
    if (hasGoogleApiKey) {
      table.dropColumn('google_api_key');
    }

    if (hasGoogleCalendarId) {
      table.dropColumn('google_calendar_id');
    }
  });
}

async function ensureSpecialistsUserId(knex: Knex) {
  const hasWebUserId = await knex.schema.hasColumn(SPECIALISTS_TABLE, 'web_user_id');
  const hasUserId = await knex.schema.hasColumn(SPECIALISTS_TABLE, 'user_id');

  if (hasWebUserId && !hasUserId) {
    await knex.schema.alterTable(SPECIALISTS_TABLE, (table) => {
      table.renameColumn('web_user_id', 'user_id');
    });
  } else if (hasWebUserId && hasUserId) {
    await knex(SPECIALISTS_TABLE)
      .whereNull('user_id')
      .whereNotNull('web_user_id')
      .update({ user_id: knex.ref('web_user_id') });

    await knex.schema.alterTable(SPECIALISTS_TABLE, (table) => {
      table.dropColumn('web_user_id');
    });
  }

  const hasUserIdAfter = await knex.schema.hasColumn(SPECIALISTS_TABLE, 'user_id');
  if (!hasUserIdAfter) {
    await knex.schema.alterTable(SPECIALISTS_TABLE, (table) => {
      table.integer('user_id').references('id').inTable(WEB_USERS_TABLE).onDelete('SET NULL');
    });
  }

  await knex.raw('DROP INDEX IF EXISTS "specialists_web_user_id_index"');
  await knex.raw('DROP INDEX IF EXISTS "specialists_account_id_web_user_id_unique"');

  await knex.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS "specialists_account_id_user_id_unique" ON "specialists" ("account_id", "user_id") WHERE "user_id" IS NOT NULL',
  );
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS "specialists_user_id_index" ON "specialists" ("user_id")',
  );
}

export async function up(knex: Knex): Promise<void> {
  const hasSpecialists = await knex.schema.hasTable(SPECIALISTS_TABLE);
  if (!hasSpecialists) {
    return;
  }

  await dropSpecialistsGoogleColumns(knex);
  await ensureSpecialistsUserId(knex);
}

export async function down(knex: Knex): Promise<void> {
  const hasSpecialists = await knex.schema.hasTable(SPECIALISTS_TABLE);
  if (!hasSpecialists) {
    return;
  }

  const hasUserId = await knex.schema.hasColumn(SPECIALISTS_TABLE, 'user_id');
  const hasWebUserId = await knex.schema.hasColumn(SPECIALISTS_TABLE, 'web_user_id');

  if (hasUserId && !hasWebUserId) {
    await knex.schema.alterTable(SPECIALISTS_TABLE, (table) => {
      table.renameColumn('user_id', 'web_user_id');
    });
  }

  const hasGoogleApiKey = await knex.schema.hasColumn(SPECIALISTS_TABLE, 'google_api_key');
  const hasGoogleCalendarId = await knex.schema.hasColumn(SPECIALISTS_TABLE, 'google_calendar_id');

  await knex.schema.alterTable(SPECIALISTS_TABLE, (table) => {
    if (!hasGoogleApiKey) {
      table.string('google_api_key');
    }

    if (!hasGoogleCalendarId) {
      table.string('google_calendar_id');
    }
  });

  await knex.raw('DROP INDEX IF EXISTS "specialists_user_id_index"');
  await knex.raw('DROP INDEX IF EXISTS "specialists_account_id_user_id_unique"');

  await knex.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS "specialists_account_id_web_user_id_unique" ON "specialists" ("account_id", "web_user_id") WHERE "web_user_id" IS NOT NULL',
  );
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS "specialists_web_user_id_index" ON "specialists" ("web_user_id")',
  );
}
