import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/bot-access.repository', () => ({
  findAccountBotSettingsByAccountId: vi.fn(),
  findAccountBotSettingsBySlug: vi.fn(),
  findBoundAccountId: vi.fn(),
  upsertAccountBinding: vi.fn(),
}));

vi.mock('../../repositories/public-page.repository', () => ({
  findFirstPublishedPublicPageSlug: vi.fn(),
}));

vi.mock('../user.service', () => ({
  findOrCreateTelegramUser: vi.fn(),
}));

import {
  findAccountBotSettingsByAccountId,
  findAccountBotSettingsBySlug,
  findBoundAccountId,
  upsertAccountBinding,
} from '../../repositories/bot-access.repository';
import { findFirstPublishedPublicPageSlug } from '../../repositories/public-page.repository';
import { findOrCreateTelegramUser } from '../user.service';
import { getDefaultInfoUrl, parseStartCommand, resolveBotAccess } from '../bot-access.service';

const profile = { telegramId: 500, firstName: 'Ivan' };
const userResult = { isNew: true, user: { id: 1, account_id: 7 } };
const settings = { accountId: 7, enabled: true, welcomeMessage: 'Hello!', hasCustomBot: false };

describe('getDefaultInfoUrl', () => {
  it('points to the first published public page', async () => {
    vi.mocked(findFirstPublishedPublicPageSlug).mockResolvedValue('acme');
    const url = await getDefaultInfoUrl();
    expect(url.endsWith('/acme')).toBe(true);
  });

  it('falls back to the site root when no page is published', async () => {
    vi.mocked(findFirstPublishedPublicPageSlug).mockResolvedValue(null);
    const url = await getDefaultInfoUrl();
    expect(url.endsWith('/')).toBe(false);
    expect(new URL(url).pathname).toBe('/');
  });
});

describe('parseStartCommand', () => {
  it('extracts the slug from /start <slug>', () => {
    expect(parseStartCommand('/start acme-1')).toEqual({ isStart: true, slug: 'acme-1' });
    expect(parseStartCommand('/start@meetli_bot acme-1')).toEqual({ isStart: true, slug: 'acme-1' });
  });

  it('treats a bare /start as a start without slug', () => {
    expect(parseStartCommand('/start')).toEqual({ isStart: true, slug: null });
  });

  it('ignores other messages', () => {
    expect(parseStartCommand('/reset')).toEqual({ isStart: false, slug: null });
    expect(parseStartCommand(undefined)).toEqual({ isStart: false, slug: null });
  });
});

describe('resolveBotAccess', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('binds the user and creates the client in the account found by slug', async () => {
    vi.mocked(findAccountBotSettingsBySlug).mockResolvedValue(settings);
    vi.mocked(findOrCreateTelegramUser).mockResolvedValue(userResult as never);

    const result = await resolveBotAccess({ profile, startSlug: 'Acme-1' });

    expect(findAccountBotSettingsBySlug).toHaveBeenCalledWith('acme-1');
    expect(upsertAccountBinding).toHaveBeenCalledWith(500, 7);
    expect(findOrCreateTelegramUser).toHaveBeenCalledWith(7, profile);
    expect(result).toEqual({ status: 'ok', userResult, enabled: true, welcomeMessage: 'Hello!' });
  });

  it('rejects an unknown slug without binding or creating a client', async () => {
    vi.mocked(findAccountBotSettingsBySlug).mockResolvedValue(null);

    const result = await resolveBotAccess({ profile, startSlug: 'nope' });

    expect(result).toEqual({ status: 'invalid_link' });
    expect(upsertAccountBinding).not.toHaveBeenCalled();
    expect(findOrCreateTelegramUser).not.toHaveBeenCalled();
  });

  it('rejects a malformed slug without querying the database', async () => {
    const result = await resolveBotAccess({ profile, startSlug: 'a b;--' });

    expect(result).toEqual({ status: 'invalid_link' });
    expect(findAccountBotSettingsBySlug).not.toHaveBeenCalled();
  });

  it('returns unbound for a user without binding', async () => {
    vi.mocked(findBoundAccountId).mockResolvedValue(null);

    const result = await resolveBotAccess({ profile, startSlug: null });

    expect(result).toEqual({ status: 'unbound' });
    expect(findOrCreateTelegramUser).not.toHaveBeenCalled();
  });

  it('uses the bound account when no slug is given', async () => {
    vi.mocked(findBoundAccountId).mockResolvedValue(7);
    vi.mocked(findAccountBotSettingsByAccountId).mockResolvedValue({ ...settings, enabled: false });
    vi.mocked(findOrCreateTelegramUser).mockResolvedValue(userResult as never);

    const result = await resolveBotAccess({ profile, startSlug: null });

    expect(findOrCreateTelegramUser).toHaveBeenCalledWith(7, profile);
    expect(result).toMatchObject({ status: 'ok', enabled: false });
  });

  it('returns unbound when the bound account is no longer active', async () => {
    vi.mocked(findBoundAccountId).mockResolvedValue(7);
    vi.mocked(findAccountBotSettingsByAccountId).mockResolvedValue(null);

    expect(await resolveBotAccess({ profile, startSlug: null })).toEqual({ status: 'unbound' });
  });

  it('switches the binding when another slug is opened', async () => {
    vi.mocked(findAccountBotSettingsBySlug).mockResolvedValue({ ...settings, accountId: 9 });
    vi.mocked(findOrCreateTelegramUser).mockResolvedValue(userResult as never);

    await resolveBotAccess({ profile, startSlug: 'other-space' });

    expect(upsertAccountBinding).toHaveBeenCalledWith(500, 9);
    expect(findOrCreateTelegramUser).toHaveBeenCalledWith(9, profile);
  });

  it('does not serve an account with its own bot through the shared slug link', async () => {
    vi.mocked(findAccountBotSettingsBySlug).mockResolvedValue({ ...settings, hasCustomBot: true });

    expect(await resolveBotAccess({ profile, startSlug: 'acme-1' })).toEqual({ status: 'invalid_link' });
    expect(upsertAccountBinding).not.toHaveBeenCalled();
  });

  it('drops a shared-bot binding once the bound account switched to its own bot', async () => {
    vi.mocked(findBoundAccountId).mockResolvedValue(7);
    vi.mocked(findAccountBotSettingsByAccountId).mockResolvedValue({ ...settings, hasCustomBot: true });

    expect(await resolveBotAccess({ profile, startSlug: null })).toEqual({ status: 'unbound' });
  });

  it('fixes the account for its own bot and ignores slug and bindings', async () => {
    vi.mocked(findAccountBotSettingsByAccountId).mockResolvedValue({ ...settings, hasCustomBot: true });
    vi.mocked(findOrCreateTelegramUser).mockResolvedValue(userResult as never);

    const result = await resolveBotAccess({ profile, startSlug: 'whatever', ownBotAccountId: 7 });

    expect(result).toMatchObject({ status: 'ok', enabled: true });
    expect(findOrCreateTelegramUser).toHaveBeenCalledWith(7, profile);
    expect(findBoundAccountId).not.toHaveBeenCalled();
    expect(findAccountBotSettingsBySlug).not.toHaveBeenCalled();
    expect(upsertAccountBinding).not.toHaveBeenCalled();
  });
});
