import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../bot/bot', () => ({ setCustomBotWebhook: vi.fn() }));
vi.mock('../../repositories/bot-access.repository', () => ({
  listCustomBots: vi.fn(),
  markCustomBotWebhookRegistered: vi.fn(),
}));
vi.mock('../../utils/webhook-secret', () => ({ customBotWebhookSecret: (id: number) => `secret-${id}` }));
vi.mock('../../utils/logger', () => ({ logError: vi.fn(), logInfo: vi.fn() }));

import { setCustomBotWebhook } from '../../bot/bot';
import { listCustomBots, markCustomBotWebhookRegistered } from '../../repositories/bot-access.repository';
import { syncCustomBotWebhooks } from '../custom-bot-webhooks.job';

const hashOf = (token: string) => createHash('sha256').update(token).digest('hex');

describe('syncCustomBotWebhooks', () => {
  afterEach(() => vi.clearAllMocks());

  it('registers new or changed tokens only and remembers the registered hash', async () => {
    vi.mocked(listCustomBots).mockResolvedValue([
      { accountId: 1, token: 'new-token', registeredHash: null },
      { accountId: 2, token: 'same-token', registeredHash: hashOf('same-token') },
      { accountId: 3, token: 'rotated-token', registeredHash: hashOf('old-token') },
    ]);

    expect(await syncCustomBotWebhooks()).toBe(2);

    expect(setCustomBotWebhook).toHaveBeenCalledTimes(2);
    expect(setCustomBotWebhook).toHaveBeenCalledWith('new-token', 1, 'secret-1');
    expect(setCustomBotWebhook).toHaveBeenCalledWith('rotated-token', 3, 'secret-3');
    expect(markCustomBotWebhookRegistered).toHaveBeenCalledWith(1, hashOf('new-token'));
    expect(markCustomBotWebhookRegistered).not.toHaveBeenCalledWith(2, expect.anything());
  });

  it('keeps going and retries later when Telegram rejects one webhook', async () => {
    vi.mocked(listCustomBots).mockResolvedValue([
      { accountId: 1, token: 'bad', registeredHash: null },
      { accountId: 2, token: 'good', registeredHash: null },
    ]);
    vi.mocked(setCustomBotWebhook).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({});

    expect(await syncCustomBotWebhooks()).toBe(1);
    expect(markCustomBotWebhookRegistered).toHaveBeenCalledTimes(1);
    expect(markCustomBotWebhookRegistered).toHaveBeenCalledWith(2, hashOf('good'));
  });
});
