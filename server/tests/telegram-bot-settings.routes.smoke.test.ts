import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const resolveUserByAccessToken = vi.hoisted(() => vi.fn());
const findTelegramBotSettingsByAccountId = vi.hoisted(() => vi.fn());
const upsertTelegramBotSettings = vi.hoisted(() => vi.fn());
vi.mock('../src/services/authService.js', () => ({ resolveUserByAccessToken }));
vi.mock('../src/repositories/telegramBotSettingsRepository.js', async (original) => ({
  ...await original<typeof import('../src/repositories/telegramBotSettingsRepository.js')>(),
  findTelegramBotSettingsByAccountId,
  upsertTelegramBotSettings,
}));

const actor = { id: '5', accountId: 2, email: 'owner@test.dev', role: WebUserRole.Owner, passwordSalt: '', passwordHash: '', createdAt: '' };
const headers = { authorization: 'Bearer token', 'content-type': 'application/json' };
const stored = { bot_slug: 'acme-1', telegram_bot_enabled: true, bot_welcome_message: null };

describe('telegram bot settings routes', () => {
  const app = createApp();
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;
  const get = () => fetch(`${baseUrl}/api/settings/telegram-bot`, { headers });
  const put = (body: unknown) => fetch(`${baseUrl}/api/settings/telegram-bot`, {
    method: 'PUT', headers, body: JSON.stringify(body),
  });

  beforeAll(async () => {
    server = await new Promise((resolve) => { const started = app.listen(0, () => resolve(started)); });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  beforeEach(() => {
    vi.clearAllMocks();
    resolveUserByAccessToken.mockResolvedValue(actor);
    findTelegramBotSettingsByAccountId.mockResolvedValue(stored);
  });

  it('requires authentication', async () => {
    expect((await fetch(`${baseUrl}/api/settings/telegram-bot`)).status).toBe(401);
  });

  it.each([WebUserRole.Specialist, WebUserRole.Client])('forbids %s', async (role) => {
    resolveUserByAccessToken.mockResolvedValue({ ...actor, role });
    expect((await get()).status).toBe(403);
    expect((await put({ enabled: false })).status).toBe(403);
    expect(upsertTelegramBotSettings).not.toHaveBeenCalled();
  });

  it('returns the settings of the actor account', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enabled: true, slug: 'acme-1', welcomeMessage: '', botLink: null });
    expect(findTelegramBotSettingsByAccountId).toHaveBeenCalledWith(2);
  });

  it('generates a slug on first read', async () => {
    findTelegramBotSettingsByAccountId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ ...stored, bot_slug: 'generated01' });

    const response = await get();
    expect(response.status).toBe(200);
    expect(upsertTelegramBotSettings).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 2, botSlug: expect.stringMatching(/^[a-z0-9]{10}$/) }),
    );
  });

  it('updates enabled flag, slug and welcome message for the actor account', async () => {
    const response = await put({ enabled: false, slug: 'New-Slug', welcomeMessage: '  Hi there  ' });
    expect(response.status).toBe(200);
    expect(upsertTelegramBotSettings).toHaveBeenCalledWith({
      accountId: 2, botSlug: 'new-slug', enabled: false, welcomeMessage: 'Hi there',
    });
  });

  it('stores an empty welcome message as null so the localized default is used', async () => {
    await put({ welcomeMessage: '   ' });
    expect(upsertTelegramBotSettings).toHaveBeenCalledWith(
      expect.objectContaining({ welcomeMessage: null }),
    );
  });

  it.each([
    { slug: 'ab' },
    { slug: 'has space' },
    { slug: 'UPPER_ok', enabled: 'yes' },
    { welcomeMessage: 'x'.repeat(501) },
  ])('rejects invalid payload %j', async (body) => {
    const response = await put(body);
    expect(response.status).toBe(400);
    expect(upsertTelegramBotSettings).not.toHaveBeenCalled();
  });

  it('answers 409 when the slug is already taken', async () => {
    upsertTelegramBotSettings.mockRejectedValue(
      Object.assign(new Error('duplicate'), { code: '23505', constraint: 'account_settings_bot_slug_unique' }),
    );
    expect((await put({ slug: 'taken-slug' })).status).toBe(409);
  });
});
