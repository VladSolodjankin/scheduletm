import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/appointment.repository', () => {
  return {
    createAppointments: vi.fn(),
  };
});

vi.mock('../../repositories/service.repository', () => {
  return {
    findServiceById: vi.fn(),
  };
});

vi.mock('../../repositories/specialist.repository', () => {
  return {
    findSpecialistById: vi.fn(),
  };
});

vi.mock('../../repositories/app-settings.repository', () => {
  return {
    getDefaultTimezone: vi.fn(),
  };
});

import { createAppointments } from '../../repositories/appointment.repository';
import { getDefaultTimezone } from '../../repositories/app-settings.repository';
import { findServiceById } from '../../repositories/service.repository';
import { findSpecialistById } from '../../repositories/specialist.repository';
import { createBookingAppointment } from '../appointment.service';

describe('createBookingAppointment', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns service_not_found when service missing/inactive', async () => {
    vi.mocked(findServiceById).mockResolvedValue(null as any);

    const out = await createBookingAppointment({
      accountId: 7,
      userId: 1,
      serviceId: 123,
      specialistId: 2,
      selectedDate: '2026-04-18',
      selectedTime: '09:00',
    });

    expect(out).toEqual({ ok: false, reason: 'service_not_found' });
  });

  it('returns service_not_found when service is inactive', async () => {
    vi.mocked(findServiceById).mockResolvedValue({
      id: 10,
      is_active: false,
    } as any);

    const out = await createBookingAppointment({
      accountId: 7,
      userId: 1,
      serviceId: 10,
      specialistId: 2,
      selectedDate: '2026-04-18',
      selectedTime: '09:00',
    });

    expect(out).toEqual({ ok: false, reason: 'service_not_found' });
    expect(createAppointments).not.toHaveBeenCalled();
  });

  it('creates appointment with UTC ISO datetime converted from account timezone date/time', async () => {
    vi.mocked(getDefaultTimezone).mockResolvedValue('Europe/Moscow');
    vi.mocked(findServiceById).mockResolvedValue({
      id: 10,
      is_active: true,
      duration_min: 90,
      price: 5000,
      currency: 'RUB',
      sessions_count: 1,
    } as any);
    vi.mocked(findSpecialistById).mockResolvedValue({
      id: 2,
      is_active: true,
      base_session_price: 5000,
      base_hour_price: 0,
    } as any);

    vi.mocked(createAppointments).mockImplementation(async (input: any) =>
      input.map((item: any, index: number) => ({ id: index + 1, ...item })));

    const out = await createBookingAppointment({
      accountId: 7,
      userId: 1,
      serviceId: 10,
      specialistId: 2,
      selectedDate: '2026-04-18',
      selectedTime: '09:00',
    });

    expect(out.ok).toBe(true);
    if (!out.ok) return;

    expect(createAppointments).toHaveBeenCalledWith([
      expect.objectContaining({
        accountId: 7,
        userId: 1,
        serviceId: 10,
        specialistId: 2,
        appointmentAt: '2026-04-18T06:00:00.000Z',
        durationMin: 90,
        price: 5000,
        currency: 'RUB',
      }),
    ]);
  });

  it('creates weekly series when service has multiple sessions', async () => {
    vi.mocked(getDefaultTimezone).mockResolvedValue('Europe/Moscow');
    vi.mocked(findServiceById).mockResolvedValue({
      id: 10,
      is_active: true,
      duration_min: 60,
      currency: 'RUB',
      sessions_count: 3,
    } as any);
    vi.mocked(findSpecialistById).mockResolvedValue({
      id: 2,
      is_active: true,
      base_session_price: 2000,
      base_hour_price: 0,
    } as any);
    vi.mocked(createAppointments).mockImplementation(async (input: any) =>
      input.map((item: any, index: number) => ({ id: index + 1, ...item })));

    const out = await createBookingAppointment({
      accountId: 7,
      userId: 1,
      serviceId: 10,
      specialistId: 2,
      selectedDate: '2026-04-18',
      selectedTime: '09:00',
    });

    expect(out.ok).toBe(true);
    if (!out.ok) return;

    expect(createAppointments).toHaveBeenCalledWith([
      expect.objectContaining({ appointmentAt: '2026-04-18T06:00:00.000Z', price: 6000 }),
      expect.objectContaining({ appointmentAt: '2026-04-25T06:00:00.000Z', price: 0 }),
      expect.objectContaining({ appointmentAt: '2026-05-02T06:00:00.000Z', price: 0 }),
    ]);
  });
});
