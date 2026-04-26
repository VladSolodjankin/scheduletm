import type { AppointmentRecord } from '../repositories/appointmentRepository.js';
import { findSpecialistById } from '../repositories/specialistRepository.js';
import { sendAppointmentNotificationEmail } from './emailDeliveryService.js';
import {
  getAccountNotificationDefaults,
  type NotificationType,
} from './notificationSettingsService.js';

function resolveClientName(appointment: AppointmentRecord): string {
  return `${appointment.client_first_name ?? ''} ${appointment.client_last_name ?? ''}`.trim() || 'Клиент';
}

export async function sendAppointmentNotificationByType(input: {
  accountId: number;
  appointment: AppointmentRecord;
  notificationType: NotificationType;
  force?: boolean;
}): Promise<{ delivered: boolean; channel: 'email' | null; reason?: string }> {
  const email = input.appointment.client_email?.trim() ?? '';
  if (!email) {
    return { delivered: false, channel: null, reason: 'missing_email' };
  }

  if (!input.force) {
    const defaults = await getAccountNotificationDefaults(input.accountId);
    const active = defaults.find((item) => item.notificationType === input.notificationType);

    if (!active?.enabled) {
      return { delivered: false, channel: null, reason: 'disabled' };
    }

    if (active.preferredChannel !== 'email') {
      return { delivered: false, channel: null, reason: 'unsupported_channel' };
    }
  }

  const specialist = await findSpecialistById(input.accountId, input.appointment.specialist_id);
  const delivered = await sendAppointmentNotificationEmail({
    to: email,
    clientName: resolveClientName(input.appointment),
    specialistName: specialist?.name ?? 'специалист',
    scheduledAt: input.appointment.appointment_at.toISOString(),
  });

  return delivered
    ? { delivered: true, channel: 'email' }
    : { delivered: false, channel: null, reason: 'delivery_failed' };
}
