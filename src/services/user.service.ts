import {
  createUser,
  findUserByTelegramId,
  updateUserByTelegramId,
} from '../repositories/user.repository';
import { getOrCreateSession } from '../repositories/user-session.repository';
import { normalizeLanguageCode } from '../i18n';

type TelegramProfile = {
  telegramId: number;
  username?: string;
  firstName?: string;
  languageCode?: string;
};

export async function findOrCreateTelegramUser(profile: TelegramProfile) {
  const languageCode = normalizeLanguageCode(profile.languageCode);
  const existing = await findUserByTelegramId(profile.telegramId);

  if (!existing) {
    const created = await createUser({
      telegramId: profile.telegramId,
      username: profile.username ?? null,
      firstName: profile.firstName ?? null,
      languageCode,
    });

    await getOrCreateSession(created.id);

    return {
      user: created,
      isNew: true,
    };
  }

  const updated = await updateUserByTelegramId(profile.telegramId, {
    username: profile.username ?? existing.username,
    firstName: profile.firstName ?? existing.first_name,
    // Do not overwrite user's chosen language on every update.
    // Telegram profile language_code is a useful default for new users only.
  });

  await getOrCreateSession(updated.id);

  return {
    user: updated,
    isNew: false,
  };
}
