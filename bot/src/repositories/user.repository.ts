import { db } from "../db/knex";

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

export async function findUserByTelegramId(accountId: number, telegramId: number) {
  return db("users").where({ account_id: accountId, telegram_id: telegramId }).first();
}

export async function createUser(input: CreateUserInput) {
  const [user] = await db("users")
    .insert({
      account_id: input.accountId,
      telegram_id: input.telegramId,
      username: input.username ?? null,
      first_name: input.firstName ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
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
  if (patch.phone !== undefined) updateData.phone = patch.phone;
  if (patch.email !== undefined) updateData.email = patch.email;
  if (patch.reminderComment !== undefined) updateData.reminder_comment = patch.reminderComment;
  if (patch.languageCode !== undefined) {
    updateData.language_code = patch.languageCode;
  }

  const [user] = await db("users")
    .where({ account_id: accountId, telegram_id: telegramId })
    .update(updateData, ["*"]);

  return user;
}
