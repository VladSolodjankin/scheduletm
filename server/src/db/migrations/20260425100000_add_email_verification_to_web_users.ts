import type { Knex } from 'knex';

const TABLE = 'web_users';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE);
  if (!hasTable) {
    return;
  }

  const hasEmailVerifiedAt = await knex.schema.hasColumn(TABLE, 'email_verified_at');
  const hasEmailVerificationCode = await knex.schema.hasColumn(TABLE, 'email_verification_code');
  const hasEmailVerificationSentAt = await knex.schema.hasColumn(TABLE, 'email_verification_sent_at');
  const hasPhoneVerifiedAt = await knex.schema.hasColumn(TABLE, 'phone_verified_at');

  await knex.schema.alterTable(TABLE, (table) => {
    if (!hasEmailVerifiedAt) {
      table.timestamp('email_verified_at', { useTz: true });
    }

    if (!hasEmailVerificationCode) {
      table.string('email_verification_code', 128);
    }

    if (!hasEmailVerificationSentAt) {
      table.timestamp('email_verification_sent_at', { useTz: true });
    }

    if (!hasPhoneVerifiedAt) {
      table.timestamp('phone_verified_at', { useTz: true });
    }
  });

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS web_users_email_verification_code_idx
    ON web_users (email_verification_code)
    WHERE email_verification_code IS NOT NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE);
  if (!hasTable) {
    return;
  }

  await knex.raw('DROP INDEX IF EXISTS web_users_email_verification_code_idx');

  const hasEmailVerifiedAt = await knex.schema.hasColumn(TABLE, 'email_verified_at');
  const hasEmailVerificationCode = await knex.schema.hasColumn(TABLE, 'email_verification_code');
  const hasEmailVerificationSentAt = await knex.schema.hasColumn(TABLE, 'email_verification_sent_at');
  const hasPhoneVerifiedAt = await knex.schema.hasColumn(TABLE, 'phone_verified_at');

  await knex.schema.alterTable(TABLE, (table) => {
    if (hasPhoneVerifiedAt) {
      table.dropColumn('phone_verified_at');
    }

    if (hasEmailVerificationSentAt) {
      table.dropColumn('email_verification_sent_at');
    }

    if (hasEmailVerificationCode) {
      table.dropColumn('email_verification_code');
    }

    if (hasEmailVerifiedAt) {
      table.dropColumn('email_verified_at');
    }
  });
}
