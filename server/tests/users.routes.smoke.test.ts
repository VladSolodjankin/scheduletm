import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const resolveUserByAccessTokenMock = vi.hoisted(() => vi.fn());
const listManagedUsersMock = vi.hoisted(() => vi.fn());
const createManagedUserMock = vi.hoisted(() => vi.fn());
const updateManagedUserMock = vi.hoisted(() => vi.fn());
const deactivateManagedUserMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/authService.js', () => ({
  resolveUserByAccessToken: resolveUserByAccessTokenMock,
}));

vi.mock('../src/services/userManagementService.js', () => ({
  listManagedUsers: listManagedUsersMock,
  createManagedUser: createManagedUserMock,
  updateManagedUser: updateManagedUserMock,
  deactivateManagedUser: deactivateManagedUserMock,
}));

const authedUser = {
  id: '101',
  accountId: 1,
  email: 'owner@example.com',
  role: WebUserRole.Owner,
  passwordSalt: 'salt',
  passwordHash: 'hash',
  createdAt: '2026-04-22T09:00:00.000Z',
};

describe('users API route-smoke scenarios (mocked service layer)', () => {
  const app = createApp();
  let baseUrl = '';
  let server: Awaited<ReturnType<typeof app.listen>>;

  beforeAll(async () => {
    server = await new Promise((resolve) => {
      const started = app.listen(0, () => resolve(started));
    });

    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    resolveUserByAccessTokenMock.mockReset();
    listManagedUsersMock.mockReset();
    createManagedUserMock.mockReset();
    updateManagedUserMock.mockReset();
    deactivateManagedUserMock.mockReset();

    resolveUserByAccessTokenMock.mockResolvedValue(authedUser);
  });

  it('list: GET /api/users returns users', async () => {
    listManagedUsersMock.mockResolvedValue([{ id: 2, email: 'admin@example.com', role: 'admin', firstName: 'Ann', lastName: 'Lee', phone: '', telegramUsername: '', isActive: true, isVerified: true, createdAt: '2026-04-22T00:00:00.000Z' }]);

    const response = await fetch(`${baseUrl}/api/users`, {
      method: 'GET',
      headers: { authorization: 'Bearer smoke-token' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ users: [{ id: 2, email: 'admin@example.com' }] });
  });

  it('create: POST /api/users returns 201', async () => {
    createManagedUserMock.mockResolvedValue({ id: 3, email: 'new@example.com', role: 'specialist', firstName: 'New', lastName: 'User', phone: '', telegramUsername: '', isActive: false, isVerified: false, createdAt: '2026-04-22T00:00:00.000Z' });

    const response = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer smoke-token',
      },
      body: JSON.stringify({ email: 'new@example.com', role: 'specialist', firstName: 'New', lastName: 'User' }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id: 3, email: 'new@example.com' });
  });
});
