import {
  createUser,
  findUserByTelegramId,
  updateUserByTelegramId,
} from '../repositories/user.repository';
import { getOrCreateSession } from '../repositories/user-session.repository';
import { normalizeLanguageCode } from '../i18n';
import { getDefaultAccountId } from '../repositories/account.repository';
import { findWebUserByEmail } from '../repositories/web-user.repository';
import { linkTelegramUserToWebUser } from '../repositories/user-identity-link.repository';

type TelegramProfile = {
  telegramId: number;
  username?: string;
  firstName?: string;
  languageCode?: string;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function ensureIdentityLink(user: { account_id: number; id: number; email?: string | null }) {
  if (!user.email) {
    return;
  }

  const webUser = await findWebUserByEmail(user.account_id, normalizeEmail(user.email));
  if (!webUser) {
    return;
  }

  await linkTelegramUserToWebUser(user.account_id, user.id, webUser.id);
}

export async function findOrCreateTelegramUser(profile: TelegramProfile) {
  const languageCode = normalizeLanguageCode(profile.languageCode);
  const accountId = await getDefaultAccountId();
  const existing = await findUserByTelegramId(accountId, profile.telegramId);

  if (!existing) {
    const created = await createUser({
      accountId,
      telegramId: profile.telegramId,
      username: profile.username ?? null,
      firstName: profile.firstName ?? null,
      languageCode,
    });

    await getOrCreateSession(created.account_id, created.id);
    await ensureIdentityLink(created);

    return {
      user: created,
      isNew: true,
    };
  }

  const updated = await updateUserByTelegramId(accountId, profile.telegramId, {
    username: profile.username ?? existing.username,
    firstName: profile.firstName ?? existing.first_name,
    // Do not overwrite user's chosen language on every update.
    // Telegram profile language_code is a useful default for new users only.
  });

  await getOrCreateSession(updated.account_id, updated.id);
  await ensureIdentityLink(updated);

  return {
    user: updated,
    isNew: false,
  };
}
