import { db } from '../db/knex.js';
import { createToken } from '../utils/crypto.js';

export type AppointmentManagementTokenRecord = {
  id: number;
  appointment_id: number;
  token: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export async function createAppointmentManagementToken(
  appointmentId: number,
  expiresAt: Date,
): Promise<AppointmentManagementTokenRecord> {
  const [row] = await db('appointment_management_tokens')
    .insert({
      appointment_id: appointmentId,
      token: createToken(),
      expires_at: expiresAt,
    })
    .returning<AppointmentManagementTokenRecord[]>('*');

  return row;
}

export async function findActiveAppointmentManagementToken(
  appointmentId: number,
): Promise<AppointmentManagementTokenRecord | null> {
  const row = await db('appointment_management_tokens')
    .where({ appointment_id: appointmentId })
    .whereNull('revoked_at')
    .andWhere('expires_at', '>', db.fn.now())
    .orderBy('id', 'desc')
    .first<AppointmentManagementTokenRecord>();

  return row ?? null;
}

export async function findValidAppointmentManagementToken(
  token: string,
): Promise<AppointmentManagementTokenRecord | null> {
  const row = await db('appointment_management_tokens')
    .where({ token })
    .whereNull('revoked_at')
    .andWhere('expires_at', '>', db.fn.now())
    .first<AppointmentManagementTokenRecord>();

  return row ?? null;
}
