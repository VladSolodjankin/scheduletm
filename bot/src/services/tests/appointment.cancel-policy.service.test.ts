import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/appointment.repository', () => ({
  findUserAppointmentById: vi.fn(),
  cancelAppointmentById: vi.fn(),
  createAppointments: vi.fn(),
  findUserAppointments: vi.fn(),
  updateAppointmentDateTime: vi.fn(),
}));

vi.mock('../../repositories/service.repository', () => ({ findServiceById: vi.fn() }));
vi.mock('../../repositories/specialist.repository', () => ({ findSpecialistById: vi.fn() }));
vi.mock('../../repositories/app-settings.repository', () => ({ getDefaultTimezone: vi.fn() }));
vi.mock('../../repositories/appointment-group.repository', () => ({ createAppointmentGroup: vi.fn() }));
vi.mock('../../repositories/specialist-booking-policy.repository', () => ({
  getSpecialistCancelGraceHours: vi.fn(),
  getSpecialistBookingPolicy: vi.fn(),
}));

import { cancelAppointmentById, findUserAppointmentById } from '../../repositories/appointment.repository';
import { getSpecialistBookingPolicy } from '../../repositories/specialist-booking-policy.repository';
import { cancelUserAppointment, getCancelRefundOutcome } from '../appointment.service';

describe('appointment cancellation policy', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns no_refund for late cancellation when refundOnLateCancel=false', () => {
    const now = new Date('2026-04-27T10:00:00.000Z');
    const out = getCancelRefundOutcome(
      '2026-04-27T20:00:00.000Z',
      { cancelGracePeriodHours: 24, refundOnLateCancel: false },
      now,
    );

    expect(out).toEqual({ isLateCancel: true, refundOutcome: 'no_refund' });
  });

  it('allows cancellation and returns refund outcome payload', async () => {
    vi.mocked(findUserAppointmentById).mockResolvedValue({
      id: 11,
      specialistId: 5,
      appointmentAt: '2026-04-27T20:00:00.000Z',
    } as any);
    vi.mocked(getSpecialistBookingPolicy).mockResolvedValue({
      cancelGracePeriodHours: 24,
      refundOnLateCancel: false,
    });
    vi.mocked(cancelAppointmentById).mockResolvedValue({ id: 11 } as any);

    const out = await cancelUserAppointment(7, 3, 11);

    expect(out).toEqual({
      ok: true,
      isLateCancel: true,
      refundOutcome: 'no_refund',
    });
  });
});
