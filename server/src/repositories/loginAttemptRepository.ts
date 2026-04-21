import { db } from '../db/knex.js';

export type LoginAttemptRecord = {
  id: number;
  ip: string;
  fail_count: number;
  locked_until: Date | null;
  last_failed_at: Date;
};

export async function findLoginAttemptByIp(ip: string): Promise<LoginAttemptRecord | null> {
  const row = await db('login_attempts').where({ ip }).first<LoginAttemptRecord>();
  return row ?? null;
}

export async function upsertFailedLoginAttempt(ip: string, lockUntil: Date | null): Promise<LoginAttemptRecord> {
  const [row] = await db('login_attempts')
    .insert({
      ip,
      fail_count: 1,
      locked_until: lockUntil,
      last_failed_at: db.fn.now(),
    })
    .onConflict('ip')
    .merge({
      fail_count: db.raw('"login_attempts"."fail_count" + 1'),
      locked_until: lockUntil,
      last_failed_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning<LoginAttemptRecord[]>('*');

  return row;
}

export async function clearLoginAttempt(ip: string): Promise<void> {
  await db('login_attempts').where({ ip }).delete();
}
