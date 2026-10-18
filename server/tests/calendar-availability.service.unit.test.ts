import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';

const specialistRepository = vi.hoisted(() => ({ findSpecialistsCalendarCredentials: vi.fn() }));
const googleOAuthService = vi.hoisted(() => ({ refreshGoogleAccessToken: vi.fn() }));

vi.mock('../src/repositories/specialistRepository.js', () => specialistRepository);
vi.mock('../src/services/googleOAuthService.js', () => googleOAuthService);
vi.mock('axios');

const { listExternalBusySlots } = await import('../src/services/calendarAvailabilityService.js');

const baseCredential = {
  specialistId: 1,
  webUserId: 10,
  googleApiKey: 'valid-token',
  googleRefreshToken: 'refresh-token',
  googleTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
  googleCalendarId: 'primary',
};

describe('calendarAvailabilityService', () => {
  beforeEach(() => {
    specialistRepository.findSpecialistsCalendarCredentials.mockReset();
    googleOAuthService.refreshGoogleAccessToken.mockReset();
    vi.mocked(axios.post).mockReset();
    vi.mocked(axios.isAxiosError).mockReset().mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('skips a specialist whose expired token has no refresh token, without failing the whole batch', async () => {
    specialistRepository.findSpecialistsCalendarCredentials.mockResolvedValue([
      { ...baseCredential, googleTokenExpiresAt: new Date(0), googleRefreshToken: null },
      { ...baseCredential, specialistId: 2, webUserId: 11 },
    ]);
    vi.mocked(axios.post).mockResolvedValue({ data: { calendars: { primary: { busy: [] } } } });

    const result = await listExternalBusySlots({
      accountId: 1,
      specialistIds: [1, 2],
      from: new Date(),
      to: new Date(Date.now() + 60 * 60 * 1000),
    });

    expect(result).toEqual([]);
    expect(googleOAuthService.refreshGoogleAccessToken).not.toHaveBeenCalled();
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('skips a specialist whose refresh fails (revoked access), without failing other specialists', async () => {
    specialistRepository.findSpecialistsCalendarCredentials.mockResolvedValue([
      { ...baseCredential, googleTokenExpiresAt: new Date(0) },
      { ...baseCredential, specialistId: 2, webUserId: 11 },
    ]);
    googleOAuthService.refreshGoogleAccessToken.mockResolvedValue(null);
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        calendars: { primary: { busy: [{ start: '2026-01-01T10:00:00Z', end: '2026-01-01T10:30:00Z' }] } },
      },
    });

    const result = await listExternalBusySlots({
      accountId: 1,
      specialistIds: [1, 2],
      from: new Date(),
      to: new Date(Date.now() + 60 * 60 * 1000),
    });

    expect(result).toHaveLength(1);
    expect(result[0].specialistId).toBe(2);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('skips a specialist whose calendar API call fails, without throwing for the whole batch', async () => {
    specialistRepository.findSpecialistsCalendarCredentials.mockResolvedValue([
      { ...baseCredential },
      { ...baseCredential, specialistId: 2, webUserId: 11 },
    ]);
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.post)
      .mockRejectedValueOnce({ response: { data: { error: { message: 'invalid_grant' } } }, message: 'Request failed' })
      .mockResolvedValueOnce({ data: { calendars: { primary: { busy: [] } } } });

    const result = await listExternalBusySlots({
      accountId: 1,
      specialistIds: [1, 2],
      from: new Date(),
      to: new Date(Date.now() + 60 * 60 * 1000),
    });

    expect(result).toEqual([]);
  });

  it('reuses the cached token without refreshing when it is not close to expiry', async () => {
    specialistRepository.findSpecialistsCalendarCredentials.mockResolvedValue([{ ...baseCredential }]);
    vi.mocked(axios.post).mockResolvedValue({ data: { calendars: { primary: { busy: [] } } } });

    await listExternalBusySlots({
      accountId: 1,
      specialistIds: [1],
      from: new Date(),
      to: new Date(Date.now() + 60 * 60 * 1000),
    });

    expect(googleOAuthService.refreshGoogleAccessToken).not.toHaveBeenCalled();
    expect(axios.post).toHaveBeenCalledWith(
      'https://www.googleapis.com/calendar/v3/freeBusy',
      expect.anything(),
      expect.objectContaining({ headers: { Authorization: 'Bearer valid-token' } }),
    );
  });

  it('queries freeBusy for the primary calendar only and maps busy intervals without event details', async () => {
    specialistRepository.findSpecialistsCalendarCredentials.mockResolvedValue([{ ...baseCredential, googleCalendarId: 'other@example.com' }]);
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        calendars: {
          primary: {
            busy: [
              { start: '2026-01-01T10:00:00Z', end: '2026-01-01T11:30:00Z' },
              { start: '2026-01-01T12:00:00Z', end: '2026-01-01T12:00:00Z' },
            ],
          },
        },
      },
    });
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-01-02T00:00:00Z');

    const result = await listExternalBusySlots({ accountId: 1, specialistIds: [1], from, to });

    expect(axios.post).toHaveBeenCalledWith(
      'https://www.googleapis.com/calendar/v3/freeBusy',
      { timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: 'primary' }] },
      expect.anything(),
    );
    expect(result).toEqual([
      { specialistId: 1, scheduledAt: '2026-01-01T10:00:00.000Z', durationMin: 90, source: 'google' },
    ]);
  });

  it('skips a specialist when freeBusy reports calendar errors', async () => {
    specialistRepository.findSpecialistsCalendarCredentials.mockResolvedValue([{ ...baseCredential }]);
    vi.mocked(axios.post).mockResolvedValue({
      data: { calendars: { primary: { busy: [], errors: [{ domain: 'global', reason: 'notFound' }] } } },
    });

    const result = await listExternalBusySlots({ accountId: 1, specialistIds: [1], from: new Date(), to: new Date(Date.now() + 3600_000) });

    expect(result).toEqual([]);
  });

  it('uses the single calendars entry when Google does not key it as primary', async () => {
    specialistRepository.findSpecialistsCalendarCredentials.mockResolvedValue([{ ...baseCredential }]);
    vi.mocked(axios.post).mockResolvedValue({
      data: { calendars: { 'owner@example.com': { busy: [{ start: '2026-01-01T10:00:00Z', end: '2026-01-01T11:00:00Z' }] } } },
    });

    const result = await listExternalBusySlots({ accountId: 1, specialistIds: [1], from: new Date(), to: new Date(Date.now() + 3600_000) });

    expect(result).toEqual([
      { specialistId: 1, scheduledAt: '2026-01-01T10:00:00.000Z', durationMin: 60, source: 'google' },
    ]);
  });

  it.each([[{}], [undefined], [{ a: { busy: [] }, b: { busy: [] } }]])(
    'warns and skips the specialist when calendars has no usable entry (%j)',
    async (calendars) => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      specialistRepository.findSpecialistsCalendarCredentials.mockResolvedValue([{ ...baseCredential }]);
      vi.mocked(axios.post).mockResolvedValue({ data: { calendars } });

      const result = await listExternalBusySlots({ accountId: 1, specialistIds: [1], from: new Date(), to: new Date(Date.now() + 3600_000) });

      expect(result).toEqual([]);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('no usable calendar entry'));
    },
  );
});
