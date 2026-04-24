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

type CreateSpecialistForWebUserInput = {
  accountId: number;
  webUserId: number;
  name: string;
  code: string;
};

export async function createSpecialistForWebUser(input: CreateSpecialistForWebUserInput): Promise<number> {
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
  timezone: string;
  slot_step_min: number | null;
};

type CreateSpecialistInput = {
  accountId: number;
  name: string;
  code: string;
  userId: number;
};

export async function createSpecialist(input: CreateSpecialistInput): Promise<number> {
  const [row] = await db('specialists')
    .insert({
      account_id: input.accountId,
      code: input.code,
      name: input.name,
      is_active: true,
      is_default: false,
      user_id: input.userId,
    })
    .returning<{ id: number }[]>('id');

  return row.id;
}

export async function updateSpecialistById(
  accountId: number,
  specialistId: number,
  payload: { name?: string; isActive?: boolean },
): Promise<void> {
  const nextPayload: Record<string, unknown> = {
    updated_at: db.fn.now(),
  };

  if (payload.name !== undefined) {
    nextPayload.name = payload.name.trim();
  }

  if (payload.isActive !== undefined) {
    nextPayload.is_active = payload.isActive;
  }

  await db('specialists')
    .where({ account_id: accountId, id: specialistId })
    .update(nextPayload);
}

export async function deactivateSpecialistById(accountId: number, specialistId: number): Promise<boolean> {
  const updated = await db('specialists')
    .where({ account_id: accountId, id: specialistId })
    .update({
      is_active: false,
      updated_at: db.fn.now(),
    });

  return updated > 0;
}

export async function deactivateSpecialistByWebUserId(accountId: number, webUserId: number): Promise<void> {
  await db('specialists')
    .where({ account_id: accountId, user_id: webUserId })
    .update({
      is_active: false,
      updated_at: db.fn.now(),
    });
}
export type SpecialistCalendarCredentials = {
  specialistId: number;
  webUserId: number;
  googleApiKey: string;
  googleRefreshToken: string | null;
  googleTokenExpiresAt: Date | null;
  googleCalendarId: string | null;
};

export async function findSpecialistById(accountId: number, specialistId: number): Promise<SpecialistRecord | null> {
  const row = await db('specialists')
    .where({ account_id: accountId, id: specialistId })
    .first<SpecialistRecord>();

  return row ?? null;
}

export async function listSpecialistsByAccount(accountId: number): Promise<SpecialistRecord[]> {
  return db('specialists as s')
    .leftJoin('web_users as wu', function joinWebUsers() {
      this.on('wu.id', '=', 's.user_id').andOn('wu.account_id', '=', 's.account_id');
    })
    .where('s.account_id', accountId)
    .orderBy('s.name', 'asc')
    .select(
      's.id',
      's.account_id',
      's.code',
      's.name',
      's.is_active',
      's.user_id',
      's.slot_step_min',
      db.raw("COALESCE(wu.timezone, 'UTC') as timezone"),
    );
}

export async function findSpecialistByWebUserId(accountId: number, webUserId: number): Promise<SpecialistRecord | null> {
  const row = await db('specialists')
    .where({ account_id: accountId, user_id: webUserId })
    .first<SpecialistRecord>();

  return row ?? null;
}

export async function findSpecialistsCalendarCredentials(
  accountId: number,
  specialistIds: number[],
): Promise<SpecialistCalendarCredentials[]> {
  if (!specialistIds.length) {
    return [];
  }

  const rows = await db('specialists as s')
    .join('web_users as wu', function joinWebUsers() {
      this.on('wu.id', '=', 's.user_id').andOn('wu.account_id', '=', 's.account_id');
    })
    .leftJoin('web_user_integrations as wui', function joinWebUserIntegrations() {
      this.on('wui.web_user_id', '=', 'wu.id').andOn('wui.account_id', '=', 'wu.account_id');
    })
    .where('s.account_id', accountId)
    .whereIn('s.id', specialistIds)
    .whereNotNull('wui.google_api_key')
    .select(
      's.id as specialistId',
      'wu.id as webUserId',
      'wui.google_api_key as googleApiKey',
      'wui.google_refresh_token as googleRefreshToken',
      'wui.google_token_expires_at as googleTokenExpiresAt',
      'wui.google_calendar_id as googleCalendarId',
    );

  return rows.filter((row) => Boolean(row.googleApiKey));
}
