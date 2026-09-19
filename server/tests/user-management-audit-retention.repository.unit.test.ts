import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.hoisted(() => ({
  insert: vi.fn(),
  where: vi.fn(),
  delete: vi.fn(),
}));
const dbMock = vi.hoisted(() => vi.fn(() => queryMock));

vi.mock('../src/db/knex.js', () => ({ db: dbMock }));

const { createUserManagementAuditEvent, purgeUserManagementEventsCreatedBefore } = await import(
  '../src/repositories/userManagementAuditRepository.js'
);

describe('user management audit repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.insert.mockResolvedValue(undefined);
    queryMock.where.mockReturnValue(queryMock);
    queryMock.delete.mockResolvedValue(4);
  });

  it('inserts an audit event with serialized metadata', async () => {
    await createUserManagementAuditEvent({
      accountId: 1,
      targetWebUserId: 20,
      actorWebUserId: 100,
      action: 'role_change',
      metadata: { fromRole: 'client', toRole: 'specialist' },
    });

    expect(dbMock).toHaveBeenCalledWith('user_management_events');
    expect(queryMock.insert).toHaveBeenCalledWith({
      account_id: 1,
      target_web_user_id: 20,
      actor_web_user_id: 100,
      action: 'role_change',
      metadata_json: JSON.stringify({ fromRole: 'client', toRole: 'specialist' }),
    });
  });

  it('deletes only user_management_events strictly before the supplied cutoff', async () => {
    const cutoff = new Date('2025-07-30T12:00:00.000Z');
    await expect(purgeUserManagementEventsCreatedBefore(cutoff)).resolves.toBe(4);

    expect(dbMock).toHaveBeenCalledWith('user_management_events');
    expect(queryMock.where).toHaveBeenCalledWith('created_at', '<', cutoff);
    expect(queryMock.delete).toHaveBeenCalledOnce();
  });
});
