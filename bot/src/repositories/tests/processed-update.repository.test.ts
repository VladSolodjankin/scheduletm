import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.hoisted(() => ({
  where: vi.fn(),
  whereNull: vi.fn(),
  orWhere: vi.fn(),
  update: vi.fn(),
  returning: vi.fn(),
  insert: vi.fn(),
  onConflict: vi.fn(),
  ignore: vi.fn(),
  del: vi.fn(),
  first: vi.fn(),
}));

const dbMock = vi.hoisted(() => Object.assign(
  vi.fn(() => queryMock),
  {
    fn: { now: vi.fn(() => '__NOW__') },
  },
));

vi.mock('../../db/knex', () => ({ db: dbMock }));

import {
  acquireTelegramUserLease,
  beginProcessingUpdate,
  markProcessedUpdate,
  releaseProcessingUpdate,
  releaseTelegramUserLease,
} from '../processed-update.repository';

describe('processed update and Telegram user leases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.where.mockImplementation((value: unknown) => {
      if (typeof value === 'function') {
        value.call(queryMock);
      }
      return queryMock;
    });
    queryMock.whereNull.mockReturnValue(queryMock);
    queryMock.orWhere.mockReturnValue(queryMock);
    queryMock.update.mockReturnValue(queryMock);
    queryMock.insert.mockReturnValue(queryMock);
    queryMock.onConflict.mockReturnValue(queryMock);
    queryMock.ignore.mockReturnValue(queryMock);
  });

  it('atomically reclaims a stale update with a new owner token', async () => {
    queryMock.returning.mockResolvedValueOnce([{ update_id: '101' }]);
    const now = new Date('2026-07-30T12:00:00.000Z');

    const claim = await beginProcessingUpdate(101, now);

    expect(claim).toEqual({
      status: 'acquired',
      processingToken: expect.any(String),
    });
    expect(queryMock.where).toHaveBeenCalledWith({
      update_id: '101',
      status: 'processing',
    });
    expect(queryMock.whereNull).toHaveBeenCalledWith('lease_expires_at');
    expect(queryMock.orWhere).toHaveBeenCalledWith('lease_expires_at', '<=', now);
    expect(queryMock.update).toHaveBeenCalledWith(expect.objectContaining({
      processing_token: claim.status === 'acquired' ? claim.processingToken : undefined,
      lease_expires_at: new Date('2026-07-30T12:05:00.000Z'),
    }));
    expect(queryMock.insert).not.toHaveBeenCalled();
  });

  it('distinguishes an active owner from an already processed update', async () => {
    queryMock.returning
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    queryMock.first
      .mockResolvedValueOnce({ status: 'processing' })
      .mockResolvedValueOnce({ status: 'processed' });

    await expect(beginProcessingUpdate(102)).resolves.toEqual({ status: 'active' });
    await expect(beginProcessingUpdate(103)).resolves.toEqual({ status: 'processed' });
  });

  it('fences update completion and release by the current owner token', async () => {
    queryMock.update.mockResolvedValueOnce(0);
    queryMock.del.mockResolvedValueOnce(0);

    await expect(markProcessedUpdate(103, 'stale-owner')).resolves.toBe(false);
    await expect(releaseProcessingUpdate(103, 'stale-owner')).resolves.toBe(false);

    expect(queryMock.where).toHaveBeenCalledWith({
      update_id: '103',
      status: 'processing',
      processing_token: 'stale-owner',
    });
  });

  it('serializes the same Telegram user with a token lease and permits fenced release only', async () => {
    queryMock.returning
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ telegram_user_id: '55' }]);
    queryMock.del
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    const owner = await acquireTelegramUserLease(55, new Date('2026-07-30T12:00:00.000Z'));

    expect(owner).toEqual(expect.any(String));
    expect(queryMock.insert).toHaveBeenCalledWith(expect.objectContaining({
      telegram_user_id: '55',
      processing_token: owner,
    }));
    await expect(releaseTelegramUserLease(55, 'old-owner')).resolves.toBe(false);
    await expect(releaseTelegramUserLease(55, owner as string)).resolves.toBe(true);
    expect(queryMock.where).toHaveBeenCalledWith({
      telegram_user_id: '55',
      processing_token: 'old-owner',
    });
    expect(queryMock.where).toHaveBeenCalledWith({
      telegram_user_id: '55',
      processing_token: owner,
    });
  });
});
