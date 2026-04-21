import { db } from '../db/knex.js';

export async function createDefaultSpecialistForWebUserIfMissing(
  accountId: number,
  webUserId: number,
  email: string,
): Promise<void> {
  const existing = await db('specialists')
    .where({ account_id: accountId, user_id: webUserId })
    .first('id');

  if (existing) {
    return;
  }

  const fallbackName = email.split('@')[0]?.trim() || `Owner ${webUserId}`;

  await db('specialists').insert({
    account_id: accountId,
    code: `owner-${webUserId}`,
    name: fallbackName,
    is_active: true,
    is_default: true,
    user_id: webUserId,
  });
}

type CreateSpecialistInput = {
  accountId: number;
  webUserId: number;
  name: string;
  code: string;
};

export async function createSpecialistForWebUser(input: CreateSpecialistInput): Promise<number> {
  const [row] = await db('specialists')
    .insert({
      account_id: input.accountId,
      code: input.code,
      name: input.name,
      is_active: true,
      is_default: false,
      user_id: input.webUserId,
    })
    .returning<{ id: number }[]>('id');

  return row.id;
}

export type SpecialistRecord = {
  id: number;
  account_id: number;
  code: string;
  name: string;
  is_active: boolean;
  user_id: number | null;
};

export async function findSpecialistById(accountId: number, specialistId: number): Promise<SpecialistRecord | null> {
  const row = await db('specialists')
    .where({ account_id: accountId, id: specialistId })
    .first<SpecialistRecord>();

  return row ?? null;
}

export async function listSpecialistsByAccount(accountId: number): Promise<SpecialistRecord[]> {
  return db('specialists')
    .where({ account_id: accountId })
    .orderBy('name', 'asc');
}

export async function findSpecialistByWebUserId(accountId: number, webUserId: number): Promise<SpecialistRecord | null> {
  const row = await db('specialists')
    .where({ account_id: accountId, user_id: webUserId })
    .first<SpecialistRecord>();

  return row ?? null;
}
