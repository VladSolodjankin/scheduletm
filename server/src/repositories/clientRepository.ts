import { db } from '../db/knex.js';

export type ClientRecord = {
  id: number;
  account_id: number;
  telegram_id: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  preferred_meeting_provider: 'manual' | 'zoom' | 'offline' | null;
  created_at: Date;
  updated_at: Date;
};

export async function updateClientPreferredMeetingProvider(
  accountId: number,
  id: number,
  preferredMeetingProvider: 'manual' | 'zoom' | 'offline',
): Promise<void> {
  await db('clients')
    .where({ account_id: accountId, id })
    .update({
      preferred_meeting_provider: preferredMeetingProvider,
      updated_at: db.fn.now(),
    });
}

export type UpsertClientInput = {
  accountId: number;
  username?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
};

function normalizeNullable(value?: string): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export async function listClientsByAccount(accountId: number): Promise<ClientRecord[]> {
  return db('clients')
    .where({ account_id: accountId })
    .orderBy([{ column: 'last_name', order: 'asc' }, { column: 'first_name', order: 'asc' }, { column: 'id', order: 'asc' }])
    .select<ClientRecord[]>('*');
}

export async function findClientById(accountId: number, id: number): Promise<ClientRecord | null> {
  const row = await db('clients')
    .where({ account_id: accountId, id })
    .first<ClientRecord>();

  return row ?? null;
}

export async function findClientByContact(
  accountId: number,
  contact: { username?: string; phone?: string; email?: string },
): Promise<ClientRecord | null> {
  const username = normalizeNullable(contact.username);
  const phone = normalizeNullable(contact.phone);
  const email = normalizeNullable(contact.email)?.toLowerCase();

  if (!username && !phone && !email) {
    return null;
  }

  const query = db('clients')
    .where({ account_id: accountId })
    .andWhere((builder) => {
      if (username) {
        builder.orWhere('username', username);
      }

      if (phone) {
        builder.orWhere('phone', phone);
      }

      if (email) {
        builder.orWhereRaw('LOWER(email) = ?', [email]);
      }
    })
    .orderBy('id', 'asc')
    .first<ClientRecord>();

  const row = await query;
  return row ?? null;
}

export async function createClient(input: UpsertClientInput): Promise<ClientRecord> {
  const [row] = await db('clients')
    .insert({
      account_id: input.accountId,
      username: normalizeNullable(input.username),
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      phone: normalizeNullable(input.phone),
      email: normalizeNullable(input.email),
    })
    .returning<ClientRecord[]>('*');

  return row;
}

export async function updateClientById(accountId: number, id: number, input: UpsertClientInput): Promise<ClientRecord | null> {
  const [row] = await db('clients')
    .where({ account_id: accountId, id })
    .update({
      username: normalizeNullable(input.username),
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      phone: normalizeNullable(input.phone),
      email: normalizeNullable(input.email),
      updated_at: db.fn.now(),
    })
    .returning<ClientRecord[]>('*');

  return row ?? null;
}
