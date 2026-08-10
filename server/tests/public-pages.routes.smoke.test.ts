import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { WebUserRole } from '../src/types/webUserRole.js';
import { validPublicPageDocument } from './publicPageTestFixture.js';

const resolveUserByAccessTokenMock = vi.hoisted(() => vi.fn());
const trackServerErrorMock = vi.hoisted(() => vi.fn());
const publicBooking = vi.hoisted(() => ({
  getPublicBookingOptions: vi.fn(),
  bookPublicAppointment: vi.fn(),
  getPublicAppointmentStatus: vi.fn(),
}));
const service = vi.hoisted(() => ({
  getPublicPages: vi.fn(),
  getPublicPage: vi.fn(),
  createPublicPageForAccount: vi.fn(),
  putPublicPageDraft: vi.fn(),
  publishPublicPageForAccount: vi.fn(),
  archivePublicPageForAccount: vi.fn(),
  deletePublicPageForAccount: vi.fn(),
  getPublishedPublicPage: vi.fn(),
}));
const mediaService = vi.hoisted(() => ({
  uploadPublicPageMedia: vi.fn(),
  getPublishedPublicPageMedia: vi.fn(),
  getAccountPublicPageMedia: vi.fn(),
  deletePublicPageMedia: vi.fn(),
}));

vi.mock('../src/services/authService.js', () => ({
  resolveUserByAccessToken: resolveUserByAccessTokenMock,
}));
vi.mock('../src/services/errorTrackingService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/errorTrackingService.js')>(
    '../src/services/errorTrackingService.js',
  );
  return { ...actual, trackServerError: trackServerErrorMock };
});
vi.mock('../src/services/publicPageService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/publicPageService.js')>(
    '../src/services/publicPageService.js',
  );
  return { ...actual, ...service };
});
vi.mock('../src/services/publicBookingService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/publicBookingService.js')>(
    '../src/services/publicBookingService.js',
  );
  return { ...actual, ...publicBooking };
});
vi.mock('../src/services/publicPageMediaService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/publicPageMediaService.js')>(
    '../src/services/publicPageMediaService.js',
  );
  return { ...actual, ...mediaService };
});

import { createApp } from '../src/app.js';
import { PublicPageRepositoryError } from '../src/repositories/publicPageRepository.js';
import { PublicBookingServiceError } from '../src/services/publicBookingService.js';

const owner = {
  id: '101',
  accountId: 7,
  email: 'owner@example.com',
  role: WebUserRole.Owner,
  passwordSalt: 'salt',
  passwordHash: 'hash',
  createdAt: '2026-07-28T00:00:00.000Z',
};

describe('public pages routes', () => {
  const app = createApp();
  let baseUrl = '';
  let server: Awaited<ReturnType<typeof app.listen>>;

  beforeAll(async () => {
    server = await new Promise((resolve) => {
      const started = app.listen(0, () => resolve(started));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  beforeEach(() => {
    resolveUserByAccessTokenMock.mockReset().mockResolvedValue(owner);
    trackServerErrorMock.mockReset().mockResolvedValue(undefined);
    Object.values(service).forEach((mock) => mock.mockReset());
    Object.values(publicBooking).forEach((mock) => mock.mockReset());
    Object.values(mediaService).forEach((mock) => mock.mockReset());
  });

  it('uploads raw account-scoped media and returns a MediaReference', async () => {
    mediaService.uploadPublicPageMedia.mockResolvedValue({
      id: '1f2ec7e3-f737-48f7-af97-ed82f2791bc7', mime: 'image/png', width: 10, height: 20,
    });
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    const response = await fetch(`${baseUrl}/api/public-pages/media`, {
      method: 'POST', headers: { authorization: 'Bearer token', 'content-type': 'image/png' }, body: png,
    });
    expect(response.status).toBe(201);
    expect(mediaService.uploadPublicPageMedia).toHaveBeenCalledWith(7, png, 'image/png');
    expect(await response.json()).toMatchObject({
      id: '1f2ec7e3-f737-48f7-af97-ed82f2791bc7', mimeType: 'image/png', alt: '', width: 10, height: 20,
    });
  });

  it('rejects unsupported upload content types before storage', async () => {
    const response = await fetch(`${baseUrl}/api/public-pages/media`, {
      method: 'POST', headers: { authorization: 'Bearer token', 'content-type': 'image/gif' }, body: Buffer.from('GIF89a'),
    });
    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ code: 'unsupported_media' });
    expect(mediaService.uploadPublicPageMedia).not.toHaveBeenCalled();
  });

  it('streams only media resolved by the published-media service without authentication', async () => {
    mediaService.getPublishedPublicPageMedia.mockResolvedValue({
      record: { mime: 'image/png', bytes: 4 }, body: Uint8Array.from([1, 2, 3, 4]),
    });
    const response = await fetch(`${baseUrl}/api/public-pages/media/1f2ec7e3-f737-48f7-af97-ed82f2791bc7/content`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(resolveUserByAccessTokenMock).not.toHaveBeenCalled();
  });

  it('deletes media in the authenticated account scope', async () => {
    const response = await fetch(`${baseUrl}/api/public-pages/media/1f2ec7e3-f737-48f7-af97-ed82f2791bc7`, {
      method: 'DELETE', headers: { authorization: 'Bearer token' },
    });
    expect(response.status).toBe(204);
    expect(mediaService.deletePublicPageMedia).toHaveBeenCalledWith(7, '1f2ec7e3-f737-48f7-af97-ed82f2791bc7');
  });

  it('previews draft media only through authenticated account scope', async () => {
    mediaService.getAccountPublicPageMedia.mockResolvedValue({
      record: { mime: 'image/webp', bytes: 3 }, body: Uint8Array.from([1, 2, 3]),
    });
    const response = await fetch(
      `${baseUrl}/api/public-pages/media/1f2ec7e3-f737-48f7-af97-ed82f2791bc7/preview`,
      { headers: { authorization: 'Bearer token' } },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mediaService.getAccountPublicPageMedia).toHaveBeenCalledWith(
      7, '1f2ec7e3-f737-48f7-af97-ed82f2791bc7',
    );
  });

  it('serves a published page without authentication', async () => {
    service.getPublishedPublicPage.mockResolvedValue({ ...validPublicPageDocument, status: 'published' });
    const response = await fetch(`${baseUrl}/api/public-pages/by-slug/valid-page`);
    expect(response.status).toBe(200);
    expect(resolveUserByAccessTokenMock).not.toHaveBeenCalled();
  });

  it('serves booking options and creates a redacted guest appointment without authentication', async () => {
    publicBooking.getPublicBookingOptions.mockResolvedValue({
      specialists: [{ id: 2, name: 'Jane Smith' }],
      services: [{ id: 3, name: 'Consultation', durationMin: 60, price: 100, currency: 'RUB' }],
    });
    publicBooking.bookPublicAppointment.mockResolvedValue({
      id: 10, status: 'new', scheduledAt: '2026-08-01T10:00:00.000Z', duration: 60,
    });

    const options = await fetch(`${baseUrl}/api/public-pages/by-slug/valid-page/booking-options`);
    const created = await fetch(`${baseUrl}/api/public-pages/by-slug/valid-page/appointments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Guest',
        lastName: 'User',
        email: 'guest@example.com',
        specialistId: 2,
        serviceId: 3,
        startAt: '2026-08-01T10:00:00.000Z',
      }),
    });

    expect(options.status).toBe(200);
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({
      id: 10, status: 'new', scheduledAt: '2026-08-01T10:00:00.000Z', duration: 60,
    });
    expect(resolveUserByAccessTokenMock).not.toHaveBeenCalled();
  });

  it('returns only public meeting status fields and disables caching', async () => {
    publicBooking.getPublicAppointmentStatus.mockResolvedValue({
      status: 'confirmed',
      scheduledAt: '2026-08-01T10:00:00.000Z',
      duration: 60,
      service: 'Consultation',
      specialist: 'Jane Smith',
      meeting: { provider: 'zoom', meetingUrl: 'https://zoom.us/j/123' },
    });
    const response = await fetch(
      `${baseUrl}/api/public-pages/by-slug/valid-page/appointments/10/status?specialistLastName=Smith`,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).not.toHaveProperty('email');
    expect(body).not.toHaveProperty('clientId');
    expect(body).not.toHaveProperty('notes');
    expect(body).toEqual(expect.objectContaining({ status: 'confirmed', specialist: 'Jane Smith' }));
  });

  it('returns 422 for an unsupported meeting provider', async () => {
    const response = await fetch(`${baseUrl}/api/public-pages/by-slug/valid-page/appointments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Guest',
        lastName: 'User',
        email: 'guest@example.com',
        specialistId: 2,
        serviceId: 3,
        startAt: '2026-08-01T10:00:00.000Z',
        meetingProvider: 'teams',
      }),
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ code: 'invalid_selection' });
  });

  it('maps an unavailable public booking slot to a stable 409 response', async () => {
    publicBooking.bookPublicAppointment.mockRejectedValue(
      new PublicBookingServiceError('SLOT_UNAVAILABLE'),
    );
    const response = await fetch(`${baseUrl}/api/public-pages/by-slug/valid-page/appointments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Guest',
        lastName: 'User',
        email: 'guest@example.com',
        specialistId: 2,
        serviceId: 3,
        startAt: '2030-08-01T10:00:00.000Z',
      }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: 'slot_unavailable' });
  });

  it('passes token account scope and revision to draft save', async () => {
    service.putPublicPageDraft.mockResolvedValue({
      id: 'page-1', draft: validPublicPageDocument, published: null, revision: 1,
    });
    const response = await fetch(`${baseUrl}/api/public-pages/page-1/draft`, {
      method: 'PUT',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({ document: validPublicPageDocument, expectedRevision: 0 }),
    });
    expect(response.status).toBe(200);
    expect(service.putPublicPageDraft).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 7, pageId: 'page-1', expectedRevision: 0,
    }));
  });

  it('creates with account scope from authentication only', async () => {
    service.createPublicPageForAccount.mockResolvedValue({
      id: 'page-1', status: 'draft', draft: validPublicPageDocument, published: null, revision: 1,
    });
    const response = await fetch(`${baseUrl}/api/public-pages`, {
      method: 'POST',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({ document: validPublicPageDocument, accountId: 999 }),
    });
    expect(response.status).toBe(400);

    const created = await fetch(`${baseUrl}/api/public-pages`, {
      method: 'POST',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({ document: validPublicPageDocument }),
    });
    expect(created.status).toBe(201);
    expect(service.createPublicPageForAccount).toHaveBeenCalledWith(7, validPublicPageDocument);
  });

  it('publishes and archives through distinct revision-checked actions', async () => {
    service.publishPublicPageForAccount.mockResolvedValue({ id: 'page-1', status: 'published', revision: 2 });
    service.archivePublicPageForAccount.mockResolvedValue({ id: 'page-1', status: 'archived', revision: 3 });
    const headers = { authorization: 'Bearer token', 'content-type': 'application/json' };
    const published = await fetch(`${baseUrl}/api/public-pages/page-1/publish`, {
      method: 'POST', headers, body: JSON.stringify({ expectedRevision: 1 }),
    });
    const archived = await fetch(`${baseUrl}/api/public-pages/page-1/archive`, {
      method: 'POST', headers, body: JSON.stringify({ expectedRevision: 2 }),
    });
    expect(published.status).toBe(200);
    expect(archived.status).toBe(200);
    expect(service.publishPublicPageForAccount).toHaveBeenCalledWith(7, 'page-1', 1);
    expect(service.archivePublicPageForAccount).toHaveBeenCalledWith(7, 'page-1', 2);
  });

  it('returns the current record with revision conflicts', async () => {
    service.putPublicPageDraft.mockRejectedValue(new PublicPageRepositoryError('REVISION_CONFLICT', {
      id: 'page-1',
      account_id: 7,
      status: 'draft',
      draft_document: validPublicPageDocument,
      published_document: null,
      revision: 4,
      created_at: '2026-07-28T00:00:00.000Z',
      updated_at: '2026-07-28T01:00:00.000Z',
      published_at: null,
      archived_at: null,
    }));
    const response = await fetch(`${baseUrl}/api/public-pages/page-1/draft`, {
      method: 'PUT',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({ document: validPublicPageDocument, expectedRevision: 3 }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: 'revision_conflict',
      current: { id: 'page-1', revision: 4, status: 'draft' },
    });
  });

  it('permanently deletes archived records with a 204 response', async () => {
    service.deletePublicPageForAccount.mockResolvedValue(undefined);
    const response = await fetch(`${baseUrl}/api/public-pages/page-1`, {
      method: 'DELETE',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision: 5 }),
    });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it('forbids specialists from admin routes', async () => {
    resolveUserByAccessTokenMock.mockResolvedValue({ ...owner, role: WebUserRole.Specialist });
    const response = await fetch(`${baseUrl}/api/public-pages`, {
      headers: { authorization: 'Bearer token' },
    });
    expect(response.status).toBe(403);
    expect(service.getPublicPages).not.toHaveBeenCalled();
  });

  it('returns invalid_request for a malformed revision body', async () => {
    const response = await fetch(`${baseUrl}/api/public-pages/page-1/publish`, {
      method: 'POST',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision: -1 }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: 'invalid_request' });
  });

  it('accepts realistic documents above the unrelated global 32 KiB limit', async () => {
    service.putPublicPageDraft.mockResolvedValue({
      id: 'page-1', draft: validPublicPageDocument, published: null, revision: 1,
    });
    const response = await fetch(`${baseUrl}/api/public-pages/page-1/draft`, {
      method: 'PUT',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({
        document: {
          ...validPublicPageDocument,
          profile: { ...validPublicPageDocument.profile, description: 'x'.repeat(40 * 1024) },
        },
        expectedRevision: 0,
      }),
    });
    expect(response.status).toBe(200);
  });

  it('maps documents above the public-page bound to invalid_request', async () => {
    const response = await fetch(`${baseUrl}/api/public-pages/page-1/draft`, {
      method: 'PUT',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({
        document: {
          ...validPublicPageDocument,
          profile: { ...validPublicPageDocument.profile, description: 'x'.repeat(260 * 1024) },
        },
        expectedRevision: 0,
      }),
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ code: 'invalid_request' });
  });

  it('maps malformed public-page JSON to invalid_request without tracking it as a server error', async () => {
    const response = await fetch(`${baseUrl}/api/public-pages/page-1/draft`, {
      method: 'PUT',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: '{"document":',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: 'invalid_request' });
    expect(trackServerErrorMock).not.toHaveBeenCalled();
  });

  it('maps malformed and oversized global JSON bodies without tracking server errors', async () => {
    const malformed = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"email":',
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ code: 'invalid_request' });

    const oversized = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `${'x'.repeat(33 * 1024)}@example.com`, password: 'password' }),
    });
    expect(oversized.status).toBe(413);
    expect(await oversized.json()).toEqual({ code: 'invalid_request' });
    expect(trackServerErrorMock).not.toHaveBeenCalled();
  });

  it('tracks public-page server failures', async () => {
    service.getPublicPages.mockRejectedValue(new Error('database unavailable'));
    const response = await fetch(`${baseUrl}/api/public-pages`, {
      headers: { authorization: 'Bearer token' },
    });
    expect(response.status).toBe(500);
    expect(trackServerErrorMock).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: '/api/public-pages',
      error: expect.objectContaining({ message: 'HTTP_500' }),
    }));
  });

  it('does not mislabel unknown repository errors as quota conflicts', async () => {
    const error = new PublicPageRepositoryError('QUOTA_EXCEEDED');
    Object.defineProperty(error, 'code', { value: 'FUTURE_REPOSITORY_ERROR' });
    service.getPublicPages.mockRejectedValue(error);

    const response = await fetch(`${baseUrl}/api/public-pages`, {
      headers: { authorization: 'Bearer token' },
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: 'internal_error' });
  });

  it('returns JSON for public lookup and unmatched GET failures', async () => {
    service.getPublishedPublicPage.mockRejectedValue(new Error('database unavailable'));
    const failed = await fetch(`${baseUrl}/api/public-pages/by-slug/valid-page`);
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ code: 'internal_error' });

    const missing = await fetch(`${baseUrl}/does-not-exist`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ code: 'not_found' });
  });
});
