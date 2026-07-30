import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.hoisted(() => ({
  where: vi.fn(),
  delete: vi.fn(),
}));
const dbMock = vi.hoisted(() => vi.fn(() => queryMock));

vi.mock('../src/db/knex.js', () => ({ db: dbMock }));

const { purgeAppointmentEventsCreatedBefore } = await import(
  '../src/repositories/appointmentRepository.js'
);

describe('appointment audit retention repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.where.mockReturnValue(queryMock);
    queryMock.delete.mockResolvedValue(4);
  });

  it('deletes only appointment_events strictly before the supplied cutoff', async () => {
    const cutoff = new Date('2025-07-30T12:00:00.000Z');
    await expect(purgeAppointmentEventsCreatedBefore(cutoff)).resolves.toBe(4);

    expect(dbMock).toHaveBeenCalledWith('appointment_events');
    expect(queryMock.where).toHaveBeenCalledWith('created_at', '<', cutoff);
    expect(queryMock.delete).toHaveBeenCalledOnce();
  });
});
