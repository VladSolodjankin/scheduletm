import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';

const syncRepo = vi.hoisted(() => ({
  findGoogleCalendarSyncAppointment: vi.fn(),
  setAppointmentGoogleEvent: vi.fn(),
  listAppointmentsWithGoogleEvents: vi.fn(),
}));
const integrationRepo = vi.hoisted(() => ({ findWebUserIntegrationByWebUserId: vi.fn() }));
const availability = vi.hoisted(() => ({ resolveUsableGoogleAccessToken: vi.fn() }));

vi.mock('axios');
vi.mock('../src/repositories/googleCalendarSyncRepository.js', () => syncRepo);
vi.mock('../src/repositories/webUserIntegrationRepository.js', () => integrationRepo);
vi.mock('../src/services/calendarAvailabilityService.js', () => availability);
vi.mock('../src/config/env.js', () => ({ env: { GOOGLE_OAUTH_WRITE_SCOPE: 'https://www.googleapis.com/auth/calendar.events' } }));

const {
  buildGoogleEventBody,
  buildGoogleEventId,
  computeGoogleSyncBackoffMs,
  deleteGoogleEventsBeforeDeletion,
  processGoogleCalendarSyncItem,
} = await import('../src/services/googleCalendarEventService.js');

const item = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  account_id: 5,
  appointment_id: 9,
  action: 'upsert',
  status: 'processing',
  google_event_id: null,
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
  google_event_id: null,
  google_event_web_user_id: null,
  specialist_timezone: 'Europe/Berlin',
  specialist_user_id: 77,
  service_name_en: 'Therapy',
  service_name_ru: 'Therapy RU',
  business_address: null,
  // Fields that must never leak into the event (defensive: they are not selected in reality).
  client_first_name: 'Secret',
  client_phone: '+100',
  client_email: 'a@b.c',
  comment: 'private note',
  ...overrides,
});

const integration = (overrides: Record<string, unknown> = {}) => ({
  google_api_key: 'access',
  google_refresh_token: 'refresh',
  google_token_expires_at: new Date(Date.now() + 3600_000),
  google_granted_scopes: 'https://www.googleapis.com/auth/calendar.events',
  ...overrides,
});

describe('googleCalendarEventService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    availability.resolveUsableGoogleAccessToken.mockResolvedValue({ ok: true, accessToken: 'access' });
    integrationRepo.findWebUserIntegrationByWebUserId.mockResolvedValue(integration());
    vi.mocked(axios.isAxiosError).mockReturnValue(false);
  });

  it('creates an event, stores its id and uses sendUpdates=none with a minimised body', async () => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(appointment());
    vi.mocked(axios.request).mockResolvedValue({ status: 200, data: { id: 'evt1' } });

    const outcome = await processGoogleCalendarSyncItem(item());

    expect(outcome).toEqual({ kind: 'done', detail: 'synced' });
    const request = vi.mocked(axios.request).mock.calls[0][0];
    expect(request.method).toBe('POST');
    expect(request.params).toEqual({ sendUpdates: 'none' });
    expect(request.headers).toEqual({ Authorization: 'Bearer access' });
    expect(request.data).toMatchObject({
      summary: 'Therapy',
      start: { dateTime: '2026-11-01T10:00:00.000Z', timeZone: 'Europe/Berlin' },
      end: { dateTime: '2026-11-01T10:50:00.000Z', timeZone: 'Europe/Berlin' },
      description: 'https://zoom.example/j/1',
      extendedProperties: { private: { appointmentId: '9' } },
    });
    const serialized = JSON.stringify(request.data);
    for (const secret of ['Secret', '+100', 'a@b.c', 'private note', 'attendees']) {
      expect(serialized).not.toContain(secret);
    }
    expect(syncRepo.setAppointmentGoogleEvent).toHaveBeenCalledWith({
      accountId: 5, appointmentId: 9, googleEventId: 'evt1', webUserId: 77,
    });
  });

  it('PATCHes an existing event and recreates it if Google no longer has it', async () => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(
      appointment({ google_event_id: 'evt1', google_event_web_user_id: 77 }),
    );
    vi.mocked(axios.request)
      .mockResolvedValueOnce({ status: 200, data: {} })
      .mockResolvedValueOnce({ status: 404, data: {} })
      .mockResolvedValueOnce({ status: 200, data: { id: 'evt2' } });

    expect(await processGoogleCalendarSyncItem(item())).toEqual({ kind: 'done', detail: 'synced' });
    expect(vi.mocked(axios.request).mock.calls[0][0]).toMatchObject({ method: 'PATCH' });
    expect(String(vi.mocked(axios.request).mock.calls[0][0].url)).toMatch(/events\/evt1$/);

    expect(await processGoogleCalendarSyncItem(item())).toEqual({ kind: 'done', detail: 'synced' });
    expect(vi.mocked(axios.request).mock.calls[2][0]).toMatchObject({ method: 'POST' });
    expect(syncRepo.setAppointmentGoogleEvent).toHaveBeenLastCalledWith(expect.objectContaining({ googleEventId: 'evt2' }));
  });

  it('sends a deterministic Google-valid event id on insert', async () => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(appointment());
    vi.mocked(axios.request).mockResolvedValue({ status: 200, data: { id: 'ignored' } });

    await processGoogleCalendarSyncItem(item());

    const sent = vi.mocked(axios.request).mock.calls[0][0].data as { id: string };
    expect(sent.id).toBe(buildGoogleEventId(5, 9));
    expect(sent.id).toMatch(/^[0-9a-v]{5,1024}$/);
    expect(buildGoogleEventId(5, 9)).not.toBe(buildGoogleEventId(9, 5));
    expect(buildGoogleEventId(5, 9, 1)).not.toBe(buildGoogleEventId(5, 9));
  });

  it('on 409 PATCHes the already inserted event and stores its id', async () => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(appointment());
    vi.mocked(axios.request)
      .mockResolvedValueOnce({ status: 409, data: {} })
      .mockResolvedValueOnce({ status: 200, data: {} });

    expect(await processGoogleCalendarSyncItem(item())).toEqual({ kind: 'done', detail: 'synced' });

    const eventId = buildGoogleEventId(5, 9);
    expect(vi.mocked(axios.request).mock.calls[1][0]).toMatchObject({ method: 'PATCH' });
    expect(String(vi.mocked(axios.request).mock.calls[1][0].url)).toMatch(new RegExp(`events/${eventId}$`));
    expect(syncRepo.setAppointmentGoogleEvent).toHaveBeenCalledWith(expect.objectContaining({ googleEventId: eventId }));
  });

  it('a retry after a failed id write reuses the same id and creates no second event', async () => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(appointment());
    syncRepo.setAppointmentGoogleEvent.mockRejectedValueOnce(new Error('db down'));
    vi.mocked(axios.request)
      .mockResolvedValueOnce({ status: 200, data: { id: buildGoogleEventId(5, 9) } })
      .mockResolvedValueOnce({ status: 409, data: {} })
      .mockResolvedValueOnce({ status: 200, data: {} });

    expect(await processGoogleCalendarSyncItem(item())).toMatchObject({ kind: 'error', retryable: true });
    expect(await processGoogleCalendarSyncItem(item())).toEqual({ kind: 'done', detail: 'synced' });

    const calls = vi.mocked(axios.request).mock.calls.map(([config]) => config);
    expect((calls[0].data as { id: string }).id).toBe((calls[1].data as { id: string }).id);
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2);
    expect(calls[2]).toMatchObject({ method: 'PATCH' });
    expect(syncRepo.setAppointmentGoogleEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ googleEventId: buildGoogleEventId(5, 9) }),
    );
  });

  it('recreates after Google deleted the event with a new generation id', async () => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(
      appointment({ google_event_id: buildGoogleEventId(5, 9), google_event_web_user_id: 77 }),
    );
    vi.mocked(axios.request)
      .mockResolvedValueOnce({ status: 404, data: {} })
      .mockResolvedValueOnce({ status: 200, data: {} });

    await processGoogleCalendarSyncItem(item());

    const created = vi.mocked(axios.request).mock.calls[1][0].data as { id: string };
    expect(created.id).toBe(buildGoogleEventId(5, 9, 1));
  });

  it('logs when deletion cleanup is truncated at the cap', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    syncRepo.listAppointmentsWithGoogleEvents.mockResolvedValue(
      Array.from({ length: 501 }, (_, i) => ({ id: i, account_id: 5, google_event_id: 'e', google_event_web_user_id: 77 })),
    );
    vi.mocked(axios.request).mockResolvedValue({ status: 204, data: undefined });

    await deleteGoogleEventsBeforeDeletion({ accountId: 5 });

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('truncated to 500 of 501'));
    expect(vi.mocked(axios.request)).toHaveBeenCalledTimes(500);
  });

  it.each([204, 404, 410])('treats DELETE status %i as success and clears the reference', async (status) => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(
      appointment({ status: 'cancelled', google_event_id: 'evt1', google_event_web_user_id: 77 }),
    );
    vi.mocked(axios.request).mockResolvedValue({ status, data: undefined });

    expect(await processGoogleCalendarSyncItem(item({ action: 'delete' }))).toEqual({ kind: 'done', detail: 'synced' });
    expect(vi.mocked(axios.request).mock.calls[0][0]).toMatchObject({ method: 'DELETE' });
    expect(syncRepo.setAppointmentGoogleEvent).toHaveBeenCalledWith({
      accountId: 5, appointmentId: 9, googleEventId: null, webUserId: null,
    });
  });

  it('deletes via the queue snapshot when the appointment row is already gone', async () => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(null);
    vi.mocked(axios.request).mockResolvedValue({ status: 204, data: undefined });

    const outcome = await processGoogleCalendarSyncItem(item({ action: 'delete', google_event_id: 'evtX', web_user_id: 77 }));

    expect(outcome.kind).toBe('done');
    expect(String(vi.mocked(axios.request).mock.calls[0][0].url)).toMatch(/events\/evtX$/);
    expect(syncRepo.setAppointmentGoogleEvent).not.toHaveBeenCalled();
  });

  it('refreshes once on 401 and retries the request', async () => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(appointment());
    availability.resolveUsableGoogleAccessToken
      .mockResolvedValueOnce({ ok: true, accessToken: 'stale' })
      .mockResolvedValueOnce({ ok: true, accessToken: 'fresh' });
    vi.mocked(axios.request)
      .mockResolvedValueOnce({ status: 401, data: {} })
      .mockResolvedValueOnce({ status: 200, data: { id: 'evt1' } });

    expect(await processGoogleCalendarSyncItem(item())).toEqual({ kind: 'done', detail: 'synced' });
    expect(availability.resolveUsableGoogleAccessToken.mock.calls[1][0]).toMatchObject({ forceRefresh: true });
    expect(vi.mocked(axios.request).mock.calls[1][0].headers).toEqual({ Authorization: 'Bearer fresh' });
  });

  it.each([[500, true], [429, true], [403, true], [400, false]])('reports status %i as retryable=%s', async (status, retryable) => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(appointment());
    vi.mocked(axios.request).mockResolvedValue({ status, data: {} });

    expect(await processGoogleCalendarSyncItem(item())).toEqual({ kind: 'error', errorStatus: String(status), retryable });
  });

  it('skips without calling Google when the write scope is missing or no token is stored', async () => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(appointment());

    integrationRepo.findWebUserIntegrationByWebUserId.mockResolvedValue(integration({ google_api_key: null }));
    expect(await processGoogleCalendarSyncItem(item())).toEqual({ kind: 'done', detail: 'skipped' });

    integrationRepo.findWebUserIntegrationByWebUserId.mockResolvedValue(
      integration({ google_granted_scopes: 'https://www.googleapis.com/auth/calendar.freebusy' }),
    );
    expect(await processGoogleCalendarSyncItem(item())).toEqual({ kind: 'done', detail: 'skipped' });
    expect(axios.request).not.toHaveBeenCalled();
  });

  it('treats a cancelled appointment in an upsert row as a delete', async () => {
    syncRepo.findGoogleCalendarSyncAppointment.mockResolvedValue(
      appointment({ status: 'cancelled', google_event_id: 'evt1', google_event_web_user_id: 77 }),
    );
    vi.mocked(axios.request).mockResolvedValue({ status: 204, data: undefined });

    await processGoogleCalendarSyncItem(item());

    expect(vi.mocked(axios.request).mock.calls[0][0]).toMatchObject({ method: 'DELETE' });
  });

  it('falls back to Appointment, UTC and the business address for offline visits', () => {
    const body = buildGoogleEventBody(appointment({
      service_name_en: null,
      service_name_ru: null,
      specialist_timezone: 'Not/AZone',
      meeting_provider: 'offline',
      meeting_link: null,
      business_address: 'Main st 1',
    }) as never);

    expect(body.summary).toBe('Appointment');
    expect(body.start.timeZone).toBe('UTC');
    expect(body.location).toBe('Main st 1');
    expect(body).not.toHaveProperty('description');
  });

  it('backs off exponentially with a cap', () => {
    expect(computeGoogleSyncBackoffMs(1)).toBe(60_000);
    expect(computeGoogleSyncBackoffMs(3)).toBe(240_000);
    expect(computeGoogleSyncBackoffMs(20)).toBe(3_600_000);
  });

  it('deletion cleanup never throws, even when listing or Google fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    syncRepo.listAppointmentsWithGoogleEvents.mockResolvedValue([
      { id: 1, account_id: 5, google_event_id: 'e', google_event_web_user_id: 77 },
    ]);
    vi.mocked(axios.request).mockRejectedValue(new Error('boom'));
    await expect(deleteGoogleEventsBeforeDeletion({ accountId: 5 })).resolves.toBeUndefined();

    syncRepo.listAppointmentsWithGoogleEvents.mockRejectedValue(new Error('db down'));
    await expect(deleteGoogleEventsBeforeDeletion({ accountId: 5 })).resolves.toBeUndefined();
  });
});
