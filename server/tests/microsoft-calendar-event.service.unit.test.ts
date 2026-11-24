import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';

const syncRepo = vi.hoisted(() => ({
  findGoogleCalendarSyncAppointment: vi.fn(),
  setAppointmentGoogleEvent: vi.fn(),
  setAppointmentMicrosoftEvent: vi.fn(),
  listAppointmentsWithGoogleEvents: vi.fn(),
  listAppointmentsWithMicrosoftEvents: vi.fn(),
}));
const integrationRepo = vi.hoisted(() => ({ findWebUserIntegrationByWebUserId: vi.fn() }));
const availability = vi.hoisted(() => ({ resolveUsableGoogleAccessToken: vi.fn() }));
const microsoftOAuth = vi.hoisted(() => ({ resolveUsableMicrosoftAccessToken: vi.fn() }));

vi.mock('axios');
vi.mock('../src/repositories/googleCalendarSyncRepository.js', () => syncRepo);
vi.mock('../src/repositories/webUserIntegrationRepository.js', () => integrationRepo);
vi.mock('../src/services/calendarAvailabilityService.js', () => availability);
vi.mock('../src/services/microsoftOAuthService.js', () => microsoftOAuth);
vi.mock('../src/config/env.js', () => ({ env: { GOOGLE_OAUTH_WRITE_SCOPE: 'https://www.googleapis.com/auth/calendar.events' } }));

const { processGoogleCalendarSyncItem, deleteGoogleEventsBeforeDeletion } = await import('../src/services/googleCalendarEventService.js');
const { buildMicrosoftEventBody, buildMicrosoftTransactionId } = await import('../src/services/calendarSync/microsoftAdapter.js');
const { parseRetryAfterMs } = await import('../src/services/calendarSync/types.js');

const item = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  account_id: 5,
  appointment_id: 9,
  action: 'upsert',
  status: 'processing',
  provider: 'microsoft',
  google_event_id: null,
  external_event_id: null,
  web_user_id: null,
  attempts: 0,
  next_attempt_at: new Date(),
  locked_until: null,
  last_error_status: null,
  ...overrides,
}) as never;

const appointment = (overrides: Record<string, unknown> = {}) => ({
  id: 9,
  account_id: 5,
  specialist_id: 2,
  appointment_at: new Date('2026-11-01T10:00:00.000Z'),
  duration_min: 50,
  status: 'new',
  meeting_link: 'https://zoom.example/j/1',
  meeting_provider: 'zoom',
  location_address: null,
  google_event_id: 'g-existing',
  google_event_web_user_id: 77,
  microsoft_event_id: null,
  microsoft_event_web_user_id: null,
  specialist_timezone: 'Europe/Berlin',
  specialist_user_id: 77,
  service_name_en: 'Therapy',
  service_name_ru: 'Therapy RU',
  business_address: null,
  // Must never leak into the event (defensive: not selected in reality).
  client_first_name: 'Secret',
  client_phone: '+100',
  client_email: 'a@b.c',
  comment: 'private note',
  ...overrides,
});

const integration = (overrides: Record<string, unknown> = {}) => ({
  microsoft_access_token: 'access',
  microsoft_refresh_token: 'refresh',
  microsoft_token_expires_at: new Date(Date.now() + 3600_000),
  microsoft_granted_scopes: 'Calendars.ReadWrite User.Read',
  ...overrides,
});

describe('microsoft calendar adapter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    microsoftOAuth.resolveUsableMicrosoftAccessToken.mockResolvedValue({ ok: true, accessToken: 'access' });
    integrationRepo.findWebUserIntegrationByWebUserId.mockResolvedValue(integration());
    vi.mocked(axios.isAxiosError).mockReturnValue(false);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('creates an event via Graph with a minimised UTC body and never touches Google', async () => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(appointment());
    vi.mocked(axios.request).mockResolvedValue({ status: 201, data: { id: 'AAMk-1' } });

    const outcome = await processGoogleCalendarSyncItem(item());

    expect(outcome).toEqual({ kind: 'done', detail: 'synced', event: 'created' });
    const request = vi.mocked(axios.request).mock.calls[0][0];
    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://graph.microsoft.com/v1.0/me/events');
    expect(request.headers).toMatchObject({ Authorization: 'Bearer access' });
    expect(request.data).toMatchObject({
      subject: 'Therapy',
      start: { dateTime: '2026-11-01T10:00:00', timeZone: 'UTC' },
      end: { dateTime: '2026-11-01T10:50:00', timeZone: 'UTC' },
      body: { contentType: 'text', content: 'https://zoom.example/j/1' },
      transactionId: buildMicrosoftTransactionId(5, 9),
      singleValueExtendedProperties: [{ value: '9' }],
    });
    const serialized = JSON.stringify(request.data);
    for (const secret of ['Secret', '+100', 'a@b.c', 'private note', 'attendees']) {
      expect(serialized).not.toContain(secret);
    }
    expect(syncRepo.setAppointmentMicrosoftEvent).toHaveBeenCalledWith({
      accountId: 5, appointmentId: 9, microsoftEventId: 'AAMk-1', webUserId: 77,
    });
    expect(syncRepo.setAppointmentGoogleEvent).not.toHaveBeenCalled();
  });

  it('PATCHes an existing event and recreates it with a fresh transaction id on 404', async () => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(
      appointment({ microsoft_event_id: 'old', microsoft_event_web_user_id: 77 }),
    );
    vi.mocked(axios.request)
      .mockResolvedValueOnce({ status: 404, data: {} })
      .mockResolvedValueOnce({ status: 201, data: { id: 'new' } });

    const outcome = await processGoogleCalendarSyncItem(item());

    expect(outcome).toEqual({ kind: 'done', detail: 'synced', event: 'created' });
    const calls = vi.mocked(axios.request).mock.calls.map((call) => call[0]);
    expect(calls[0]).toMatchObject({ method: 'PATCH', url: 'https://graph.microsoft.com/v1.0/me/events/old' });
    expect(calls[1].method).toBe('POST');
    const transactionId = (calls[1].data as { transactionId: string }).transactionId;
    expect(transactionId).toBe(buildMicrosoftTransactionId(5, 9, 'old'));
    expect(transactionId).not.toBe(buildMicrosoftTransactionId(5, 9));
    expect(syncRepo.setAppointmentMicrosoftEvent).toHaveBeenCalledWith(expect.objectContaining({ microsoftEventId: 'new' }));
  });

  it('clears location and link on update when they were removed', () => {
    const body = buildMicrosoftEventBody(appointment({ meeting_link: null }) as never, true);
    expect(body.location).toEqual({ displayName: '' });
    expect(body.body).toEqual({ contentType: 'text', content: '' });
    expect(buildMicrosoftEventBody(appointment({ meeting_link: null }) as never)).not.toHaveProperty('body');
  });

  it('treats DELETE 404 as success and clears the stored reference', async () => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(
      appointment({ status: 'cancelled', microsoft_event_id: 'evt', microsoft_event_web_user_id: 77 }),
    );
    vi.mocked(axios.request).mockResolvedValue({ status: 404, data: {} });

    const outcome = await processGoogleCalendarSyncItem(item({ action: 'delete' }));

    expect(outcome).toEqual({ kind: 'done', detail: 'synced', event: 'deleted' });
    expect(vi.mocked(axios.request).mock.calls[0][0]).toMatchObject({ method: 'DELETE', url: 'https://graph.microsoft.com/v1.0/me/events/evt' });
    expect(syncRepo.setAppointmentMicrosoftEvent).toHaveBeenCalledWith({
      accountId: 5, appointmentId: 9, microsoftEventId: null, webUserId: null,
    });
  });

  it('deletes through the queue snapshot when the appointment row is gone', async () => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(null);
    vi.mocked(axios.request).mockResolvedValue({ status: 204, data: undefined });

    const outcome = await processGoogleCalendarSyncItem(item({ action: 'delete', external_event_id: 'snap', web_user_id: 12 }));

    expect(outcome).toEqual({ kind: 'done', detail: 'synced', event: 'deleted' });
    expect(vi.mocked(axios.request).mock.calls[0][0].url).toContain('/snap');
    expect(syncRepo.setAppointmentMicrosoftEvent).not.toHaveBeenCalled();
  });

  it('refreshes once on 401 and retries', async () => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(appointment());
    microsoftOAuth.resolveUsableMicrosoftAccessToken
      .mockResolvedValueOnce({ ok: true, accessToken: 'stale' })
      .mockResolvedValueOnce({ ok: true, accessToken: 'fresh' });
    vi.mocked(axios.request)
      .mockResolvedValueOnce({ status: 401, data: {} })
      .mockResolvedValueOnce({ status: 201, data: { id: 'e' } });

    const outcome = await processGoogleCalendarSyncItem(item());

    expect(outcome).toMatchObject({ kind: 'done', event: 'created' });
    expect(microsoftOAuth.resolveUsableMicrosoftAccessToken.mock.calls[1][0]).toMatchObject({ forceRefresh: true });
    expect(vi.mocked(axios.request).mock.calls[1][0].headers).toMatchObject({ Authorization: 'Bearer fresh' });
  });

  it('uses Retry-After as a backoff floor on 429/503', async () => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(appointment());
    vi.mocked(axios.request).mockResolvedValue({ status: 429, data: {}, headers: { 'retry-after': '120' } });
    expect(await processGoogleCalendarSyncItem(item())).toEqual({
      kind: 'error', errorStatus: '429', retryable: true, retryAfterMs: 120_000,
    });

    vi.mocked(axios.request).mockResolvedValue({ status: 503, data: {}, headers: {} });
    expect(await processGoogleCalendarSyncItem(item())).toEqual({ kind: 'error', errorStatus: '503', retryable: true });
  });

  it('parses Retry-After seconds and dates and caps the value', () => {
    expect(parseRetryAfterMs('30')).toBe(30_000);
    expect(parseRetryAfterMs('Wed, 21 Oct 2026 07:28:30 GMT', Date.parse('Wed, 21 Oct 2026 07:28:00 GMT'))).toBe(30_000);
    expect(parseRetryAfterMs('999999')).toBe(3_600_000);
    expect(parseRetryAfterMs('abc')).toBeUndefined();
  });

  it('does not retry 403 access denied or invalid_grant', async () => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(appointment());
    vi.mocked(axios.request).mockResolvedValue({ status: 403, data: {} });
    expect(await processGoogleCalendarSyncItem(item())).toEqual({ kind: 'error', errorStatus: '403', retryable: false });

    microsoftOAuth.resolveUsableMicrosoftAccessToken.mockResolvedValue({ ok: false, reason: 'invalid_grant' });
    expect(await processGoogleCalendarSyncItem(item())).toEqual({ kind: 'error', errorStatus: 'invalid_grant', retryable: false });
  });

  it('skips without calling Graph when the write scope or token is missing', async () => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(appointment());
    integrationRepo.findWebUserIntegrationByWebUserId.mockResolvedValue(integration({ microsoft_granted_scopes: 'User.Read' }));
    expect(await processGoogleCalendarSyncItem(item())).toEqual({ kind: 'done', detail: 'skipped', reason: 'write_scope_missing' });

    integrationRepo.findWebUserIntegrationByWebUserId.mockResolvedValue(
      integration({ microsoft_access_token: null, microsoft_refresh_token: null }),
    );
    expect(await processGoogleCalendarSyncItem(item())).toEqual({ kind: 'done', detail: 'skipped', reason: 'no_access_token' });
    expect(axios.request).not.toHaveBeenCalled();
  });

  it('removes the event from the previous owner when the specialist changed', async () => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(
      appointment({ microsoft_event_id: 'old', microsoft_event_web_user_id: 50 }),
    );
    vi.mocked(axios.request)
      .mockResolvedValueOnce({ status: 204, data: undefined })
      .mockResolvedValueOnce({ status: 201, data: { id: 'moved' } });

    await processGoogleCalendarSyncItem(item());

    const calls = vi.mocked(axios.request).mock.calls.map((call) => call[0].method);
    expect(calls).toEqual(['DELETE', 'POST']);
    expect(integrationRepo.findWebUserIntegrationByWebUserId).toHaveBeenNthCalledWith(1, 5, 50);
    expect(integrationRepo.findWebUserIntegrationByWebUserId).toHaveBeenNthCalledWith(2, 5, 77);
  });

  it('defaults rows without a provider to Google', async () => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(appointment({ google_event_id: null }));
    integrationRepo.findWebUserIntegrationByWebUserId.mockResolvedValue({
      google_api_key: 'access',
      google_refresh_token: 'r',
      google_token_expires_at: new Date(Date.now() + 3600_000),
      google_granted_scopes: 'https://www.googleapis.com/auth/calendar.events',
    });
    availability.resolveUsableGoogleAccessToken.mockResolvedValue({ ok: true, accessToken: 'access' });
    vi.mocked(axios.request).mockResolvedValue({ status: 200, data: { id: 'gid' } });

    await processGoogleCalendarSyncItem(item({ provider: undefined }));

    expect(vi.mocked(axios.request).mock.calls[0][0].url).toContain('googleapis.com');
    expect(syncRepo.setAppointmentGoogleEvent).toHaveBeenCalled();
    expect(syncRepo.setAppointmentMicrosoftEvent).not.toHaveBeenCalled();
  });

  it('deletion cleanup also removes Microsoft events and never throws', async () => {
    syncRepo.listAppointmentsWithGoogleEvents.mockResolvedValue([]);
    syncRepo.listAppointmentsWithMicrosoftEvents.mockResolvedValue([
      { id: 9, account_id: 5, microsoft_event_id: 'evt', microsoft_event_web_user_id: 77 },
    ]);
    vi.mocked(axios.request).mockResolvedValue({ status: 204, data: undefined });

    await deleteGoogleEventsBeforeDeletion({ accountId: 5 });
    expect(vi.mocked(axios.request).mock.calls[0][0]).toMatchObject({ method: 'DELETE', url: expect.stringContaining('/evt') });

    syncRepo.listAppointmentsWithMicrosoftEvents.mockRejectedValue(new Error('db down'));
    await expect(deleteGoogleEventsBeforeDeletion({ accountId: 5 })).resolves.toBeUndefined();
  });
});
