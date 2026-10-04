import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasCompletedSteps = await knex.schema.hasColumn('accounts', 'onboarding_completed_steps');
  const hasDismissedAt = await knex.schema.hasColumn('accounts', 'onboarding_dismissed_at');

  if (hasCompletedSteps && hasDismissedAt) {
    return;
  }

  await knex.schema.alterTable('accounts', (table) => {
    if (!hasCompletedSteps) {
      table.text('onboarding_completed_steps').nullable();
    }
    if (!hasDismissedAt) {
      table.timestamp('onboarding_dismissed_at', { useTz: true }).nullable();
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('accounts', (table) => {
    table.dropColumn('onboarding_completed_steps');
    table.dropColumn('onboarding_dismissed_at');
  });
}
