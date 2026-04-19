import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  const [account] = await knex('accounts')
    .insert({
      code: 'default',
      name: 'Default workspace',
    })
    .onConflict('code')
    .merge()
    .returning<{ id: number }[]>('id');

  const accountId = account.id;

  await knex('user_sessions').del();
  await knex('appointments').del();
  await knex('specialists').del();
  await knex('services').del();
  await knex('app_settings').del();

  await knex('services').insert([
    {
      account_id: accountId,
      code: 'first_consultation',
      name_ru: 'Первичная консультация',
      name_en: 'First consultation',
      price: 0,
      currency: 'RUB',
      duration_min: 90,
      sessions_count: 1,
      is_first_free: true,
      is_active: true,
    },
    {
      account_id: accountId,
      code: 'single_session',
      name_ru: '1 сессия',
      name_en: '1 session',
      price: 2500,
      currency: 'RUB',
      duration_min: 90,
      sessions_count: 1,
      is_first_free: false,
      is_active: true,
    },
    {
      account_id: accountId,
      code: 'package_10',
      name_ru: '10 сессий',
      name_en: '10 sessions',
      price: 22500,
      currency: 'RUB',
      duration_min: 90,
      sessions_count: 10,
      is_first_free: false,
      is_active: true,
    },
  ]);

  await knex('app_settings').insert([
    {
      account_id: accountId,
      timezone: 'Europe/Moscow',
      work_start_hour: 9,
      work_end_hour: 20,
      work_days: '1,2,3,4,5,6',
      slot_duration_min: 90,
      reminder_offsets_min: '1440,60,30',
      reminder_comment: '',
    },
  ]);

  await knex('specialists').insert([
    {
      account_id: accountId,
      code: 'main_psychologist',
      name: 'Лилия Солодянкина',
      is_active: true,
      is_default: true,
    },
  ]);
}
