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
    vi.mocked(axios.get).mockReset();
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
    vi.mocked(axios.get).mockResolvedValue({ data: { items: [] } });

    const result = await listExternalBusySlots({
      accountId: 1,
      specialistIds: [1, 2],
      from: new Date(),
      to: new Date(Date.now() + 60 * 60 * 1000),
    });

    expect(result).toEqual([]);
    expect(googleOAuthService.refreshGoogleAccessToken).not.toHaveBeenCalled();
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('skips a specialist whose refresh fails (revoked access), without failing other specialists', async () => {
    specialistRepository.findSpecialistsCalendarCredentials.mockResolvedValue([
      { ...baseCredential, googleTokenExpiresAt: new Date(0) },
      { ...baseCredential, specialistId: 2, webUserId: 11 },
    ]);
    googleOAuthService.refreshGoogleAccessToken.mockResolvedValue(null);
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        items: [
          {
            status: 'confirmed',
            summary: 'Busy',
            start: { dateTime: '2026-01-01T10:00:00Z' },
            end: { dateTime: '2026-01-01T10:30:00Z' },
          },
        ],
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
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('skips a specialist whose calendar API call fails, without throwing for the whole batch', async () => {
    specialistRepository.findSpecialistsCalendarCredentials.mockResolvedValue([
      { ...baseCredential },
      { ...baseCredential, specialistId: 2, webUserId: 11 },
    ]);
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.get)
      .mockRejectedValueOnce({ response: { data: { error: { message: 'invalid_grant' } } }, message: 'Request failed' })
      .mockResolvedValueOnce({ data: { items: [] } });

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
    vi.mocked(axios.get).mockResolvedValue({ data: { items: [] } });

    await listExternalBusySlots({
      accountId: 1,
      specialistIds: [1],
      from: new Date(),
      to: new Date(Date.now() + 60 * 60 * 1000),
    });

    expect(googleOAuthService.refreshGoogleAccessToken).not.toHaveBeenCalled();
    expect(axios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: { Authorization: 'Bearer valid-token' } }),
    );
  });
});
