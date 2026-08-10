import { db } from '../db/knex.js';

export type ServiceAssignmentRecord = {
  specialistId: number;
  specialistName: string;
  priceOverride: number | null;
  durationOverrideMinutes: number | null;
  isActive: boolean;
};

export type ServiceRecord = {
  id: number;
  account_id: number;
  name: string;
  description: string | null;
  price: number;
  duration_min: number;
  is_first_free: boolean;
  image_url: string | null;
  is_active: boolean;
};

export async function listServices(accountId: number, specialistId?: number): Promise<ServiceRecord[]> {
  const query = db('services as sv').where('sv.account_id', accountId);
  if (specialistId !== undefined) {
    query.join('specialist_services as ss', function joinAssignments() {
      this.on('ss.service_id', '=', 'sv.id').andOn('ss.account_id', '=', 'sv.account_id');
    }).where({ 'ss.specialist_id': specialistId, 'ss.is_active': true });
  }
  return query.orderBy('sv.name_en').select(
    'sv.id', 'sv.account_id', db.raw('sv.name_en as name'), 'sv.description', 'sv.price',
    'sv.duration_min', 'sv.is_first_free', 'sv.image_url', 'sv.is_active',
  );
}

export async function listAssignments(accountId: number, serviceIds: number[]): Promise<Array<ServiceAssignmentRecord & { serviceId: number }>> {
  if (!serviceIds.length) return [];
  return db('specialist_services as ss')
    .join('specialists as sp', function joinSpecialist() {
      this.on('sp.id', '=', 'ss.specialist_id').andOn('sp.account_id', '=', 'ss.account_id');
    })
    .where('ss.account_id', accountId).whereIn('ss.service_id', serviceIds)
    .select('ss.service_id as serviceId', 'ss.specialist_id as specialistId', 'sp.name as specialistName',
      'ss.price_override as priceOverride', 'ss.duration_override_minutes as durationOverrideMinutes',
      'ss.is_active as isActive');
}

export async function findService(accountId: number, id: number): Promise<ServiceRecord | null> {
  return (await db('services').where({ account_id: accountId, id }).first<ServiceRecord>(
    'id', 'account_id', db.raw('name_en as name'), 'description', 'price', 'duration_min',
    'is_first_free', 'image_url', 'is_active',
  )) ?? null;
}

export async function listActiveSpecialistIds(accountId: number): Promise<number[]> {
  const rows = await db('specialists').where({ account_id: accountId, is_active: true }).select<{ id: number }[]>('id');
  return rows.map(({ id }) => id);
}

export async function listSpecialistOptions(accountId: number): Promise<Array<{ id: number; name: string; isActive: boolean }>> {
  return db('specialists').where({ account_id: accountId }).orderBy('name')
    .select('id', 'name', 'is_active as isActive');
}

export async function findSpecialistForUser(accountId: number, userId: number): Promise<{ id: number } | null> {
  return (await db('specialists').where({ account_id: accountId, user_id: userId, is_active: true }).first<{ id: number }>('id')) ?? null;
}

export async function validateActiveSpecialists(accountId: number, ids: number[]): Promise<boolean> {
  if (!ids.length) return true;
  const [{ count }] = await db('specialists').where({ account_id: accountId, is_active: true }).whereIn('id', ids).count<{ count: string }[]>('* as count');
  return Number(count) === new Set(ids).size;
}

export async function createService(input: Omit<ServiceRecord, 'id' | 'account_id'> & { accountId: number; specialistIds: number[] }): Promise<number> {
  return db.transaction(async (trx) => {
    const code = `service-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [row] = await trx('services').insert({
      account_id: input.accountId, code, name_ru: input.name, name_en: input.name,
      description: input.description, price: input.price, duration_min: input.duration_min,
      is_first_free: input.is_first_free, image_url: input.image_url, is_active: input.is_active,
    }).returning<{ id: number }[]>('id');
    if (input.specialistIds.length) {
      await trx('specialist_services').insert(input.specialistIds.map((specialistId) => ({
        account_id: input.accountId, service_id: row.id, specialist_id: specialistId, is_active: true,
      })));
    }
    return row.id;
  });
}

export async function updateService(input: Partial<Omit<ServiceRecord, 'id' | 'account_id'>> & { accountId: number; id: number; specialistIds?: number[] }): Promise<void> {
  await db.transaction(async (trx) => {
    const payload: Record<string, unknown> = { updated_at: trx.fn.now() };
    if (input.name !== undefined) Object.assign(payload, { name_ru: input.name, name_en: input.name });
    for (const key of ['description', 'price', 'duration_min', 'is_first_free', 'image_url', 'is_active'] as const) {
      if (input[key] !== undefined) payload[key] = input[key];
    }
    await trx('services').where({ account_id: input.accountId, id: input.id }).update(payload);
    if (input.specialistIds !== undefined) {
      await trx('specialist_services')
        .where({ account_id: input.accountId, service_id: input.id })
        .whereNotIn('specialist_id', input.specialistIds)
        .update({ is_active: false, updated_at: trx.fn.now() });
      if (input.specialistIds.length) {
        await trx('specialist_services').insert(input.specialistIds.map((specialistId) => ({
          account_id: input.accountId, service_id: input.id, specialist_id: specialistId, is_active: true,
        }))).onConflict(['account_id', 'service_id', 'specialist_id']).merge({
          is_active: true,
          updated_at: trx.fn.now(),
        });
      }
    }
  });
}

export async function findAssignment(accountId: number, serviceId: number, specialistId: number) {
  return (await db('specialist_services').where({ account_id: accountId, service_id: serviceId, specialist_id: specialistId }).first()) ?? null;
}

export async function upsertAssignment(input: { accountId: number; serviceId: number; specialistId: number; priceOverride?: number | null; durationOverrideMinutes?: number | null; isActive?: boolean }) {
  const insert = {
    account_id: input.accountId, service_id: input.serviceId, specialist_id: input.specialistId,
    price_override: input.priceOverride ?? null, duration_override_minutes: input.durationOverrideMinutes ?? null,
    is_active: input.isActive ?? true, updated_at: db.fn.now(),
  };
  await db('specialist_services').insert(insert).onConflict(['account_id', 'service_id', 'specialist_id']).merge({
    ...(input.priceOverride !== undefined ? { price_override: input.priceOverride } : {}),
    ...(input.durationOverrideMinutes !== undefined ? { duration_override_minutes: input.durationOverrideMinutes } : {}),
    ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    updated_at: db.fn.now(),
  });
}
