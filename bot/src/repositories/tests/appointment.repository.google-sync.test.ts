import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => Object.assign(vi.fn(), { fn: { now: vi.fn() }, transaction: vi.fn() }));
const enqueueMock = vi.hoisted(() => vi.fn().mockResolvedValue(true));

vi.mock('../../db/knex', () => ({ db: dbMock }));
vi.mock('../google-calendar-sync-queue.repository', () => ({ enqueueGoogleCalendarSync: enqueueMock }));

import {
  cancelAppointmentById,
  createAppointment,
  createAppointments,
  updateAppointmentDateTime,
} from '../appointment.repository';

const row = { id: 41, account_id: 7, specialist_id: 8, google_event_id: null, google_event_web_user_id: null };

function mockInsert(rows: unknown[]) {
  dbMock.mockReturnValue({ insert: () => ({ returning: vi.fn().mockResolvedValue(rows) }) });
}

function mockUpdate(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.where = vi.fn(() => chain);
  chain.whereNot = vi.fn(() => chain);
  chain.update = vi.fn().mockResolvedValue(result);
  dbMock.mockReturnValue(chain);
}

const createInput = {
  accountId: 7, userId: 1, serviceId: 2, specialistId: 8, appointmentAt: '2026-11-01T10:00:00.000Z',
  durationMin: 60, price: 0, currency: 'RUB',
};

describe('bot appointment repository Google outbox hooks', () => {
  beforeEach(() => {
    dbMock.mockReset();
    enqueueMock.mockClear();
  });

  it('enqueues an upsert when the bot creates an appointment', async () => {
    mockInsert([row]);
    await createAppointment(createInput);
    expect(enqueueMock).toHaveBeenCalledWith({ accountId: 7, appointmentId: 41, action: 'upsert', specialistId: 8 });
  });

  it('enqueues one upsert per row for series, on the booking transaction', async () => {
    const trx = Object.assign(vi.fn(), {});
    let id = 100;
    trx.mockImplementation(() => ({ insert: () => ({ returning: vi.fn().mockImplementation(async () => [{ ...row, id: id++ }]) }) }));

    await createAppointments([createInput, createInput, createInput], trx as never);

    expect(enqueueMock.mock.calls.map(([input]) => input.appointmentId)).toEqual([100, 101, 102]);
    expect(enqueueMock.mock.calls.every(([, executor]) => executor === trx)).toBe(true);
  });

  it('enqueues an upsert on reschedule', async () => {
    mockUpdate([row]);
    await updateAppointmentDateTime(7, 1, 41, '2026-11-02T10:00:00.000Z');
    expect(enqueueMock).toHaveBeenCalledWith({ accountId: 7, appointmentId: 41, action: 'upsert', specialistId: 8 });
  });

  it('enqueues a delete on cancel, carrying the Google event snapshot', async () => {
    mockUpdate([{ ...row, google_event_id: 'evt', google_event_web_user_id: 5 }]);
    await cancelAppointmentById(7, 1, 41);
    expect(enqueueMock).toHaveBeenCalledWith({
      accountId: 7, appointmentId: 41, action: 'delete', specialistId: 8, googleEventId: 'evt', webUserId: 5,
    });
  });

  it('does not enqueue when nothing was cancelled', async () => {
    mockUpdate([]);
    await expect(cancelAppointmentById(7, 1, 41)).resolves.toBeNull();
    expect(enqueueMock).not.toHaveBeenCalled();
  });
});
