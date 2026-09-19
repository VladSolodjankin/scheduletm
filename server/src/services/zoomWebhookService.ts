import crypto from 'node:crypto';
import { env } from '../config/env.js';
import {
  createAppointmentAuditEvent,
  findAppointmentByZoomMeetingIdAnyAccount,
  updateAppointment,
} from '../repositories/appointmentRepository.js';
import {
  beginProcessingZoomWebhookEvent,
  markProcessedZoomWebhookEvent,
  releaseProcessingZoomWebhookEvent,
} from '../repositories/zoomWebhookEventRepository.js';

const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

export type ZoomWebhookPayload = {
  event?: string;
  event_ts?: number;
  payload?: {
    object?: {
      id?: string | number;
      uuid?: string;
    };
  };
};

export function isZoomWebhookConfigured(): boolean {
  return Boolean(env.ZOOM_WEBHOOK_SECRET_TOKEN);
}

export function verifyZoomWebhookSignature(input: {
  rawBody: Buffer;
  timestampHeader: string | undefined;
  signatureHeader: string | undefined;
}): boolean {
  if (!input.timestampHeader || !input.signatureHeader) {
    return false;
  }

  const timestamp = Number(input.timestampHeader);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > SIGNATURE_MAX_AGE_MS) {
    return false;
  }

  const message = `v0:${input.timestampHeader}:${input.rawBody.toString('utf8')}`;
  const expectedHash = crypto.createHmac('sha256', env.ZOOM_WEBHOOK_SECRET_TOKEN).update(message).digest('hex');
  const expected = `v0=${expectedHash}`;

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(input.signatureHeader);
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export function buildZoomUrlValidationResponse(plainToken: string): { plainToken: string; encryptedToken: string } {
  const encryptedToken = crypto.createHmac('sha256', env.ZOOM_WEBHOOK_SECRET_TOKEN).update(plainToken).digest('hex');
  return { plainToken, encryptedToken };
}

function buildEventId(input: ZoomWebhookPayload): string {
  const objectKey = input.payload?.object?.uuid ?? input.payload?.object?.id ?? '';
  const raw = `${input.event ?? ''}:${objectKey}:${input.event_ts ?? ''}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function dispatchZoomWebhookEvent(input: ZoomWebhookPayload): Promise<void> {
  const meetingId = input.payload?.object?.id;
  if (meetingId === undefined) {
    return;
  }

  const appointment = await findAppointmentByZoomMeetingIdAnyAccount(String(meetingId));
  if (!appointment) {
    return;
  }

  const now = new Date();

  if (input.event === 'meeting.started') {
    await updateAppointment({ accountId: appointment.account_id, id: appointment.id, zoomMeetingStartedAt: now });
    return;
  }

  if (input.event === 'meeting.ended') {
    await updateAppointment({ accountId: appointment.account_id, id: appointment.id, zoomMeetingEndedAt: now });
    return;
  }

  if (input.event === 'meeting.deleted' && appointment.status !== 'cancelled') {
    await updateAppointment({ accountId: appointment.account_id, id: appointment.id, status: 'cancelled' });
    await createAppointmentAuditEvent({
      accountId: appointment.account_id,
      appointmentId: appointment.id,
      action: 'cancel',
      actorWebUserId: null,
      metadata: { source: 'zoom_webhook', event: input.event },
    });
  }
}

export async function processZoomWebhookEvent(input: ZoomWebhookPayload): Promise<void> {
  const eventId = buildEventId(input);
  const claim = await beginProcessingZoomWebhookEvent(eventId);
  if (claim.status !== 'acquired') {
    return;
  }

  try {
    await dispatchZoomWebhookEvent(input);
    await markProcessedZoomWebhookEvent(eventId, claim.processingToken);
  } catch (error) {
    await releaseProcessingZoomWebhookEvent(eventId, claim.processingToken);
    throw error;
  }
}
