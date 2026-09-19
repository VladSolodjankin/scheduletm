import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';

const findAppointmentByZoomMeetingIdAnyAccountMock = vi.hoisted(() => vi.fn());
const updateAppointmentMock = vi.hoisted(() => vi.fn());
const createAppointmentAuditEventMock = vi.hoisted(() => vi.fn());
const beginProcessingMock = vi.hoisted(() => vi.fn());
const markProcessedMock = vi.hoisted(() => vi.fn());
const releaseProcessingMock = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/appointmentRepository.js', () => ({
  findAppointmentByZoomMeetingIdAnyAccount: findAppointmentByZoomMeetingIdAnyAccountMock,
  updateAppointment: updateAppointmentMock,
  createAppointmentAuditEvent: createAppointmentAuditEventMock,
}));

vi.mock('../src/repositories/zoomWebhookEventRepository.js', () => ({
  beginProcessingZoomWebhookEvent: beginProcessingMock,
  markProcessedZoomWebhookEvent: markProcessedMock,
  releaseProcessingZoomWebhookEvent: releaseProcessingMock,
}));

process.env.ZOOM_WEBHOOK_SECRET_TOKEN = 'test-secret-token';

const {
  isZoomWebhookConfigured,
  verifyZoomWebhookSignature,
  buildZoomUrlValidationResponse,
  processZoomWebhookEvent,
} = await import('../src/services/zoomWebhookService.js');

describe('zoom webhook service', () => {
  beforeEach(() => {
    findAppointmentByZoomMeetingIdAnyAccountMock.mockReset();
    updateAppointmentMock.mockReset().mockResolvedValue(undefined);
    createAppointmentAuditEventMock.mockReset().mockResolvedValue(undefined);
    beginProcessingMock.mockReset().mockResolvedValue({ status: 'acquired', processingToken: 'token-1' });
    markProcessedMock.mockReset().mockResolvedValue(true);
    releaseProcessingMock.mockReset().mockResolvedValue(true);
  });

  it('reports configured only when the secret token is set', () => {
    expect(isZoomWebhookConfigured()).toBe(true);
  });

  it('computes the url-validation challenge response with HMAC-SHA256 of the plain token', () => {
    const response = buildZoomUrlValidationResponse('abc123');
    const expected = crypto.createHmac('sha256', 'test-secret-token').update('abc123').digest('hex');
    expect(response).toEqual({ plainToken: 'abc123', encryptedToken: expected });
  });

  it('accepts a correctly signed, fresh request', () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'meeting.started' }));
    const timestamp = String(Date.now());
    const message = `v0:${timestamp}:${rawBody.toString('utf8')}`;
    const signature = `v0=${crypto.createHmac('sha256', 'test-secret-token').update(message).digest('hex')}`;

    expect(verifyZoomWebhookSignature({
      rawBody,
      timestampHeader: timestamp,
      signatureHeader: signature,
    })).toBe(true);
  });

  it('rejects a request with a tampered signature', () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'meeting.started' }));
    expect(verifyZoomWebhookSignature({
      rawBody,
      timestampHeader: String(Date.now()),
      signatureHeader: 'v0=not-the-right-hash',
    })).toBe(false);
  });

  it('rejects a stale timestamp even with a technically-recomputable signature', () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'meeting.started' }));
    const staleTimestamp = String(Date.now() - 10 * 60 * 1000);
    const message = `v0:${staleTimestamp}:${rawBody.toString('utf8')}`;
    const signature = `v0=${crypto.createHmac('sha256', 'test-secret-token').update(message).digest('hex')}`;

    expect(verifyZoomWebhookSignature({
      rawBody,
      timestampHeader: staleTimestamp,
      signatureHeader: signature,
    })).toBe(false);
  });

  it('marks the meeting started time on the matching appointment', async () => {
    findAppointmentByZoomMeetingIdAnyAccountMock.mockResolvedValue({
      id: 10, account_id: 1, status: 'confirmed',
    });

    await processZoomWebhookEvent({
      event: 'meeting.started',
      event_ts: 1,
      payload: { object: { id: '123456789' } },
    });

    expect(updateAppointmentMock).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 1, id: 10, zoomMeetingStartedAt: expect.any(Date),
    }));
    expect(markProcessedMock).toHaveBeenCalledOnce();
  });

  it('cancels the appointment and writes an audit event on meeting.deleted', async () => {
    findAppointmentByZoomMeetingIdAnyAccountMock.mockResolvedValue({
      id: 10, account_id: 1, status: 'confirmed',
    });

    await processZoomWebhookEvent({
      event: 'meeting.deleted',
      event_ts: 1,
      payload: { object: { id: '123456789' } },
    });

    expect(updateAppointmentMock).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 1, id: 10, status: 'cancelled',
    }));
    expect(createAppointmentAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 1, appointmentId: 10, action: 'cancel', actorWebUserId: null,
    }));
  });

  it('does not re-cancel an already-cancelled appointment', async () => {
    findAppointmentByZoomMeetingIdAnyAccountMock.mockResolvedValue({
      id: 10, account_id: 1, status: 'cancelled',
    });

    await processZoomWebhookEvent({
      event: 'meeting.deleted',
      event_ts: 1,
      payload: { object: { id: '123456789' } },
    });

    expect(updateAppointmentMock).not.toHaveBeenCalled();
    expect(createAppointmentAuditEventMock).not.toHaveBeenCalled();
  });

  it('is a no-op when no appointment matches the zoom meeting id', async () => {
    findAppointmentByZoomMeetingIdAnyAccountMock.mockResolvedValue(null);

    await processZoomWebhookEvent({
      event: 'meeting.started',
      event_ts: 1,
      payload: { object: { id: '999' } },
    });

    expect(updateAppointmentMock).not.toHaveBeenCalled();
    expect(markProcessedMock).toHaveBeenCalledOnce();
  });

  it('skips processing entirely for a duplicate/already-active delivery', async () => {
    beginProcessingMock.mockResolvedValue({ status: 'processed' });

    await processZoomWebhookEvent({
      event: 'meeting.started',
      event_ts: 1,
      payload: { object: { id: '123' } },
    });

    expect(findAppointmentByZoomMeetingIdAnyAccountMock).not.toHaveBeenCalled();
    expect(markProcessedMock).not.toHaveBeenCalled();
  });

  it('releases the lease instead of marking processed when dispatch throws', async () => {
    findAppointmentByZoomMeetingIdAnyAccountMock.mockRejectedValue(new Error('db down'));

    await expect(processZoomWebhookEvent({
      event: 'meeting.started',
      event_ts: 1,
      payload: { object: { id: '123' } },
    })).rejects.toThrow('db down');

    expect(releaseProcessingMock).toHaveBeenCalledWith(expect.any(String), 'token-1');
    expect(markProcessedMock).not.toHaveBeenCalled();
  });
});
