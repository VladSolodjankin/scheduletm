import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runAppointmentNotificationsJob } from '../src/jobs/appointmentNotifications.job.js';

const listAppointmentsAllAccountsMock = vi.hoisted(() => vi.fn());
const listUnpaidAppointmentsCreatedBetweenAllAccountsMock = vi.hoisted(() => vi.fn());
const upsertNotificationJobMock = vi.hoisted(() => vi.fn());
const claimNotificationForDeliveryMock = vi.hoisted(() => vi.fn());
const heartbeatNotificationProcessingMock = vi.hoisted(() => vi.fn());
const markNotificationSentMock = vi.hoisted(() => vi.fn());
const markNotificationDeliveryFailureMock = vi.hoisted(() => vi.fn());
const sendAppointmentNotificationByTypeMock = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/appointmentRepository.js', () => ({
  listAppointmentsAllAccounts: listAppointmentsAllAccountsMock,
  listUnpaidAppointmentsCreatedBetweenAllAccounts: listUnpaidAppointmentsCreatedBetweenAllAccountsMock,
}));

vi.mock('../src/repositories/notificationRepository.js', () => ({
  upsertNotificationJob: upsertNotificationJobMock,
  claimNotificationForDelivery: claimNotificationForDeliveryMock,
  heartbeatNotificationProcessing: heartbeatNotificationProcessingMock,
  markNotificationSent: markNotificationSentMock,
  markNotificationDeliveryFailure: markNotificationDeliveryFailureMock,
}));

vi.mock('../src/services/appointmentNotificationService.js', () => ({
  sendAppointmentNotificationByType: sendAppointmentNotificationByTypeMock,
}));

describe('appointment notifications job unit', () => {
  beforeEach(() => {
    listAppointmentsAllAccountsMock.mockReset();
    listUnpaidAppointmentsCreatedBetweenAllAccountsMock.mockReset();
    upsertNotificationJobMock.mockReset();
    claimNotificationForDeliveryMock.mockReset();
    heartbeatNotificationProcessingMock.mockReset();
    markNotificationSentMock.mockReset();
    markNotificationDeliveryFailureMock.mockReset();
    sendAppointmentNotificationByTypeMock.mockReset();

    listAppointmentsAllAccountsMock.mockResolvedValue([]);
    listUnpaidAppointmentsCreatedBetweenAllAccountsMock.mockResolvedValue([]);
    upsertNotificationJobMock.mockResolvedValue({ id: 1, status: 'pending', attempts: 0, max_attempts: 3 });
    claimNotificationForDeliveryMock.mockResolvedValue('worker-token');
    heartbeatNotificationProcessingMock.mockResolvedValue(true);
    markNotificationSentMock.mockResolvedValue(true);
    markNotificationDeliveryFailureMock.mockResolvedValue(true);
    sendAppointmentNotificationByTypeMock.mockResolvedValue({ delivered: true, channel: 'email' });
  });

  it('delivers reminder and writes sent notification once', async () => {
    listAppointmentsAllAccountsMock.mockResolvedValueOnce([
      {
        id: 11,
        account_id: 2,
        specialist_id: 3,
        appointment_at: new Date('2026-04-27T12:00:00.000Z'),
        status: 'new',
        comment: null,
        duration_min: 30,
        is_paid: false,
        user_id: 8,
        service_id: 1,
        created_at: new Date('2026-04-26T12:00:00.000Z'),
        updated_at: new Date('2026-04-26T12:00:00.000Z'),
        client_email: 'client@test.com',
      },
    ]);

    const delivered = await runAppointmentNotificationsJob(new Date('2026-04-26T12:00:00.000Z'));

    expect(delivered).toBe(1);
    expect(markNotificationSentMock).toHaveBeenCalledOnce();
    expect(markNotificationSentMock).toHaveBeenCalledWith(expect.objectContaining({
      processingToken: 'worker-token',
    }));
    expect(markNotificationDeliveryFailureMock).not.toHaveBeenCalled();
  });

  it('skips already sent notification (edge case dedupe)', async () => {
    listAppointmentsAllAccountsMock.mockResolvedValueOnce([
      {
        id: 11,
        account_id: 2,
        specialist_id: 3,
        appointment_at: new Date('2026-04-27T12:00:00.000Z'),
        status: 'new',
        comment: null,
        duration_min: 30,
        is_paid: false,
        user_id: 8,
        service_id: 1,
        created_at: new Date('2026-04-26T12:00:00.000Z'),
        updated_at: new Date('2026-04-26T12:00:00.000Z'),
        client_email: 'client@test.com',
      },
    ]);
    upsertNotificationJobMock.mockResolvedValue({ id: 1, status: 'sent', attempts: 1, max_attempts: 3 });

    const delivered = await runAppointmentNotificationsJob(new Date('2026-04-26T12:00:00.000Z'));

    expect(delivered).toBe(0);
    expect(sendAppointmentNotificationByTypeMock).not.toHaveBeenCalled();
    expect(markNotificationSentMock).not.toHaveBeenCalled();
  });

  it('marks retry when delivery fails', async () => {
    listAppointmentsAllAccountsMock.mockResolvedValueOnce([
      {
        id: 11,
        account_id: 2,
        specialist_id: 3,
        appointment_at: new Date('2026-04-27T12:00:00.000Z'),
        status: 'new',
        comment: null,
        duration_min: 30,
        is_paid: false,
        user_id: 8,
        service_id: 1,
        created_at: new Date('2026-04-26T12:00:00.000Z'),
        updated_at: new Date('2026-04-26T12:00:00.000Z'),
        client_email: 'client@test.com',
      },
    ]);
    sendAppointmentNotificationByTypeMock.mockResolvedValueOnce({ delivered: false, channel: null, reason: 'delivery_failed' });

    const delivered = await runAppointmentNotificationsJob(new Date('2026-04-26T12:00:00.000Z'));

    expect(delivered).toBe(0);
    expect(markNotificationDeliveryFailureMock).toHaveBeenCalledOnce();
    expect(markNotificationDeliveryFailureMock).toHaveBeenCalledWith(expect.objectContaining({
      processingToken: 'worker-token',
    }));
    expect(markNotificationSentMock).not.toHaveBeenCalled();
  });

  it('marks sender rejection once, clears heartbeat, and rethrows the original error', async () => {
    const senderError = new Error('provider unavailable');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    listAppointmentsAllAccountsMock.mockResolvedValueOnce([
      {
        id: 11,
        account_id: 2,
        specialist_id: 3,
        appointment_at: new Date('2026-04-27T12:00:00.000Z'),
        status: 'new',
        comment: null,
        duration_min: 30,
        is_paid: false,
        user_id: 8,
        service_id: 1,
        created_at: new Date('2026-04-26T12:00:00.000Z'),
        updated_at: new Date('2026-04-26T12:00:00.000Z'),
        client_email: 'client@test.com',
      },
    ]);
    sendAppointmentNotificationByTypeMock.mockRejectedValueOnce(senderError);

    await expect(
      runAppointmentNotificationsJob(new Date('2026-04-26T12:00:00.000Z')),
    ).rejects.toBe(senderError);

    expect(clearIntervalSpy).toHaveBeenCalledOnce();
    expect(markNotificationDeliveryFailureMock).toHaveBeenCalledOnce();
    expect(markNotificationDeliveryFailureMock).toHaveBeenCalledWith({
      notificationId: 1,
      processingToken: 'worker-token',
      error: 'provider unavailable',
      now: new Date('2026-04-26T12:00:00.000Z'),
    });
    expect(markNotificationSentMock).not.toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('skips an overlapping run in the same process', async () => {
    let releaseFirstRun!: () => void;
    const firstRunBlocked = new Promise<void>((resolve) => {
      releaseFirstRun = resolve;
    });
    listAppointmentsAllAccountsMock.mockImplementationOnce(() => firstRunBlocked.then(() => []));

    const firstRun = runAppointmentNotificationsJob(new Date('2026-04-26T12:00:00.000Z'));
    const overlappingResult = await runAppointmentNotificationsJob(new Date('2026-04-26T12:01:00.000Z'));

    expect(overlappingResult).toBe(0);
    expect(listAppointmentsAllAccountsMock).toHaveBeenCalledOnce();

    releaseFirstRun();
    await firstRun;
  });

  it('releases the overlap guard after an error', async () => {
    listAppointmentsAllAccountsMock.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      runAppointmentNotificationsJob(new Date('2026-04-26T12:00:00.000Z')),
    ).rejects.toThrow('database unavailable');

    await expect(
      runAppointmentNotificationsJob(new Date('2026-04-26T12:01:00.000Z')),
    ).resolves.toBe(0);
    expect(listAppointmentsAllAccountsMock).toHaveBeenCalledTimes(3);
  });

  it('heartbeats while delivery is pending and always clears the heartbeat', async () => {
    vi.useFakeTimers();
    let finishDelivery!: () => void;
    const pendingDelivery = new Promise<void>((resolve) => {
      finishDelivery = resolve;
    });
    listAppointmentsAllAccountsMock.mockResolvedValueOnce([{
      id: 11,
      account_id: 2,
      specialist_id: 3,
      appointment_at: new Date('2026-04-27T12:00:00.000Z'),
      status: 'new',
      comment: null,
      duration_min: 30,
      is_paid: false,
      user_id: 8,
      service_id: 1,
      created_at: new Date('2026-04-26T12:00:00.000Z'),
      updated_at: new Date('2026-04-26T12:00:00.000Z'),
      client_email: 'client@test.com',
    }]);
    sendAppointmentNotificationByTypeMock.mockImplementationOnce(async () => {
      await pendingDelivery;
      return { delivered: true, channel: 'email' };
    });

    const run = runAppointmentNotificationsJob(new Date('2026-04-26T12:00:00.000Z'));
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(heartbeatNotificationProcessingMock).toHaveBeenCalledWith({
      notificationId: 1,
      processingToken: 'worker-token',
    });

    finishDelivery();
    await run;
    heartbeatNotificationProcessingMock.mockClear();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(heartbeatNotificationProcessingMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
