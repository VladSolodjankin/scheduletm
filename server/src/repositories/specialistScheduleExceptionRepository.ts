import { db } from '../db/knex.js';

export type ScheduleExceptionType = 'day_off' | 'vacation' | 'interval' | 'break';

export type ScheduleExceptionRecord = {
  id: number;
  account_id: number;
  specialist_id: number;
  exception_date: string;
  starts_at_minute: number | null;
  ends_at_minute: number | null;
  type: ScheduleExceptionType;
  note: string | null;
};

export type CreateScheduleExceptionInput = {
  accountId: number;
  specialistId: number;
  date: string;
  startsAtMinute?: number | null;
  endsAtMinute?: number | null;
  type: ScheduleExceptionType;
  note?: string | null;
};

const COLUMNS = [
  'id', 'account_id', 'specialist_id', 'exception_date',
  'starts_at_minute', 'ends_at_minute', 'type', 'note',
] as const;

export async function listScheduleExceptions(
  accountId: number,
  specialistId: number,
): Promise<ScheduleExceptionRecord[]> {
  return db('specialist_schedule_exceptions')
    .where({ account_id: accountId, specialist_id: specialistId })
    .orderBy('exception_date', 'asc')
    .select<ScheduleExceptionRecord[]>(...COLUMNS);
}

export async function findScheduleExceptionsForDate(
  accountId: number,
  specialistId: number,
  date: string,
): Promise<ScheduleExceptionRecord[]> {
  return db('specialist_schedule_exceptions')
    .where({ account_id: accountId, specialist_id: specialistId, exception_date: date })
    .select<ScheduleExceptionRecord[]>(...COLUMNS);
}

export async function findScheduleExceptionById(
  accountId: number,
  specialistId: number,
  id: number,
): Promise<ScheduleExceptionRecord | null> {
  const row = await db('specialist_schedule_exceptions')
    .where({ id, account_id: accountId, specialist_id: specialistId })
    .first<ScheduleExceptionRecord>(...COLUMNS);

  return row ?? null;
}

export async function createScheduleException(
  input: CreateScheduleExceptionInput,
): Promise<ScheduleExceptionRecord> {
  const [row] = await db('specialist_schedule_exceptions')
    .insert({
      account_id: input.accountId,
      specialist_id: input.specialistId,
      exception_date: input.date,
      starts_at_minute: input.startsAtMinute ?? null,
      ends_at_minute: input.endsAtMinute ?? null,
      type: input.type,
      note: input.note ?? null,
    })
    .returning<ScheduleExceptionRecord[]>(COLUMNS as unknown as string[]);

  return row;
}

export async function deleteScheduleExceptionById(
  accountId: number,
  specialistId: number,
  id: number,
): Promise<boolean> {
  const deleted = await db('specialist_schedule_exceptions')
    .where({ id, account_id: accountId, specialist_id: specialistId })
    .delete();

  return deleted > 0;
}
