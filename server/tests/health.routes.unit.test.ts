import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbRawMock = vi.hoisted(() => vi.fn());

vi.mock('../src/db/knex.js', () => ({
  db: {
    raw: dbRawMock,
  },
}));

const { healthRoutes } = await import('../src/routes/healthRoutes.js');

describe('health routes', () => {
  beforeEach(() => {
    dbRawMock.mockReset().mockResolvedValue({});
  });

  const request = async (path: string) => {
    const app = express();
    app.use(healthRoutes);
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Test server did not bind to a TCP port');
    }

    try {
      return await fetch(`http://127.0.0.1:${address.port}${path}`);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };

  it('keeps /health as a liveness check without probing the database', async () => {
    const response = await request('/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(dbRawMock).not.toHaveBeenCalled();
  });

  it('returns 200 from /ready when the database probe succeeds', async () => {
    const response = await request('/ready');

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(dbRawMock).toHaveBeenCalledWith('select 1');
  });

  it('returns a detail-free 503 from /ready when the database probe fails', async () => {
    dbRawMock.mockRejectedValue(new Error('password authentication failed for db-host'));

    const response = await request('/ready');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false });
  });
});
