import { db } from "../db/knex";

const CLIENTS_TABLE = 'clients';

export type CreateUserInput = {
  accountId: number;
  telegramId: number;
  username?: string | null;
  firstName?: string | null;
  phone?: string | null;
  email?: string | null;
  languageCode?: string | null;
  reminderComment?: string | null;
};

function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const normalized = phone.trim();
  return normalized.length ? normalized : null;
}

function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length ? normalized : null;
}

export async function findUserByTelegramId(accountId: number, telegramId: number) {
  return db(CLIENTS_TABLE).where({ account_id: accountId, telegram_id: telegramId }).first();
}

export async function findUserByPhoneOrEmail(
  accountId: number,
  input: { phone?: string | null; email?: string | null },
) {
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);

  if (!phone && !email) {
    return null;
  }

  return db(CLIENTS_TABLE)
    .where({ account_id: accountId })
    .modify((query) => {
      if (phone) {
        query.orWhere('phone', phone);
      }
      if (email) {
        query.orWhereRaw('LOWER(email) = ?', [email]);
      }
    })
    .orderBy('id', 'asc')
    .first();
}

export async function createUser(input: CreateUserInput) {
  const [user] = await db(CLIENTS_TABLE)
    .insert({
      account_id: input.accountId,
      telegram_id: input.telegramId,
      username: input.username ?? null,
      first_name: input.firstName ?? null,
      phone: normalizePhone(input.phone),
      email: normalizeEmail(input.email),
      language_code: input.languageCode ?? "ru",
      reminder_comment: input.reminderComment ?? '',
    })
    .returning("*");

  return user;
}

export async function updateUserByTelegramId(
  accountId: number,
  telegramId: number,
  patch: Partial<CreateUserInput>
) {
  const updateData: Record<string, unknown> = {
    updated_at: db.fn.now(),
  };

  if (patch.username !== undefined) updateData.username = patch.username;
  if (patch.firstName !== undefined) updateData.first_name = patch.firstName;
  if (patch.phone !== undefined) updateData.phone = normalizePhone(patch.phone);
  if (patch.email !== undefined) updateData.email = normalizeEmail(patch.email);
  if (patch.reminderComment !== undefined) updateData.reminder_comment = patch.reminderComment;
  if (patch.languageCode !== undefined) {
    updateData.language_code = patch.languageCode;
  }

  const [user] = await db(CLIENTS_TABLE)
    .where({ account_id: accountId, telegram_id: telegramId })
    .update(updateData, ["*"]);

  return user;
}
