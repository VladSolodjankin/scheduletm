import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { WebUserRole } from '../src/types/webUserRole.js';

const resolveUserByAccessToken = vi.hoisted(() => vi.fn());
const repo = vi.hoisted(() => ({
  findAccountSettingsByAccountId: vi.fn(),
  updateAccountSettingsByAccountId: vi.fn(),
  findAppSettingsByAccountId: vi.fn(),
  updateAppSettingsByAccountId: vi.fn(),
  findAccountById: vi.fn(),
}));
vi.mock('../src/services/authService.js', () => ({ resolveUserByAccessToken }));
vi.mock('../src/repositories/accountSettingsRepository.js', () => ({
  findAccountSettingsByAccountId: repo.findAccountSettingsByAccountId,
  updateAccountSettingsByAccountId: repo.updateAccountSettingsByAccountId,
}));
vi.mock('../src/repositories/appSettingsRepository.js', () => ({
  findAppSettingsByAccountId: repo.findAppSettingsByAccountId,
  updateAppSettingsByAccountId: repo.updateAppSettingsByAccountId,
}));
vi.mock('../src/repositories/accountRepository.js', async (original) => ({
  ...await original<typeof import('../src/repositories/accountRepository.js')>(),
  findAccountById: repo.findAccountById,
}));

import { createApp } from '../src/app.js';

const owner = { id: '5', accountId: 2, email: 'owner@test.dev', role: WebUserRole.Owner, passwordSalt: '', passwordHash: '', createdAt: '' };
const headers = { authorization: 'Bearer token', 'content-type': 'application/json' };
const accountRow = {
  daily_digest_enabled: true, slot_duration_min: 30, week_starts_on_monday: true, business_address: '',
  business_lat: null, business_lng: null, specialists_see_all_appointments: false,
};

describe('account settings work days', () => {
  const app = createApp();
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;
  const put = (body: unknown) => fetch(`${baseUrl}/api/settings/account`, { method: 'PUT', headers, body: JSON.stringify(body) });
  beforeAll(async () => {
    server = await new Promise((resolve) => { const started = app.listen(0, () => resolve(started)); });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  beforeEach(() => {
    vi.clearAllMocks();
    resolveUserByAccessToken.mockResolvedValue(owner);
    repo.findAccountSettingsByAccountId.mockResolvedValue(accountRow);
    repo.findAccountById.mockResolvedValue({ id: 2 });
    repo.findAppSettingsByAccountId.mockResolvedValue({ work_days: '1,2,3,4,5' });
  });

  it('returns work days from app settings, with a default when there are none', async () => {
    expect((await (await fetch(`${baseUrl}/api/settings/account`, { headers })).json()).workDays).toEqual([1, 2, 3, 4, 5]);
    repo.findAppSettingsByAccountId.mockResolvedValue(null);
    expect((await (await fetch(`${baseUrl}/api/settings/account`, { headers })).json()).workDays).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('lets the owner save work days sorted in their account', async () => {
    const response = await put({ workDays: [7, 1, 3] });
    expect(response.status).toBe(200);
    expect(repo.updateAppSettingsByAccountId).toHaveBeenCalledWith(expect.objectContaining({ accountId: 2, workDays: [1, 3, 7] }));
  });

  it('rejects invalid work days', async () => {
    for (const workDays of [[], [0], [1, 1]]) expect((await put({ workDays })).status).toBe(400);
    expect(repo.updateAppSettingsByAccountId).not.toHaveBeenCalled();
  });

  it('does not let specialists change work days', async () => {
    resolveUserByAccessToken.mockResolvedValue({ ...owner, role: WebUserRole.Specialist });
    expect((await put({ workDays: [1] })).status).toBe(403);
    expect(repo.updateAppSettingsByAccountId).not.toHaveBeenCalled();
  });
});
