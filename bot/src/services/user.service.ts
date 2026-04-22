import {
  createUser,
  findUserByTelegramId,
  updateUserByTelegramId,
} from '../repositories/user.repository';
import { getOrCreateSession } from '../repositories/user-session.repository';
import { normalizeLanguageCode } from '../i18n';
import { getDefaultAccountId } from '../repositories/account.repository';
import { getDefaultTimezone } from '../repositories/app-settings.repository';

type TelegramProfile = {
  telegramId: number;
  username?: string;
  firstName?: string;
  languageCode?: string;
};

export async function findOrCreateTelegramUser(profile: TelegramProfile) {
  const languageCode = normalizeLanguageCode(profile.languageCode);
  const accountId = await getDefaultAccountId();
  const existing = await findUserByTelegramId(accountId, profile.telegramId);

  if (!existing) {
    const timezone = await getDefaultTimezone(accountId);

    const created = await createUser({
      accountId,
      telegramId: profile.telegramId,
      username: profile.username ?? null,
      firstName: profile.firstName ?? null,
      languageCode,
      timezone,
    });

    await getOrCreateSession(created.account_id, created.id);

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

  return {
    user: updated,
    isNew: false,
  };
}
