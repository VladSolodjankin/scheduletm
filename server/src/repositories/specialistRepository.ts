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
