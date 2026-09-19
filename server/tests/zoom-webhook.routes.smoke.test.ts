import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import crypto from 'node:crypto';

process.env.ZOOM_WEBHOOK_SECRET_TOKEN = 'route-test-secret';

const processZoomWebhookEventMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/zoomWebhookService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/zoomWebhookService.js')>(
    '../src/services/zoomWebhookService.js',
  );
  return { ...actual, processZoomWebhookEvent: processZoomWebhookEventMock };
});

const { createApp } = await import('../src/app.js');

function sign(rawBody: string, timestamp: string) {
  const message = `v0:${timestamp}:${rawBody}`;
  const hash = crypto.createHmac('sha256', 'route-test-secret').update(message).digest('hex');
  return `v0=${hash}`;
}

describe('zoom webhook route', () => {
  const app = createApp();
  let baseUrl = '';
  let server: Awaited<ReturnType<typeof app.listen>>;

  beforeAll(async () => {
    server = await new Promise((resolve) => {
      const started = app.listen(0, () => resolve(started));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  beforeEach(() => {
    processZoomWebhookEventMock.mockReset().mockResolvedValue(undefined);
  });

  it('answers the url_validation challenge without requiring a signature', async () => {
    const response = await fetch(`${baseUrl}/api/integrations/zoom/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'endpoint.url_validation', payload: { plainToken: 'abc123' } }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    const expected = crypto.createHmac('sha256', 'route-test-secret').update('abc123').digest('hex');
    expect(body).toEqual({ plainToken: 'abc123', encryptedToken: expected });
    expect(processZoomWebhookEventMock).not.toHaveBeenCalled();
  });

  it('rejects a real event with a missing signature', async () => {
    const response = await fetch(`${baseUrl}/api/integrations/zoom/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'meeting.started', payload: { object: { id: '123' } } }),
    });
    expect(response.status).toBe(401);
    expect(processZoomWebhookEventMock).not.toHaveBeenCalled();
  });

  it('rejects a real event with a wrong signature', async () => {
    const rawBody = JSON.stringify({ event: 'meeting.started', payload: { object: { id: '123' } } });
    const response = await fetch(`${baseUrl}/api/integrations/zoom/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-zm-request-timestamp': String(Date.now()),
        'x-zm-signature': 'v0=deadbeef',
      },
      body: rawBody,
    });
    expect(response.status).toBe(401);
    expect(processZoomWebhookEventMock).not.toHaveBeenCalled();
  });

  it('accepts and processes a correctly signed event', async () => {
    const rawBody = JSON.stringify({ event: 'meeting.started', payload: { object: { id: '123' } } });
    const timestamp = String(Date.now());
    const response = await fetch(`${baseUrl}/api/integrations/zoom/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-zm-request-timestamp': timestamp,
        'x-zm-signature': sign(rawBody, timestamp),
      },
      body: rawBody,
    });
    expect(response.status).toBe(200);
    expect(processZoomWebhookEventMock).toHaveBeenCalledWith(expect.objectContaining({ event: 'meeting.started' }));
  });

  it('still responds 200 when processing throws, so Zoom does not retry forever', async () => {
    processZoomWebhookEventMock.mockRejectedValue(new Error('boom'));
    const rawBody = JSON.stringify({ event: 'meeting.started', payload: { object: { id: '123' } } });
    const timestamp = String(Date.now());
    const response = await fetch(`${baseUrl}/api/integrations/zoom/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-zm-request-timestamp': timestamp,
        'x-zm-signature': sign(rawBody, timestamp),
      },
      body: rawBody,
    });
    expect(response.status).toBe(200);
  });
});
