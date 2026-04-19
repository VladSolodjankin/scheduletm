import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../repositories/specialist.repository', () => ({
  findSpecialistById: vi.fn(),
}));

import axios from 'axios';
import { findSpecialistById } from '../../repositories/specialist.repository';
import { createGoogleCalendarEvents, getBusyIntervalsFromGoogleCalendar } from '../google-calendar.service';

describe('google-calendar.service', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns empty busy intervals when specialist has no Google settings', async () => {
    vi.mocked(findSpecialistById).mockResolvedValue({ id: 1 } as any);

    const out = await getBusyIntervalsFromGoogleCalendar({
      accountId: 7,
      specialistId: 1,
      date: '2026-04-18',
      timezone: 'Europe/Moscow',
    });

    expect(out).toEqual([]);
    expect(vi.mocked(axios.get)).not.toHaveBeenCalled();
  });

  it('maps Google events to busy intervals', async () => {
    vi.mocked(findSpecialistById).mockResolvedValue({
      id: 1,
      google_api_key: 'api-key',
      google_calendar_id: 'calendar-id',
    } as any);
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        items: [
          {
            status: 'confirmed',
            start: { dateTime: '2026-04-18T07:00:00.000Z' },
            end: { dateTime: '2026-04-18T08:30:00.000Z' },
          },
        ],
      },
    } as any);

    const out = await getBusyIntervalsFromGoogleCalendar({
      accountId: 7,
      specialistId: 1,
      date: '2026-04-18',
      timezone: 'Europe/Moscow',
    });

    expect(out).toEqual([{ date: '2026-04-18', time: '10:00', durationMin: 90 }]);
  });

  it('sends Google Calendar events for each appointment', async () => {
    vi.mocked(findSpecialistById).mockResolvedValue({
      id: 1,
      google_api_key: 'api-key',
      google_calendar_id: 'calendar-id',
    } as any);
    vi.mocked(axios.post).mockResolvedValue({ data: {} } as any);

    const out = await createGoogleCalendarEvents({
      accountId: 7,
      specialistId: 1,
      serviceName: 'Session',
      specialistName: 'Liliya',
      clientName: 'Ivan',
      appointments: [
        {
          id: 10,
          appointment_at: '2026-04-18T06:00:00.000Z',
          duration_min: 90,
        },
      ],
    });

    expect(out).toEqual({ sent: 1, skipped: 0 });
    expect(vi.mocked(axios.post)).toHaveBeenCalledTimes(1);
  });
});
