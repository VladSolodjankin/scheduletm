import { beforeEach, describe, expect, it, vi } from 'vitest';

const transactionMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => Object.assign(vi.fn(), { transaction: transactionMock, fn: { now: vi.fn() } }));
const syncRepo = vi.hoisted(() => ({
  enqueueGoogleCalendarSync: vi.fn().mockResolvedValue(true),
  enqueueGoogleCalendarUpserts: vi.fn().mockResolvedValue(0),
}));

vi.mock('../src/db/knex.js', () => ({ db: dbMock }));
vi.mock('../src/repositories/googleCalendarSyncRepository.js', () => syncRepo);

const {
  autoCancelUnpaidAppointment,
  createAppointment,
  createAppointmentSeries,
  updateAppointment,
} = await import('../src/repositories/appointmentRepository.js');

function mockInsert(rows: unknown[]) {
  dbMock.mockReturnValue({ insert: () => ({ returning: vi.fn().mockResolvedValue(rows) }) });
}

function mockUpdate(row: unknown) {
  const chain: Record<string, unknown> = {};
  chain.where = vi.fn(() => chain);
  chain.whereIn = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.returning = vi.fn().mockResolvedValue(row ? [row] : []);
  dbMock.mockReturnValue(chain);
}

const baseRow = { id: 41, account_id: 7, specialist_id: 8, status: 'new', google_event_id: null, google_event_web_user_id: null };

describe('appointment repository Google Calendar outbox hooks', () => {
  beforeEach(() => {
    dbMock.mockReset();
    transactionMock.mockReset();
    syncRepo.enqueueGoogleCalendarSync.mockClear();
    syncRepo.enqueueGoogleCalendarUpserts.mockClear();
  });

  it('enqueues an upsert when an appointment is created (booking, bot-less server paths, zoom/series callers)', async () => {
    mockInsert([baseRow]);
    await createAppointment({
      accountId: 7, specialistId: 8, scheduledAt: new Date(), status: 'new', notes: null, userId: 1, serviceId: 2, durationMin: 60,
    });
    expect(syncRepo.enqueueGoogleCalendarSync).toHaveBeenCalledWith({
      accountId: 7, appointmentId: 41, action: 'upsert', specialistId: 8,
    });
  });

  it('enqueues one upsert per recurring row, inside the series transaction', async () => {
    const trx = vi.fn((table: string) => ({
      insert: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue(table === 'appointment_groups' ? [{ id: 3 }] : [{ id: 101 }, { id: 102 }, { id: 103 }]),
      })),
    }));
    transactionMock.mockImplementation(async (callback) => callback(trx));

    await createAppointmentSeries({
      accountId: 7, specialistId: 8, scheduledAt: new Date(), status: 'new', notes: null, userId: 1, serviceId: 2, durationMin: 60,
      scheduledDates: [new Date(), new Date(), new Date()],
    });

    expect(syncRepo.enqueueGoogleCalendarUpserts).toHaveBeenCalledWith(
      { accountId: 7, specialistId: 8, appointmentIds: [101, 102, 103] },
      trx,
    );
  });

  it('enqueues a delete with the event snapshot on cancel (client token, zoom webhook, manager)', async () => {
    mockUpdate({ ...baseRow, status: 'cancelled', google_event_id: 'evt', google_event_web_user_id: 5 });
    await updateAppointment({ accountId: 7, id: 41, status: 'cancelled' });
    expect(syncRepo.enqueueGoogleCalendarSync).toHaveBeenCalledWith({
      accountId: 7, appointmentId: 41, action: 'delete', specialistId: 8, googleEventId: 'evt', webUserId: 5,
    });
  });

  it('enqueues an upsert on reschedule', async () => {
    mockUpdate(baseRow);
    await updateAppointment({ accountId: 7, id: 41, scheduledAt: new Date() });
    expect(syncRepo.enqueueGoogleCalendarSync).toHaveBeenCalledWith(expect.objectContaining({ action: 'upsert', appointmentId: 41 }));
  });

  it('does not enqueue for changes that are not part of the event (paid flag, zoom timestamps, notes)', async () => {
    mockUpdate(baseRow);
    await updateAppointment({ accountId: 7, id: 41, isPaid: true, notes: 'x', zoomMeetingStartedAt: new Date() });
    expect(syncRepo.enqueueGoogleCalendarSync).not.toHaveBeenCalled();
  });

  it('enqueues a delete when unpaid appointments are auto-cancelled', async () => {
    mockUpdate({ ...baseRow, status: 'cancelled' });
    await autoCancelUnpaidAppointment({ accountId: 7, id: 41 });
    expect(syncRepo.enqueueGoogleCalendarSync).toHaveBeenCalledWith(expect.objectContaining({ action: 'delete', appointmentId: 41 }));
  });

  it('does not enqueue when nothing was updated', async () => {
    mockUpdate(null);
    await autoCancelUnpaidAppointment({ accountId: 7, id: 41 });
    expect(syncRepo.enqueueGoogleCalendarSync).not.toHaveBeenCalled();
  });

  it('keeps the appointment write successful when the outbox helper reports failure', async () => {
    syncRepo.enqueueGoogleCalendarSync.mockResolvedValueOnce(false);
    mockInsert([baseRow]);
    await expect(createAppointment({
      accountId: 7, specialistId: 8, scheduledAt: new Date(), status: 'new', notes: null, userId: 1, serviceId: 2, durationMin: 60,
    })).resolves.toMatchObject({ id: 41 });
  });
});
