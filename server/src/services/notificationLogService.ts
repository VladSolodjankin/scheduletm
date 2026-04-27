import { canManageAllAppointments } from '../policies/rolePermissions.js';
import {
  findNotificationLogById,
  listNotificationLogs,
  resetNotificationForResend,
  type NotificationLogRecord,
} from '../repositories/notificationRepository.js';
import { findSpecialistByWebUserId } from '../repositories/specialistRepository.js';
import { WebUserRole } from '../types/webUserRole.js';
import type { User } from '../types/domain.js';

export type NotificationLogDto = {
  id: number;
  accountId: number;
  userId: number;
  appointmentId: number;
  specialistId: number;
  status: string;
  type: string;
  channel: string;
  attempts: number;
  maxAttempts: number;
  message: string | null;
  specialistName: string | null;
  clientName: string | null;
  recipientTelegram: string | null;
  recipientEmail: string | null;
  lastError: string | null;
  sendAt: string;
  nextRetryAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function resolveNotificationMessage(item: NotificationLogRecord): string | null {
  const payload = item.payload_json;
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const payloadMessage = normalizeString((payload as Record<string, unknown>).message);
  if (payloadMessage) {
    return payloadMessage;
  }

  return normalizeString((payload as Record<string, unknown>).timing);
}

function resolveClientName(item: NotificationLogRecord): string | null {
  const first = item.client_first_name?.trim() ?? '';
  const last = item.client_last_name?.trim() ?? '';
  const full = `${first} ${last}`.trim();
  if (full) {
    return full;
  }

  return item.client_email?.trim() || item.client_username?.trim() || null;
}

function mapLog(item: NotificationLogRecord): NotificationLogDto {
  return {
    id: item.id,
    accountId: item.account_id,
    userId: item.user_id,
    appointmentId: item.appointment_id,
    specialistId: item.specialist_id,
    status: item.status,
    type: item.type,
    channel: item.channel,
    attempts: item.attempts,
    maxAttempts: item.max_attempts,
    message: resolveNotificationMessage(item),
    specialistName: item.specialist_name?.trim() || null,
    clientName: resolveClientName(item),
    recipientTelegram: item.client_username?.trim() || null,
    recipientEmail: item.recipient_email,
    lastError: item.last_error,
    sendAt: item.send_at.toISOString(),
    nextRetryAt: item.next_retry_at ? item.next_retry_at.toISOString() : null,
    sentAt: item.sent_at ? item.sent_at.toISOString() : null,
    createdAt: item.created_at.toISOString(),
    updatedAt: item.updated_at.toISOString(),
  };
}

async function resolveSpecialistScope(actor: User): Promise<number | null> {
  if (actor.role !== WebUserRole.Specialist) {
    return null;
  }

  const specialist = await findSpecialistByWebUserId(actor.accountId, Number(actor.id));
  if (!specialist) {
    throw new Error('SPECIALIST_PROFILE_NOT_FOUND');
  }

  return specialist.id;
}

function resolveAccountScope(actor: User, requestedAccountId?: number): number | null {
  if (actor.role === WebUserRole.Owner) {
    return requestedAccountId ?? null;
  }

  return actor.accountId;
}

export async function getNotificationLogsForActor(
  actor: User,
  filters: { accountId?: number; specialistId?: number; userId?: number },
): Promise<{ items: NotificationLogDto[] }> {
  const specialistScopeId = await resolveSpecialistScope(actor);

  const items = await listNotificationLogs({
    accountId: resolveAccountScope(actor, filters.accountId) ?? undefined,
    specialistId: specialistScopeId ?? filters.specialistId,
    userId: filters.userId,
  });

  return { items: items.map(mapLog) };
}

export async function resendFailedNotificationForActor(actor: User, notificationId: number): Promise<boolean> {
  const specialistScopeId = await resolveSpecialistScope(actor);

  const log = await findNotificationLogById(notificationId);
  if (!log) {
    return false;
  }

  if (!canManageAllAppointments(actor.role) && actor.role !== WebUserRole.Specialist) {
    throw new Error('FORBIDDEN_NOTIFICATION_SCOPE');
  }

  if (actor.role === WebUserRole.Owner) {
    return resetNotificationForResend({ notificationId });
  }

  if (actor.role === WebUserRole.Admin) {
    if (log.account_id !== actor.accountId) {
      throw new Error('FORBIDDEN_NOTIFICATION_SCOPE');
    }

    return resetNotificationForResend({ notificationId, accountId: actor.accountId });
  }

  if (actor.role === WebUserRole.Specialist) {
    if (log.account_id !== actor.accountId || log.specialist_id !== specialistScopeId) {
      throw new Error('FORBIDDEN_NOTIFICATION_SCOPE');
    }

    return resetNotificationForResend({
      notificationId,
      accountId: actor.accountId,
      specialistId: specialistScopeId ?? undefined,
    });
  }

  throw new Error('FORBIDDEN_NOTIFICATION_SCOPE');
}
