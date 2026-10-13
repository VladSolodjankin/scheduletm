import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const resolveUserByAccessToken = vi.hoisted(() => vi.fn());
const listReviewsForActor = vi.hoisted(() => vi.fn());
const createReviewForActor = vi.hoisted(() => vi.fn());
const updateReviewForActor = vi.hoisted(() => vi.fn());
const deleteReviewForActor = vi.hoisted(() => vi.fn());
vi.mock('../src/services/authService.js', () => ({ resolveUserByAccessToken }));
vi.mock('../src/services/reviewService.js', async (original) => ({
  ...await original<typeof import('../src/services/reviewService.js')>(),
  listReviewsForActor, createReviewForActor, updateReviewForActor, deleteReviewForActor,
}));

import { ReviewError } from '../src/services/reviewService.js';

const actor = { id: '5', accountId: 2, email: 'owner@test.dev', role: WebUserRole.Owner, passwordSalt: '', passwordHash: '', createdAt: '' };
const headers = { authorization: 'Bearer token', 'content-type': 'application/json' };
const valid = { name: 'Anna', text: 'Great', rating: 5 };

describe('account reviews routes', () => {
  const app = createApp();
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;
  const post = (body: unknown) => fetch(`${baseUrl}/api/account-reviews`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  const patch = (id: string, body: unknown) => fetch(`${baseUrl}/api/account-reviews/${id}`, {
    method: 'PATCH', headers, body: JSON.stringify(body),
  });
  const del = (id: string) => fetch(`${baseUrl}/api/account-reviews/${id}`, { method: 'DELETE', headers });
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
    expect((await fetch(`${baseUrl}/api/account-reviews`)).status).toBe(401);
  });
  it.each([WebUserRole.Specialist, WebUserRole.Client])('forbids %s', async (role) => {
    resolveUserByAccessToken.mockResolvedValue({ ...actor, role });
    const response = await fetch(`${baseUrl}/api/account-reviews`, { headers });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: 'forbidden' });
    expect((await post(valid)).status).toBe(403);
    expect((await patch('3', { status: 'hidden' })).status).toBe(403);
    expect((await del('3')).status).toBe(403);
    expect(listReviewsForActor).not.toHaveBeenCalled();
    expect(createReviewForActor).not.toHaveBeenCalled();
  });
  it.each([WebUserRole.Owner, WebUserRole.ProductAdmin])('lists reviews for %s', async (role) => {
    resolveUserByAccessToken.mockResolvedValue({ ...actor, role });
    listReviewsForActor.mockResolvedValue({ reviews: [], limit: 30 });
    const response = await fetch(`${baseUrl}/api/account-reviews`, { headers });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reviews: [], limit: 30 });
  });
  it('creates a review with defaults', async () => {
    createReviewForActor.mockResolvedValue({ id: 1 });
    const response = await post(valid);
    expect(response.status).toBe(201);
    expect(createReviewForActor).toHaveBeenCalledWith(actor, { ...valid, reviewDate: '', status: 'published' });
  });
  it.each([
    ['rating 0', { ...valid, rating: 0 }],
    ['rating 6', { ...valid, rating: 6 }],
    ['rating 3.5', { ...valid, rating: 3.5 }],
    ['rating string', { ...valid, rating: '4' }],
    ['empty name', { ...valid, name: '  ' }],
    ['long text', { ...valid, text: 'x'.repeat(1501) }],
    ['source', { ...valid, source: 'client' }],
    ['accountId', { ...valid, accountId: 9 }],
    ['screenshot without alt', { ...valid, screenshotMediaId: '1f2ec7e3-f737-48f7-af97-ed82f2791bc7' }],
    ['bad status', { ...valid, status: 'draft' }],
  ])('rejects %s', async (_name, body) => {
    expect((await post(body)).status).toBe(400);
    expect(createReviewForActor).not.toHaveBeenCalled();
  });
  it('maps limit and media errors', async () => {
    createReviewForActor.mockRejectedValueOnce(new ReviewError('REVIEW_LIMIT_REACHED'));
    const limit = await post(valid);
    expect(limit.status).toBe(409);
    expect(await limit.json()).toEqual({ code: 'review_limit_reached' });
    createReviewForActor.mockRejectedValueOnce(new ReviewError('MEDIA_NOT_FOUND'));
    const media = await post(valid);
    expect(media.status).toBe(404);
    expect(await media.json()).toEqual({ code: 'media_not_found' });
  });
  it('validates and updates via PATCH', async () => {
    expect((await patch('abc', { status: 'hidden' })).status).toBe(400);
    expect((await patch('3', {})).status).toBe(400);
    expect((await patch('3', { rating: 9 })).status).toBe(400);
    updateReviewForActor.mockResolvedValueOnce({ id: 3 });
    expect((await patch('3', { status: 'hidden' })).status).toBe(200);
    expect(updateReviewForActor).toHaveBeenCalledWith(actor, 3, { status: 'hidden' });
    updateReviewForActor.mockRejectedValueOnce(new ReviewError('NOT_FOUND'));
    const missing = await patch('4', { status: 'hidden' });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ code: 'not_found' });
  });
  it('deletes a review and returns 404 for unknown ids', async () => {
    deleteReviewForActor.mockResolvedValueOnce(undefined);
    expect((await del('3')).status).toBe(204);
    deleteReviewForActor.mockRejectedValueOnce(new ReviewError('NOT_FOUND'));
    expect((await del('4')).status).toBe(404);
    expect((await del('0')).status).toBe(400);
  });
  it('returns 500 for unexpected errors', async () => {
    listReviewsForActor.mockRejectedValueOnce(new Error('boom'));
    const response = await fetch(`${baseUrl}/api/account-reviews`, { headers });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: 'internal_error' });
  });
});
