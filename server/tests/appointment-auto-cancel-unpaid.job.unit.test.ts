import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runAppointmentAutoCancelUnpaidJob } from '../src/jobs/appointmentAutoCancelUnpaid.job.js';

const listUnpaidActiveAppointmentsCreatedBeforeAllAccountsMock = vi.hoisted(() => vi.fn());
const findSpecialistBookingPolicyMock = vi.hoisted(() => vi.fn());
const autoCancelUnpaidAppointmentMock = vi.hoisted(() => vi.fn());
const createAppointmentAuditEventMock = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/appointmentRepository.js', () => ({
  listUnpaidActiveAppointmentsCreatedBeforeAllAccounts: listUnpaidActiveAppointmentsCreatedBeforeAllAccountsMock,
  autoCancelUnpaidAppointment: autoCancelUnpaidAppointmentMock,
  createAppointmentAuditEvent: createAppointmentAuditEventMock,
}));

vi.mock('../src/repositories/specialistBookingPolicyRepository.js', () => ({
  findSpecialistBookingPolicy: findSpecialistBookingPolicyMock,
}));

describe('appointment auto-cancel unpaid job unit', () => {
  beforeEach(() => {
    listUnpaidActiveAppointmentsCreatedBeforeAllAccountsMock.mockReset();
    findSpecialistBookingPolicyMock.mockReset();
    autoCancelUnpaidAppointmentMock.mockReset();
    createAppointmentAuditEventMock.mockReset();

    listUnpaidActiveAppointmentsCreatedBeforeAllAccountsMock.mockResolvedValue([]);
    findSpecialistBookingPolicyMock.mockResolvedValue(null);
    autoCancelUnpaidAppointmentMock.mockResolvedValue(null);
    createAppointmentAuditEventMock.mockResolvedValue(undefined);
  });

  it('cancels unpaid appointment after policy threshold and writes auto_cancel_unpaid audit reason', async () => {
    listUnpaidActiveAppointmentsCreatedBeforeAllAccountsMock.mockResolvedValueOnce([
      {
        id: 101,
        account_id: 7,
        specialist_id: 10,
        created_at: new Date('2026-04-24T09:00:00.000Z'),
        status: 'new',
        is_paid: false,
      },
    ]);
    findSpecialistBookingPolicyMock.mockResolvedValueOnce({
      auto_cancel_unpaid_enabled: true,
      unpaid_auto_cancel_after_hours: 24,
    });
    autoCancelUnpaidAppointmentMock.mockResolvedValueOnce({ id: 101 });

    const cancelled = await runAppointmentAutoCancelUnpaidJob(new Date('2026-04-25T10:00:00.000Z'));

    expect(cancelled).toBe(1);
    expect(autoCancelUnpaidAppointmentMock).toHaveBeenCalledWith({ accountId: 7, id: 101 });
    expect(createAppointmentAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 7,
      appointmentId: 101,
      action: 'cancel',
      actorWebUserId: null,
      metadata: { reason: 'auto_cancel_unpaid' },
    }));
  });

  it('does not cancel when policy disabled or threshold not reached', async () => {
    listUnpaidActiveAppointmentsCreatedBeforeAllAccountsMock.mockResolvedValueOnce([
      {
        id: 201,
        account_id: 8,
        specialist_id: 20,
        created_at: new Date('2026-04-25T09:30:00.000Z'),
        status: 'confirmed',
        is_paid: false,
      },
      {
        id: 202,
        account_id: 9,
        specialist_id: 21,
        created_at: new Date('2026-04-25T09:30:00.000Z'),
        status: 'new',
        is_paid: false,
      },
    ]);

    findSpecialistBookingPolicyMock
      .mockResolvedValueOnce({
        auto_cancel_unpaid_enabled: false,
        unpaid_auto_cancel_after_hours: 1,
      })
      .mockResolvedValueOnce({
        auto_cancel_unpaid_enabled: true,
        unpaid_auto_cancel_after_hours: 24,
      });

    const cancelled = await runAppointmentAutoCancelUnpaidJob(new Date('2026-04-25T10:00:00.000Z'));

    expect(cancelled).toBe(0);
    expect(autoCancelUnpaidAppointmentMock).not.toHaveBeenCalled();
    expect(createAppointmentAuditEventMock).not.toHaveBeenCalled();
  });

  it('skips audit when appointment is no longer eligible at update time (race-safe)', async () => {
    listUnpaidActiveAppointmentsCreatedBeforeAllAccountsMock.mockResolvedValueOnce([
      {
        id: 301,
        account_id: 5,
        specialist_id: 17,
        created_at: new Date('2026-04-20T09:00:00.000Z'),
        status: 'new',
        is_paid: false,
      },
    ]);
    findSpecialistBookingPolicyMock.mockResolvedValueOnce({
      auto_cancel_unpaid_enabled: true,
      unpaid_auto_cancel_after_hours: 24,
    });
    autoCancelUnpaidAppointmentMock.mockResolvedValueOnce(null);

    const cancelled = await runAppointmentAutoCancelUnpaidJob(new Date('2026-04-25T10:00:00.000Z'));

    expect(cancelled).toBe(0);
    expect(autoCancelUnpaidAppointmentMock).toHaveBeenCalledWith({ accountId: 5, id: 301 });
    expect(createAppointmentAuditEventMock).not.toHaveBeenCalled();
  });
});
