import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const resolveUserByAccessToken = vi.hoisted(() => vi.fn());
const getServicesForActor = vi.hoisted(() => vi.fn());
const createServiceForActor = vi.hoisted(() => vi.fn());
const updateServiceForActor = vi.hoisted(() => vi.fn());
const updateAssignmentForActor = vi.hoisted(() => vi.fn());
const getServiceDeleteImpactForActor = vi.hoisted(() => vi.fn());
const deleteServiceForActor = vi.hoisted(() => vi.fn());
vi.mock('../src/services/authService.js', () => ({ resolveUserByAccessToken }));
vi.mock('../src/services/serviceService.js', async (original) => ({
  ...await original<typeof import('../src/services/serviceService.js')>(),
  getServicesForActor, createServiceForActor, updateServiceForActor, updateAssignmentForActor,
  getServiceDeleteImpactForActor, deleteServiceForActor,
}));

const actor = { id: '5', accountId: 2, email: 'owner@test.dev', role: WebUserRole.Owner, passwordSalt: '', passwordHash: '', createdAt: '' };

describe('services routes', () => {
  const app = createApp();
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;
  beforeAll(async () => {
    server = await new Promise((resolve) => { const started = app.listen(0, () => resolve(started)); });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  beforeEach(() => {
    vi.clearAllMocks();
    resolveUserByAccessToken.mockResolvedValue(actor);
  });

  it('requires authentication', async () => {
    expect((await fetch(`${baseUrl}/api/services`)).status).toBe(401);
  });
  it('returns the service DTO list', async () => {
    getServicesForActor.mockResolvedValue({ services: [{ id: 1, name: 'Consultation', assignments: [] }], specialists: [] });
    const response = await fetch(`${baseUrl}/api/services`, { headers: { authorization: 'Bearer token' } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ services: [{ id: 1, name: 'Consultation', assignments: [] }], specialists: [] });
  });
  it('validates create payload', async () => {
    const response = await fetch(`${baseUrl}/api/services`, {
      method: 'POST', headers: { authorization: 'Bearer token', 'content-type': 'application/json' }, body: '{}',
    });
    expect(response.status).toBe(400);
  });
  it('strictly rejects the removed imageUrl input', async () => {
    const response = await fetch(`${baseUrl}/api/services`, {
      method: 'POST', headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Consultation', basePrice: 100, baseDurationMinutes: 30,
        imageUrl: 'https://cdn.example.com/image.jpg',
      }),
    });
    expect(response.status).toBe(400);
    expect(createServiceForActor).not.toHaveBeenCalled();
  });
  it('updates a specialist assignment', async () => {
    updateAssignmentForActor.mockResolvedValue({ id: 3 });
    const response = await fetch(`${baseUrl}/api/services/3/specialists/8`, {
      method: 'PATCH', headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({ priceOverride: 500 }),
    });
    expect(response.status).toBe(200);
    expect(updateAssignmentForActor).toHaveBeenCalledWith(actor, 3, 8, { priceOverride: 500 });
  });
  it('returns delete impact', async () => {
    const responsePayload = {
      canDelete: false,
      impact: { appointments: 0, appointmentGroups: 0, publicPages: 1 },
    };
    getServiceDeleteImpactForActor.mockResolvedValue(responsePayload);
    const response = await fetch(`${baseUrl}/api/services/3/delete-impact`, {
      headers: { authorization: 'Bearer token' },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(responsePayload);
    expect(getServiceDeleteImpactForActor).toHaveBeenCalledWith(actor, 3);
  });
  it('returns service_in_use with the transactionally rechecked impact', async () => {
    const { ServiceCatalogError } = await import('../src/services/serviceService.js');
    const impact = { appointments: 1, appointmentGroups: 0, publicPages: 0 };
    deleteServiceForActor.mockRejectedValue(new ServiceCatalogError('SERVICE_IN_USE', impact));
    const response = await fetch(`${baseUrl}/api/services/3`, {
      method: 'DELETE', headers: { authorization: 'Bearer token' },
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: 'service_in_use', impact });
  });
});
