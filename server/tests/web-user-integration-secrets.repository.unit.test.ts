import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.hoisted(() => ({
  insert: vi.fn(),
  onConflict: vi.fn(),
  merge: vi.fn(),
  where: vi.fn(),
  first: vi.fn(),
}));

const dbMock = vi.hoisted(() => Object.assign(
  vi.fn(() => queryMock),
  {
    fn: { now: vi.fn(() => '__NOW__') },
  },
));

vi.mock('../src/db/knex.js', () => ({ db: dbMock }));

import { env } from '../src/config/env.js';
import {
  findWebUserIntegrationByWebUserId,
  updateWebUserGoogleCredentials,
} from '../src/repositories/webUserIntegrationRepository.js';
import { down as rollbackEncryptedSecretColumns } from '../src/db/migrations/20260730150000_add_encrypted_web_user_integration_secrets.js';
import type { Knex } from 'knex';

describe('web user integration secret repository mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.APP_ENCRYPTION_KEY = 'test-encryption-key';
    queryMock.insert.mockReturnValue(queryMock);
    queryMock.onConflict.mockReturnValue(queryMock);
    queryMock.merge.mockResolvedValue(undefined);
    queryMock.where.mockReturnValue(queryMock);
  });

  afterEach(() => {
    env.APP_ENCRYPTION_KEY = '';
  });

  it('writes new Google credentials only to encrypted columns with account scope', async () => {
    await updateWebUserGoogleCredentials({
      accountId: 7,
      webUserId: 42,
      googleApiKey: 'google-access-secret',
      googleRefreshToken: 'google-refresh-secret',
    });

    expect(queryMock.insert).toHaveBeenCalledWith(expect.objectContaining({
      account_id: 7,
      web_user_id: 42,
      google_api_key: null,
      google_refresh_token: null,
      google_access_token_encrypted: expect.not.stringContaining('google-access-secret'),
      google_refresh_token_encrypted: expect.not.stringContaining('google-refresh-secret'),
    }));
  });

  it('prefers encrypted values and returns the established plaintext-shaped contract', async () => {
    await updateWebUserGoogleCredentials({
      accountId: 7,
      webUserId: 42,
      googleApiKey: 'encrypted-access',
      googleRefreshToken: 'encrypted-refresh',
    });
    const inserted = queryMock.insert.mock.calls[0]?.[0];

    queryMock.first.mockResolvedValue({
      id: 1,
      account_id: 7,
      web_user_id: 42,
      google_api_key: 'stale-plaintext-access',
      google_refresh_token: 'stale-plaintext-refresh',
      google_access_token_encrypted: inserted.google_access_token_encrypted,
      google_refresh_token_encrypted: inserted.google_refresh_token_encrypted,
      google_token_expires_at: null,
      google_calendar_id: null,
      google_connected_at: null,
      telegram_bot_token: null,
      telegram_bot_token_encrypted: null,
      telegram_bot_username: null,
      telegram_bot_name: null,
      zoom_access_token: null,
      zoom_access_token_encrypted: null,
      zoom_refresh_token: null,
      zoom_refresh_token_encrypted: null,
      zoom_token_expires_at: null,
      zoom_connected_at: null,
      zoom_last_meeting_id: null,
      zoom_last_join_url: null,
      zoom_last_start_url: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const result = await findWebUserIntegrationByWebUserId(7, 42);

    expect(queryMock.where).toHaveBeenCalledWith({ account_id: 7, web_user_id: 42 });
    expect(result?.google_api_key).toBe('encrypted-access');
    expect(result?.google_refresh_token).toBe('encrypted-refresh');
    expect(result).not.toHaveProperty('google_access_token_encrypted');
  });

  it('uses plaintext only when the encrypted value is absent', async () => {
    queryMock.first.mockResolvedValue({
      account_id: 7,
      web_user_id: 42,
      google_api_key: 'legacy-access',
      google_refresh_token: null,
      google_access_token_encrypted: null,
      google_refresh_token_encrypted: null,
      telegram_bot_token: null,
      telegram_bot_token_encrypted: null,
      zoom_access_token: null,
      zoom_access_token_encrypted: null,
      zoom_refresh_token: null,
      zoom_refresh_token_encrypted: null,
    });

    await expect(findWebUserIntegrationByWebUserId(7, 42)).resolves.toEqual(
      expect.objectContaining({ google_api_key: 'legacy-access' }),
    );
  });

  it('fails explicitly instead of falling back when encrypted data cannot be read', async () => {
    queryMock.first.mockResolvedValue({
      account_id: 7,
      web_user_id: 42,
      google_api_key: 'must-not-fallback',
      google_refresh_token: null,
      google_access_token_encrypted: 'invalid-ciphertext',
      google_refresh_token_encrypted: null,
      telegram_bot_token: null,
      telegram_bot_token_encrypted: null,
      zoom_access_token: null,
      zoom_access_token_encrypted: null,
      zoom_refresh_token: null,
      zoom_refresh_token_encrypted: null,
    });

    await expect(findWebUserIntegrationByWebUserId(7, 42)).rejects.toThrow(
      'Unable to decrypt encrypted Google access token',
    );

    env.APP_ENCRYPTION_KEY = '';
    await expect(findWebUserIntegrationByWebUserId(7, 42)).rejects.toThrow(
      'APP_ENCRYPTION_KEY is required to read encrypted Google access token',
    );
  });

  it('requires APP_ENCRYPTION_KEY for new secret writes', async () => {
    env.APP_ENCRYPTION_KEY = '';

    await expect(updateWebUserGoogleCredentials({
      accountId: 7,
      webUserId: 42,
      googleApiKey: 'secret',
    })).rejects.toThrow('APP_ENCRYPTION_KEY is required to write encrypted Google access token');
    expect(queryMock.insert).not.toHaveBeenCalled();
  });

  it('refuses destructive rollback of encrypted credential columns', async () => {
    await expect(rollbackEncryptedSecretColumns({} as Knex)).rejects.toThrow(
      'Forward-only migration: encrypted integration credential columns cannot be dropped safely',
    );
  });
});
