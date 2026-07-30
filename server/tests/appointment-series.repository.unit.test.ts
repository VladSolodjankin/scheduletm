import { beforeEach, describe, expect, it, vi } from 'vitest';

const transactionMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => Object.assign(vi.fn(), { transaction: transactionMock }));

vi.mock('../src/db/knex.js', () => ({ db: dbMock }));

const { AppointmentRepositoryError, createAppointmentSeries } = await import(
  '../src/repositories/appointmentRepository.js'
);

describe('appointment series repository', () => {
  beforeEach(() => {
    transactionMock.mockReset();
    dbMock.mockClear();
  });

  it('creates the group and every occurrence in one transaction', async () => {
    const groupReturning = vi.fn().mockResolvedValue([{ id: 12 }]);
    const appointmentReturning = vi.fn().mockResolvedValue([
      { id: 101, appointment_at: new Date('2026-08-01T10:00:00.000Z') },
      { id: 102, appointment_at: new Date('2026-08-02T10:00:00.000Z') },
    ]);
    const trx = vi.fn((table: string) => ({
      insert: vi.fn(() => ({
        returning: table === 'appointment_groups' ? groupReturning : appointmentReturning,
      })),
    }));
    transactionMock.mockImplementation(async (callback) => callback(trx));

    const result = await createAppointmentSeries({
      accountId: 7,
      specialistId: 8,
      scheduledAt: new Date('2026-08-01T10:00:00.000Z'),
      scheduledDates: [
        new Date('2026-08-01T10:00:00.000Z'),
        new Date('2026-08-02T10:00:00.000Z'),
      ],
      status: 'new',
      notes: null,
      userId: 9,
      serviceId: 10,
      durationMin: 60,
    });

    expect(transactionMock).toHaveBeenCalledOnce();
    expect(result.groupId).toBe(12);
    expect(result.appointments.map((item) => item.id)).toEqual([101, 102]);
  });

  it('maps an occurrence overlap and rejects the whole transaction callback', async () => {
    const trx = vi.fn((table: string) => ({
      insert: vi.fn(() => ({
        returning: table === 'appointment_groups'
          ? vi.fn().mockResolvedValue([{ id: 12 }])
          : vi.fn().mockRejectedValue({ code: '23P01' }),
      })),
    }));
    transactionMock.mockImplementation(async (callback) => callback(trx));

    await expect(createAppointmentSeries({
      accountId: 7,
      specialistId: 8,
      scheduledAt: new Date('2026-08-01T10:00:00.000Z'),
      scheduledDates: [
        new Date('2026-08-01T10:00:00.000Z'),
        new Date('2026-08-02T10:00:00.000Z'),
      ],
      status: 'new',
      notes: null,
      userId: 9,
      serviceId: 10,
      durationMin: 60,
    })).rejects.toBeInstanceOf(AppointmentRepositoryError);
    expect(transactionMock).toHaveBeenCalledOnce();
  });
});
