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
  recipientEmail: string | null;
  lastError: string | null;
  sendAt: string;
  nextRetryAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

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
