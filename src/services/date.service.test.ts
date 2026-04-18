import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/app-settings.repository', () => {
  return {
    getAppSettings: vi.fn(),
  };
});

import { getAppSettings } from '../repositories/app-settings.repository';
import { getNextAvailableDates } from './date.service';

describe('getNextAvailableDates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Local time: Saturday, 2026-04-18
    vi.setSystemTime(new Date(2026, 3, 18, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('returns next working days based on settings.workDays', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({
      workDays: '1,2,3,4,5', // Mon-Fri
    } as any);

    const dates = await getNextAvailableDates(3);
    expect(dates).toEqual(['2026-04-20', '2026-04-21', '2026-04-22']);
  });

  it('includes today when it is a working day', async () => {
    // Monday, 2026-04-20
    vi.setSystemTime(new Date(2026, 3, 20, 10, 0, 0));
    vi.mocked(getAppSettings).mockResolvedValue({
      workDays: '1,2,3,4,5',
    } as any);

    const dates = await getNextAvailableDates(1);
    expect(dates).toEqual(['2026-04-20']);
  });

  it('ignores invalid workDays tokens and returns empty when none are valid', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({
      workDays: 'x, 7, -1, 99, ',
    } as any);

    const dates = await getNextAvailableDates(3);
    expect(dates).toEqual([]);
  });

  it('caps search window (21 days) and may return less than requested', async () => {
    // Only Sundays allowed; starting Saturday 2026-04-18 => Sundays in next 21 days:
    // 2026-04-19, 2026-04-26, 2026-05-03
    vi.mocked(getAppSettings).mockResolvedValue({
      workDays: '0',
    } as any);

    const dates = await getNextAvailableDates(10);
    expect(dates).toEqual(['2026-04-19', '2026-04-26', '2026-05-03']);
  });
});
