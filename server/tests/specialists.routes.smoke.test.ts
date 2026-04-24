import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const resolveUserByAccessTokenMock = vi.hoisted(() => vi.fn());
const getSpecialistsForActorMock = vi.hoisted(() => vi.fn());
const createSpecialistForActorMock = vi.hoisted(() => vi.fn());
const updateSpecialistForActorMock = vi.hoisted(() => vi.fn());
const deleteSpecialistForActorMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/authService.js', () => ({
  resolveUserByAccessToken: resolveUserByAccessTokenMock,
}));

vi.mock('../src/services/specialistService.js', () => ({
  getSpecialistsForActor: getSpecialistsForActorMock,
  createSpecialistForActor: createSpecialistForActorMock,
  updateSpecialistForActor: updateSpecialistForActorMock,
  deleteSpecialistForActor: deleteSpecialistForActorMock,
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

describe('specialists API route-smoke scenarios (mocked service layer)', () => {
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
    getSpecialistsForActorMock.mockReset();
    createSpecialistForActorMock.mockReset();
    updateSpecialistForActorMock.mockReset();
    deleteSpecialistForActorMock.mockReset();

    resolveUserByAccessTokenMock.mockResolvedValue(authedUser);
  });

  it('list: GET /api/specialists returns specialists', async () => {
    getSpecialistsForActorMock.mockResolvedValue([{ id: 1, name: 'Anna', code: 'anna-1', timezone: 'UTC', isActive: true, slotStepMin: 30 }]);

    const response = await fetch(`${baseUrl}/api/specialists`, {
      method: 'GET',
      headers: { authorization: 'Bearer smoke-token' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      specialists: [{ id: 1, name: 'Anna' }],
    });
  });

  it('create: POST /api/specialists returns 201', async () => {
    createSpecialistForActorMock.mockResolvedValue({ id: 2, name: 'New Spec', code: 'new-spec-1', timezone: 'UTC', isActive: true, slotStepMin: 30 });

    const response = await fetch(`${baseUrl}/api/specialists`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer smoke-token',
      },
      body: JSON.stringify({ name: 'New Spec' }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id: 2, name: 'New Spec' });
  });

  it('update: PATCH /api/specialists/:id returns 200', async () => {
    updateSpecialistForActorMock.mockResolvedValue({ id: 2, name: 'Updated', code: 'updated', timezone: 'UTC', isActive: true, slotStepMin: 30 });

    const response = await fetch(`${baseUrl}/api/specialists/2`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer smoke-token',
      },
      body: JSON.stringify({ name: 'Updated', isActive: true }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: 2, name: 'Updated' });
  });

  it('delete: DELETE /api/specialists/:id returns 204', async () => {
    deleteSpecialistForActorMock.mockResolvedValue(true);

    const response = await fetch(`${baseUrl}/api/specialists/2`, {
      method: 'DELETE',
      headers: {
        authorization: 'Bearer smoke-token',
      },
    });

    expect(response.status).toBe(204);
  });
});
