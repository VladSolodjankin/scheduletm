import { db } from '../db/knex.js';

export type UserManagementAuditAction = 'create' | 'role_change' | 'deactivate' | 'delete';

export async function createUserManagementAuditEvent(input: {
  accountId: number;
  targetWebUserId: number;
  actorWebUserId: number | null;
  action: UserManagementAuditAction;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db('user_management_events').insert({
    account_id: input.accountId,
    target_web_user_id: input.targetWebUserId,
    actor_web_user_id: input.actorWebUserId,
    action: input.action,
    metadata_json: input.metadata ? JSON.stringify(input.metadata) : null,
  });
}

export async function purgeUserManagementEventsCreatedBefore(cutoff: Date): Promise<number> {
  return db('user_management_events')
    .where('created_at', '<', cutoff)
    .delete();
}
