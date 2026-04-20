import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/user.repository', () => {
  return {
    createUser: vi.fn(),
    findUserByTelegramId: vi.fn(),
    updateUserByTelegramId: vi.fn(),
  };
});

vi.mock('../../repositories/user-session.repository', () => {
  return {
    getOrCreateSession: vi.fn(),
  };
});

vi.mock('../../repositories/account.repository', () => {
  return {
    getDefaultAccountId: vi.fn(),
  };
});

vi.mock('../../repositories/web-user.repository', () => {
  return {
    findWebUserByEmail: vi.fn(),
  };
});

vi.mock('../../repositories/user-identity-link.repository', () => {
  return {
    linkTelegramUserToWebUser: vi.fn(),
  };
});

import {
  createUser,
  findUserByTelegramId,
  updateUserByTelegramId,
} from '../../repositories/user.repository';
import { getDefaultAccountId } from '../../repositories/account.repository';
import { getOrCreateSession } from '../../repositories/user-session.repository';
import { findWebUserByEmail } from '../../repositories/web-user.repository';
import { linkTelegramUserToWebUser } from '../../repositories/user-identity-link.repository';
import { findOrCreateTelegramUser } from '../user.service';

describe('findOrCreateTelegramUser', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('creates a new user (normalizes language) and creates session', async () => {
    vi.mocked(getDefaultAccountId).mockResolvedValue(7);
    vi.mocked(findUserByTelegramId).mockResolvedValue(null as any);
    vi.mocked(createUser).mockResolvedValue({
      id: 1,
      account_id: 7,
      telegram_id: 123,
      username: null,
      first_name: null,
      email: 'new@example.com',
      language_code: 'en',
    } as any);
    vi.mocked(findWebUserByEmail).mockResolvedValue({ id: 10 } as any);

    const out = await findOrCreateTelegramUser({
      telegramId: 123,
      languageCode: 'en-US',
    });

    expect(createUser).toHaveBeenCalledWith({
      accountId: 7,
      telegramId: 123,
      username: null,
      firstName: null,
      languageCode: 'en',
    });
    expect(getOrCreateSession).toHaveBeenCalledWith(7, 1);
    expect(findWebUserByEmail).toHaveBeenCalledWith(7, 'new@example.com');
    expect(linkTelegramUserToWebUser).toHaveBeenCalledWith(7, 1, 10);
    expect(out.isNew).toBe(true);
  });

  it('updates existing user profile fields without overwriting chosen language', async () => {
    vi.mocked(getDefaultAccountId).mockResolvedValue(7);
    vi.mocked(findUserByTelegramId).mockResolvedValue({
      id: 9,
      account_id: 7,
      telegram_id: 123,
      username: 'old',
      first_name: 'OldName',
      email: 'old@example.com',
      language_code: 'ru',
    } as any);

    vi.mocked(updateUserByTelegramId).mockResolvedValue({
      id: 9,
      account_id: 7,
      telegram_id: 123,
      username: 'new',
      first_name: 'NewName',
      email: 'old@example.com',
      language_code: 'ru',
    } as any);
    vi.mocked(findWebUserByEmail).mockResolvedValue({ id: 22 } as any);

    const out = await findOrCreateTelegramUser({
      telegramId: 123,
      username: 'new',
      firstName: 'NewName',
      languageCode: 'en', // should not be used for existing users
    });

    const updateArg = vi.mocked(updateUserByTelegramId).mock.calls[0]?.[2] as any;
    expect(updateUserByTelegramId).toHaveBeenCalledWith(
      7,
      123,
      expect.objectContaining({
        username: 'new',
        firstName: 'NewName',
      }),
    );
    expect(updateArg.languageCode).toBeUndefined();

    expect(getOrCreateSession).toHaveBeenCalledWith(7, 9);
    expect(linkTelegramUserToWebUser).toHaveBeenCalledWith(7, 9, 22);
    expect(out.isNew).toBe(false);
  });

  it('uses existing username/first_name when telegram profile fields are missing', async () => {
    vi.mocked(getDefaultAccountId).mockResolvedValue(7);
    vi.mocked(findUserByTelegramId).mockResolvedValue({
      id: 9,
      account_id: 7,
      telegram_id: 123,
      username: 'old',
      first_name: 'OldName',
      email: null,
      language_code: 'ru',
    } as any);

    vi.mocked(updateUserByTelegramId).mockResolvedValue({
      id: 9,
      account_id: 7,
      telegram_id: 123,
      username: 'old',
      first_name: 'OldName',
      email: null,
      language_code: 'ru',
    } as any);

    await findOrCreateTelegramUser({
      telegramId: 123,
      // no username/firstName
    });

    expect(updateUserByTelegramId).toHaveBeenCalledWith(7, 123, {
      username: 'old',
      firstName: 'OldName',
    });
    expect(findWebUserByEmail).not.toHaveBeenCalled();
    expect(linkTelegramUserToWebUser).not.toHaveBeenCalled();
  });
});
