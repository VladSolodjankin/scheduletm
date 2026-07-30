import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.hoisted(() => {
  const query = {
    where: vi.fn(),
    whereIn: vi.fn(),
    whereNull: vi.fn(),
    orWhere: vi.fn(),
    andWhere: vi.fn(),
    update: vi.fn(),
    returning: vi.fn(),
    forUpdate: vi.fn(),
    first: vi.fn(),
  };
  for (const method of ['where', 'whereIn', 'whereNull', 'orWhere', 'andWhere', 'forUpdate'] as const) {
    query[method].mockReturnValue(query);
  }
  return query;
});

const dbMock = vi.hoisted(() => Object.assign(
  vi.fn(() => queryMock),
  {
    ref: vi.fn((value: string) => value),
    fn: { now: vi.fn() },
    transaction: vi.fn(),
  },
));

vi.mock('../src/db/knex.js', () => ({ db: dbMock }));

import {
  claimNotificationForDelivery,
  heartbeatNotificationProcessing,
  markNotificationDeliveryFailure,
  markNotificationSent,
} from '../src/repositories/notificationRepository.js';

describe('notification repository claim lease', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.where.mockImplementation((...args: unknown[]) => {
      if (typeof args[0] === 'function') {
        (args[0] as (builder: typeof queryMock) => void)(queryMock);
      }
      return queryMock;
    });
    queryMock.andWhere.mockImplementation((...args: unknown[]) => {
      if (typeof args[0] === 'function') {
        (args[0] as (builder: typeof queryMock) => void)(queryMock);
      }
      return queryMock;
    });
    queryMock.orWhere.mockImplementation((...args: unknown[]) => {
      if (typeof args[0] === 'function') {
        (args[0] as (builder: typeof queryMock) => void)(queryMock);
      }
      return queryMock;
    });
    queryMock.whereIn.mockReturnValue(queryMock);
    queryMock.whereNull.mockReturnValue(queryMock);
    queryMock.forUpdate.mockReturnValue(queryMock);
    queryMock.update.mockReturnValue(queryMock);
    dbMock.transaction.mockImplementation(async (callback: (trx: typeof dbMock) => Promise<unknown>) => callback(dbMock));
  });

  it('atomically allows due queued work or stale processing work, but not a fresh lease', async () => {
    queryMock.returning.mockResolvedValue([{ processing_token: 'new-owner-token' }]);
    const now = new Date('2026-04-26T12:00:00.000Z');

    await expect(claimNotificationForDelivery({ notificationId: 42, now })).resolves.toBe('new-owner-token');

    expect(queryMock.where).toHaveBeenCalledWith('id', 42);
    expect(queryMock.where).toHaveBeenCalledWith('attempts', '<', 'max_attempts');
    expect(queryMock.whereIn).toHaveBeenCalledWith('status', ['pending', 'retry']);
    expect(queryMock.where).toHaveBeenCalledWith('status', 'processing');
    expect(queryMock.andWhere).toHaveBeenCalledWith(
      'updated_at',
      '<=',
      new Date('2026-04-26T11:45:00.000Z'),
    );
    expect(queryMock.update).toHaveBeenCalledWith({
      status: 'processing',
      processing_token: expect.any(String),
      updated_at: now,
    });
  });

  it('returns null when a fresh processing lease prevents the atomic claim', async () => {
    queryMock.returning.mockResolvedValue([]);

    await expect(claimNotificationForDelivery({
      notificationId: 42,
      now: new Date('2026-04-26T12:00:00.000Z'),
    })).resolves.toBeNull();
  });

  it('heartbeats only the matching processing owner', async () => {
    queryMock.update.mockResolvedValueOnce(1);

    await expect(heartbeatNotificationProcessing({
      notificationId: 42,
      processingToken: 'current-owner',
      now: new Date('2026-04-26T12:05:00.000Z'),
    })).resolves.toBe(true);

    expect(queryMock.where).toHaveBeenCalledWith({
      id: 42,
      status: 'processing',
      processing_token: 'current-owner',
    });
  });

  it('rejects stale-owner completion and keeps the newer claim untouched', async () => {
    queryMock.update.mockResolvedValueOnce(0);

    await expect(markNotificationSent({
      notificationId: 42,
      processingToken: 'stale-owner',
      recipientEmail: 'client@test.com',
    })).resolves.toBe(false);

    expect(queryMock.where).toHaveBeenCalledWith({
      id: 42,
      status: 'processing',
      processing_token: 'stale-owner',
    });
    expect(queryMock.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'sent',
      processing_token: null,
    }));
  });

  it('increments attempts and clears ownership only for the matching failed worker', async () => {
    queryMock.first.mockResolvedValueOnce({ attempts: 1, max_attempts: 3 });
    queryMock.update.mockResolvedValueOnce(1);

    await expect(markNotificationDeliveryFailure({
      notificationId: 42,
      processingToken: 'current-owner',
      error: 'delivery_failed',
      now: new Date('2026-04-26T12:00:00.000Z'),
    })).resolves.toBe(true);

    expect(queryMock.update).toHaveBeenCalledWith(expect.objectContaining({
      attempts: 2,
      status: 'retry',
      processing_token: null,
      next_retry_at: new Date('2026-04-26T12:15:00.000Z'),
    }));
  });
});
