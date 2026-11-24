import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';

const specialistRepository = vi.hoisted(() => ({ findSpecialistsCalendarCredentials: vi.fn() }));
const googleOAuthService = vi.hoisted(() => ({ refreshGoogleAccessToken: vi.fn() }));
const microsoftOAuth = vi.hoisted(() => ({ resolveUsableMicrosoftAccessToken: vi.fn() }));

vi.mock('../src/repositories/specialistRepository.js', () => specialistRepository);
vi.mock('../src/services/googleOAuthService.js', () => googleOAuthService);
vi.mock('../src/services/microsoftOAuthService.js', () => microsoftOAuth);
vi.mock('axios');

const { listExternalBusySlots } = await import('../src/services/calendarAvailabilityService.js');

const microsoftOnly = (overrides: Record<string, unknown> = {}) => ({
  specialistId: 1,
  webUserId: 10,
  googleApiKey: null,
  googleRefreshToken: null,
  googleTokenExpiresAt: null,
  microsoft: { accessToken: 'ms-token', refreshToken: 'ms-refresh', tokenExpiresAt: new Date(Date.now() + 3600_000) },
  timezone: 'Europe/Kyiv',
  ...overrides,
});

const range = { from: new Date('2026-01-01T00:00:00Z'), to: new Date('2026-01-02T00:00:00Z') };
const event = (overrides: Record<string, unknown> = {}) => ({
  subject: 'Dentist',
  showAs: 'busy',
  isAllDay: false,
  isCancelled: false,
  start: { dateTime: '2026-01-01T10:00:00.0000000', timeZone: 'UTC' },
  end: { dateTime: '2026-01-01T11:00:00.0000000', timeZone: 'UTC' },
  ...overrides,
});

describe('calendarAvailabilityService (microsoft)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(axios.isAxiosError).mockReturnValue(false);
    microsoftOAuth.resolveUsableMicrosoftAccessToken.mockResolvedValue({ ok: true, accessToken: 'ms-token' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('blocks busy/oof/tentative and ignores free, workingElsewhere, cancelled, declined and our own events', async () => {
    specialistRepository.findSpecialistsCalendarCredentials.mockResolvedValue([microsoftOnly()]);
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        value: [
          event({ showAs: 'busy' }),
          event({ showAs: 'oof', start: { dateTime: '2026-01-01T12:00:00.0000000' }, end: { dateTime: '2026-01-01T12:30:00.0000000' } }),
          event({ showAs: 'tentative', start: { dateTime: '2026-01-01T13:00:00.0000000' }, end: { dateTime: '2026-01-01T13:15:00.0000000' } }),
          event({ showAs: 'free' }),
          event({ showAs: 'workingElsewhere' }),
          event({ isCancelled: true }),
          event({ responseStatus: { response: 'declined' } }),
          event({ singleValueExtendedProperties: [{ id: 'String {6C1D4F0E-8A52-4B7D-9E3A-5F21C7B84D10} Name appointmentId' }] }),
        ],
      },
    });

    const result = await listExternalBusySlots({ accountId: 1, specialistIds: [1], ...range });

    expect(result).toEqual([
      { specialistId: 1, scheduledAt: '2026-01-01T10:00:00.000Z', durationMin: 60, source: 'microsoft' },
      { specialistId: 1, scheduledAt: '2026-01-01T12:00:00.000Z', durationMin: 30, source: 'microsoft' },
      { specialistId: 1, scheduledAt: '2026-01-01T13:00:00.000Z', durationMin: 15, source: 'microsoft' },
    ]);
    const [url, config] = vi.mocked(axios.get).mock.calls[0];
    expect(String(url)).toContain('https://graph.microsoft.com/v1.0/me/calendarView?');
    expect(config?.headers).toMatchObject({ Prefer: 'outlook.timezone="UTC"', Authorization: 'Bearer ms-token' });
  });

  it('shows titles only to the owner and does not even request them for others', async () => {
    specialistRepository.findSpecialistsCalendarCredentials.mockResolvedValue([microsoftOnly()]);
    vi.mocked(axios.get).mockResolvedValue({ data: { value: [event()] } });

    const owner = await listExternalBusySlots({ accountId: 1, specialistIds: [1], ...range, ownerWebUserId: 10 });
    expect(owner[0]).toMatchObject({ title: 'Dentist' });
    expect(decodeURIComponent(String(vi.mocked(axios.get).mock.calls[0][0]))).toContain('subject');

    const other = await listExternalBusySlots({ accountId: 1, specialistIds: [1], ...range, ownerWebUserId: 99 });
    expect(other[0]).not.toHaveProperty('title');
    expect(decodeURIComponent(String(vi.mocked(axios.get).mock.calls[1][0]))).not.toContain('subject');
  });

  it('resolves all-day events in the specialist time zone', async () => {
    specialistRepository.findSpecialistsCalendarCredentials.mockResolvedValue([microsoftOnly()]);
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        value: [event({
          isAllDay: true,
          start: { dateTime: '2026-01-01T00:00:00.0000000' },
          end: { dateTime: '2026-01-02T00:00:00.0000000' },
        })],
      },
    });

    const result = await listExternalBusySlots({ accountId: 1, specialistIds: [1], ...range });

    // Europe/Kyiv is UTC+2 in January: local midnight is 22:00Z of the previous day.
    expect(result).toEqual([{ specialistId: 1, scheduledAt: '2025-12-31T22:00:00.000Z', durationMin: 1440, source: 'microsoft' }]);
  });

  it('follows nextLink only on graph.microsoft.com and stops at the page cap', async () => {
    specialistRepository.findSpecialistsCalendarCredentials.mockResolvedValue([microsoftOnly()]);
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: { value: [event()], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/calendarView?$skiptoken=1' } })
      .mockResolvedValueOnce({ data: { value: [event()], '@odata.nextLink': 'https://evil.example/steal' } });

    const result = await listExternalBusySlots({ accountId: 1, specialistIds: [1], ...range });

    expect(result).toHaveLength(2);
    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(vi.mocked(axios.get).mock.calls[1][0]).toContain('$skiptoken=1');
  });

  it('a failing Microsoft call does not drop Google slots (and vice versa)', async () => {
    specialistRepository.findSpecialistsCalendarCredentials.mockResolvedValue([
      microsoftOnly({
        googleApiKey: 'g-token',
        googleRefreshToken: 'g-refresh',
        googleTokenExpiresAt: new Date(Date.now() + 3600_000),
      }),
    ]);
    vi.mocked(axios.get).mockRejectedValue(new Error('graph down'));
    vi.mocked(axios.post).mockResolvedValue({
      data: { calendars: { primary: { busy: [{ start: '2026-01-01T09:00:00Z', end: '2026-01-01T09:30:00Z' }] } } },
    });

    const result = await listExternalBusySlots({ accountId: 1, specialistIds: [1], ...range });

    expect(result).toEqual([{ specialistId: 1, scheduledAt: '2026-01-01T09:00:00.000Z', durationMin: 30, source: 'google' }]);

    // Reverse: Google fails, Microsoft still contributes.
    vi.mocked(axios.get).mockResolvedValue({ data: { value: [event()] } });
    vi.mocked(axios.post).mockRejectedValue(new Error('google down'));
    const reverse = await listExternalBusySlots({ accountId: 1, specialistIds: [1], ...range });
    expect(reverse.map((slot) => slot.source)).toEqual(['microsoft']);
  });

  it('retries once with a forced refresh on 401 and skips the calendar when the token is unusable', async () => {
    specialistRepository.findSpecialistsCalendarCredentials.mockResolvedValue([microsoftOnly()]);
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.get)
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockResolvedValueOnce({ data: { value: [event()] } });
    microsoftOAuth.resolveUsableMicrosoftAccessToken
      .mockResolvedValueOnce({ ok: true, accessToken: 'stale' })
      .mockResolvedValueOnce({ ok: true, accessToken: 'fresh' });

    const result = await listExternalBusySlots({ accountId: 1, specialistIds: [1], ...range });
    expect(result).toHaveLength(1);
    expect(microsoftOAuth.resolveUsableMicrosoftAccessToken.mock.calls[1][0]).toMatchObject({ forceRefresh: true });

    microsoftOAuth.resolveUsableMicrosoftAccessToken.mockReset().mockResolvedValue({ ok: false, reason: 'invalid_grant' });
    expect(await listExternalBusySlots({ accountId: 1, specialistIds: [1], ...range })).toEqual([]);
  });
});
