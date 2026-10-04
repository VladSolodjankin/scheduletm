import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.hoisted(() => {
  const query = {
    where: vi.fn(),
    orderBy: vi.fn(),
    select: vi.fn(),
    first: vi.fn(),
    insert: vi.fn(),
    returning: vi.fn(),
    delete: vi.fn(),
  };
  for (const method of ['where', 'orderBy', 'insert'] as const) {
    query[method].mockReturnValue(query);
  }
  return query;
});

const dbMock = vi.hoisted(() => vi.fn(() => queryMock));

vi.mock('../src/db/knex.js', () => ({ db: dbMock }));

import {
  createScheduleException,
  deleteScheduleExceptionById,
  findScheduleExceptionById,
  findScheduleExceptionsForDate,
  listScheduleExceptions,
} from '../src/repositories/specialistScheduleExceptionRepository.js';

describe('specialistScheduleExceptionRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.where.mockReturnValue(queryMock);
    queryMock.orderBy.mockReturnValue(queryMock);
    queryMock.insert.mockReturnValue(queryMock);
  });

  it('listScheduleExceptions scopes by account and specialist, ordered by date', async () => {
    const rows = [{ id: 1, exception_date: '2026-11-03' }];
    queryMock.select.mockResolvedValue(rows);

    const result = await listScheduleExceptions(1, 7);

    expect(dbMock).toHaveBeenCalledWith('specialist_schedule_exceptions');
    expect(queryMock.where).toHaveBeenCalledWith({ account_id: 1, specialist_id: 7 });
    expect(queryMock.orderBy).toHaveBeenCalledWith('exception_date', 'asc');
    expect(result).toBe(rows);
  });

  it('findScheduleExceptionsForDate filters to a single date', async () => {
    const rows = [{ id: 2, exception_date: '2026-11-10' }];
    queryMock.select.mockResolvedValue(rows);

    const result = await findScheduleExceptionsForDate(1, 7, '2026-11-10');

    expect(queryMock.where).toHaveBeenCalledWith({ account_id: 1, specialist_id: 7, exception_date: '2026-11-10' });
    expect(result).toBe(rows);
  });

  it('findScheduleExceptionById returns null when nothing matches', async () => {
    queryMock.first.mockResolvedValue(undefined);

    const result = await findScheduleExceptionById(1, 7, 999);

    expect(result).toBeNull();
  });

  it('createScheduleException inserts the row and returns it', async () => {
    const created = { id: 5, exception_date: '2026-11-10', starts_at_minute: 720, ends_at_minute: 780 };
    queryMock.returning.mockResolvedValue([created]);

    const result = await createScheduleException({
      accountId: 1,
      specialistId: 7,
      date: '2026-11-10',
      type: 'break',
      startsAtMinute: 720,
      endsAtMinute: 780,
    });

    expect(queryMock.insert).toHaveBeenCalledWith(expect.objectContaining({
      account_id: 1,
      specialist_id: 7,
      exception_date: '2026-11-10',
      type: 'break',
      starts_at_minute: 720,
      ends_at_minute: 780,
    }));
    expect(result).toBe(created);
  });

  it('deleteScheduleExceptionById returns true when a row was removed', async () => {
    queryMock.delete.mockResolvedValue(1);

    const result = await deleteScheduleExceptionById(1, 7, 5);

    expect(queryMock.where).toHaveBeenCalledWith({ id: 5, account_id: 1, specialist_id: 7 });
    expect(result).toBe(true);
  });

  it('deleteScheduleExceptionById returns false when nothing matched', async () => {
    queryMock.delete.mockResolvedValue(0);

    const result = await deleteScheduleExceptionById(1, 7, 999);

    expect(result).toBe(false);
  });
});
