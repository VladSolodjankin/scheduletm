import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/appointment.repository', () => {
  return {
    findBusyAppointmentsByDate: vi.fn(),
  };
});

vi.mock('../../repositories/app-settings.repository', () => {
  return {
    getAppSettings: vi.fn(),
  };
});

vi.mock('../../repositories/specialist.repository', () => {
  return {
    findSpecialistScheduleSettings: vi.fn(),
  };
});

vi.mock('../../repositories/service.repository', () => {
  return {
    findServiceById: vi.fn(),
  };
});

vi.mock('../calendar-sync.service', () => {
  return {
    getBusyIntervalsFromExternalCalendars: vi.fn(),
  };
});

import { findBusyAppointmentsByDate } from '../../repositories/appointment.repository';
import { getAppSettings } from '../../repositories/app-settings.repository';
import { findServiceById } from '../../repositories/service.repository';
import { findSpecialistScheduleSettings } from '../../repositories/specialist.repository';
import { getBusyIntervalsFromExternalCalendars } from '../calendar-sync.service';
import { getAvailableSlots } from '../slot.service';

describe('getAvailableSlots', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('filters out overlapping slots for appointments on the same day', async () => {
    vi.mocked(findServiceById).mockResolvedValue({ duration_min: 60 } as any);
    vi.mocked(findSpecialistScheduleSettings).mockResolvedValue({
      workStartHour: 9,
      workEndHour: 12,
      slotDurationMin: 90,
      slotStepMin: 30,
    } as any);
    vi.mocked(getAppSettings).mockResolvedValue({ timezone: 'Europe/Moscow' } as any);
    vi.mocked(findBusyAppointmentsByDate).mockResolvedValue([
      { date: '2026-04-18', time: '10:00', durationMin: 60 },
    ] as any);
    vi.mocked(getBusyIntervalsFromExternalCalendars).mockResolvedValue([] as any);

    const slots = await getAvailableSlots({
      accountId: 7,
      date: '2026-04-18',
      specialistId: 1,
      serviceId: 1,
    });

    expect(slots).toEqual(['09:00', '11:00']);
  });

  it('does not treat touching intervals as overlap (slot starts when appointment ends)', async () => {
    vi.mocked(findServiceById).mockResolvedValue({ duration_min: 60 } as any);
    vi.mocked(findSpecialistScheduleSettings).mockResolvedValue({
      workStartHour: 9,
      workEndHour: 12,
      slotDurationMin: 90,
      slotStepMin: 30,
    } as any);
    vi.mocked(getAppSettings).mockResolvedValue({ timezone: 'Europe/Moscow' } as any);
    vi.mocked(findBusyAppointmentsByDate).mockResolvedValue([
      { date: '2026-04-18', time: '09:00', durationMin: 60 },
    ] as any);
    vi.mocked(getBusyIntervalsFromExternalCalendars).mockResolvedValue([] as any);

    const slots = await getAvailableSlots({
      accountId: 7,
      date: '2026-04-18',
      specialistId: 1,
      serviceId: 1,
    });

    expect(slots).toEqual(['10:00', '10:30', '11:00']);
  });

  it('filters out slots overlapped by an appointment starting the previous day (cross-midnight)', async () => {
    vi.mocked(findServiceById).mockResolvedValue({ duration_min: 60 } as any);
    vi.mocked(findSpecialistScheduleSettings).mockResolvedValue({
      workStartHour: 0,
      workEndHour: 2,
      slotDurationMin: 90,
      slotStepMin: 30,
    } as any);
    vi.mocked(getAppSettings).mockResolvedValue({ timezone: 'Europe/Moscow' } as any);
    vi.mocked(findBusyAppointmentsByDate).mockResolvedValue([
      // 23:30-01:30 overlaps the next day 00:00-02:00 work window
      { date: '2026-04-17', time: '23:30', durationMin: 120 },
    ] as any);
    vi.mocked(getBusyIntervalsFromExternalCalendars).mockResolvedValue([] as any);

    const slots = await getAvailableSlots({
      accountId: 7,
      date: '2026-04-18',
      specialistId: 1,
      serviceId: 1,
    });

    expect(slots).toEqual([]);
  });

  it('uses default duration when service is missing', async () => {
    vi.mocked(findServiceById).mockResolvedValue(null as any);
    vi.mocked(findSpecialistScheduleSettings).mockResolvedValue({
      workStartHour: 9,
      workEndHour: 12,
      slotDurationMin: 90,
      slotStepMin: 30,
    } as any);
    vi.mocked(getAppSettings).mockResolvedValue({ timezone: 'Europe/Moscow' } as any);
    vi.mocked(findBusyAppointmentsByDate).mockResolvedValue([] as any);
    vi.mocked(getBusyIntervalsFromExternalCalendars).mockResolvedValue([] as any);

    const slots = await getAvailableSlots({
      accountId: 7,
      date: '2026-04-18',
      specialistId: 1,
      serviceId: 999,
    });

    // Default duration=90, work window=09:00-12:00 => 09:00, 09:30, 10:00, 10:30
    expect(slots).toEqual(['09:00', '09:30', '10:00', '10:30']);
  });

  it('returns no slots when duration exceeds the work window', async () => {
    vi.mocked(findServiceById).mockResolvedValue({ duration_min: 180 } as any);
    vi.mocked(findSpecialistScheduleSettings).mockResolvedValue({
      workStartHour: 9,
      workEndHour: 11,
      slotDurationMin: 90,
      slotStepMin: 30,
    } as any);
    vi.mocked(getAppSettings).mockResolvedValue({ timezone: 'Europe/Moscow' } as any);
    vi.mocked(findBusyAppointmentsByDate).mockResolvedValue([] as any);
    vi.mocked(getBusyIntervalsFromExternalCalendars).mockResolvedValue([] as any);

    const slots = await getAvailableSlots({
      accountId: 7,
      date: '2026-04-18',
      specialistId: 1,
      serviceId: 1,
    });

    expect(slots).toEqual([]);
  });

  it('does not exclude slots due to appointments on other days that do not overlap', async () => {
    vi.mocked(findServiceById).mockResolvedValue({ duration_min: 60 } as any);
    vi.mocked(findSpecialistScheduleSettings).mockResolvedValue({
      workStartHour: 9,
      workEndHour: 12,
      slotDurationMin: 90,
      slotStepMin: 30,
    } as any);
    vi.mocked(getAppSettings).mockResolvedValue({ timezone: 'Europe/Moscow' } as any);
    vi.mocked(findBusyAppointmentsByDate).mockResolvedValue([
      { date: '2026-04-19', time: '09:00', durationMin: 60 },
    ] as any);
    vi.mocked(getBusyIntervalsFromExternalCalendars).mockResolvedValue([] as any);

    const slots = await getAvailableSlots({
      accountId: 7,
      date: '2026-04-18',
      specialistId: 1,
      serviceId: 1,
    });

    expect(slots).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00']);
  });

  it('filters slots by Google Calendar busy intervals as well', async () => {
    vi.mocked(findServiceById).mockResolvedValue({ duration_min: 60 } as any);
    vi.mocked(findSpecialistScheduleSettings).mockResolvedValue({
      workStartHour: 9,
      workEndHour: 12,
      slotDurationMin: 90,
      slotStepMin: 30,
    } as any);
    vi.mocked(getAppSettings).mockResolvedValue({ timezone: 'Europe/Moscow' } as any);
    vi.mocked(findBusyAppointmentsByDate).mockResolvedValue([] as any);
    vi.mocked(getBusyIntervalsFromExternalCalendars).mockResolvedValue([
      { date: '2026-04-18', time: '10:00', durationMin: 60 },
    ] as any);

    const slots = await getAvailableSlots({
      accountId: 7,
      date: '2026-04-18',
      specialistId: 1,
      serviceId: 1,
    });

    expect(slots).toEqual(['09:00', '11:00']);
  });

  it('uses specialist slot step for time picker interval', async () => {
    vi.mocked(findServiceById).mockResolvedValue({ duration_min: 60 } as any);
    vi.mocked(findSpecialistScheduleSettings).mockResolvedValue({
      workStartHour: 9,
      workEndHour: 12,
      slotDurationMin: 90,
      slotStepMin: 60,
    } as any);
    vi.mocked(getAppSettings).mockResolvedValue({ timezone: 'Europe/Moscow' } as any);
    vi.mocked(findBusyAppointmentsByDate).mockResolvedValue([] as any);
    vi.mocked(getBusyIntervalsFromExternalCalendars).mockResolvedValue([] as any);

    const slots = await getAvailableSlots({
      accountId: 7,
      date: '2026-04-18',
      specialistId: 1,
      serviceId: 1,
    });

    expect(slots).toEqual(['09:00', '10:00', '11:00']);
  });
});
