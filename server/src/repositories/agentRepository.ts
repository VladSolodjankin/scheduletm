import crypto from 'node:crypto';
import { db } from '../db/knex.js';

export type AgentMessageRole = 'user' | 'assistant';
export type AgentActionStatus = 'pending' | 'confirmed' | 'rejected' | 'expired' | 'failed';

export type AgentConversationRecord = { id: string; updated_at: Date };
export type AgentMessageRecord = { id: string; role: AgentMessageRole; content: unknown; created_at: Date };
export type AgentPendingActionRecord = {
  id: string;
  conversation_id: string;
  changes: unknown;
  status: AgentActionStatus;
  result: unknown;
  expires_at: Date;
  created_at: Date;
};

const owner = (accountId: number, webUserId: number) => ({ account_id: accountId, web_user_id: webUserId });

export async function createAgentConversation(accountId: number, webUserId: number): Promise<string> {
  const id = crypto.randomUUID();
  await db('agent_conversations').insert({ id, ...owner(accountId, webUserId) });
  return id;
}

export async function findAgentConversation(
  accountId: number,
  webUserId: number,
  conversationId: string,
): Promise<AgentConversationRecord | null> {
  const row = await db('agent_conversations').where({ id: conversationId, ...owner(accountId, webUserId) })
    .first('id', 'updated_at');
  return row ?? null;
}

export async function findLatestAgentConversation(accountId: number, webUserId: number): Promise<AgentConversationRecord | null> {
  const row = await db('agent_conversations').where(owner(accountId, webUserId))
    .orderBy('updated_at', 'desc').first('id', 'updated_at');
  return row ?? null;
}

export async function listAgentMessages(conversationId: string): Promise<AgentMessageRecord[]> {
  return db('agent_messages').where('conversation_id', conversationId).orderBy('id', 'asc')
    .select('id', 'role', 'content', 'created_at');
}

export async function countAgentMessages(conversationId: string): Promise<number> {
  const row = await db('agent_messages').where('conversation_id', conversationId).count<{ count: string }[]>('* as count').first();
  return Number(row?.count ?? 0);
}

export async function insertAgentMessage(conversationId: string, role: AgentMessageRole, content: unknown): Promise<void> {
  await db.transaction(async (trx) => {
    await trx('agent_messages').insert({ conversation_id: conversationId, role, content: JSON.stringify(content) });
    await trx('agent_conversations').where('id', conversationId).update({ updated_at: trx.fn.now() });
  });
}

export async function createAgentPendingAction(input: {
  accountId: number;
  webUserId: number;
  conversationId: string;
  changes: unknown;
  ttlMinutes: number;
}): Promise<AgentPendingActionRecord> {
  const [row] = await db('agent_pending_actions').insert({
    id: crypto.randomUUID(),
    ...owner(input.accountId, input.webUserId),
    conversation_id: input.conversationId,
    changes: JSON.stringify(input.changes),
    expires_at: db.raw(`now() + ?::int * interval '1 minute'`, [input.ttlMinutes]),
  }).returning(['id', 'conversation_id', 'changes', 'status', 'result', 'expires_at', 'created_at']);
  return row;
}

export async function findAgentPendingAction(
  accountId: number,
  webUserId: number,
  actionId: string,
): Promise<AgentPendingActionRecord | null> {
  const row = await db('agent_pending_actions').where({ id: actionId, ...owner(accountId, webUserId) })
    .first('id', 'conversation_id', 'changes', 'status', 'result', 'expires_at', 'created_at');
  return row ?? null;
}

export async function listAgentPendingActions(conversationId: string): Promise<AgentPendingActionRecord[]> {
  return db('agent_pending_actions').where('conversation_id', conversationId).orderBy('created_at', 'asc')
    .select('id', 'conversation_id', 'changes', 'status', 'result', 'expires_at', 'created_at');
}

/** Atomically moves a still-valid pending action out of `pending`, so a double click cannot apply it twice. */
export async function claimAgentPendingAction(actionId: string, status: 'confirmed' | 'rejected'): Promise<boolean> {
  const updated = await db('agent_pending_actions')
    .where({ id: actionId, status: 'pending' })
    .where('expires_at', '>', db.fn.now())
    .update({ status, resolved_at: db.fn.now() });
  return updated > 0;
}

export async function expireAgentPendingAction(actionId: string): Promise<void> {
  await db('agent_pending_actions').where({ id: actionId, status: 'pending' })
    .update({ status: 'expired', resolved_at: db.fn.now() });
}

export async function finishAgentPendingAction(actionId: string, status: 'confirmed' | 'failed', result: unknown): Promise<void> {
  await db('agent_pending_actions').where('id', actionId).update({ status, result: JSON.stringify(result) });
}

/** Resolved or expired actions whose outcome the model has not been told about yet. Marks them reported. */
export async function takeUnreportedAgentActionOutcomes(conversationId: string): Promise<AgentPendingActionRecord[]> {
  return db.transaction(async (trx) => {
    await trx('agent_pending_actions')
      .where({ conversation_id: conversationId, status: 'pending' })
      .where('expires_at', '<=', trx.fn.now())
      .update({ status: 'expired', resolved_at: trx.fn.now() });
    const rows: AgentPendingActionRecord[] = await trx('agent_pending_actions')
      .where('conversation_id', conversationId)
      .whereNot('status', 'pending')
      .whereNull('reported_at')
      .update({ reported_at: trx.fn.now() })
      .returning(['id', 'conversation_id', 'changes', 'status', 'result', 'expires_at', 'created_at']);
    return rows;
  });
}

export async function getAgentUsageToday(accountId: number): Promise<{ messages: number }> {
  const row = await db('agent_usage_daily').where({ account_id: accountId, usage_date: db.raw('current_date') })
    .first('messages');
  return { messages: Number(row?.messages ?? 0) };
}

export async function addAgentUsage(
  accountId: number,
  usage: { inputTokens: number; outputTokens: number; messages: number },
): Promise<void> {
  await db.raw(
    `insert into agent_usage_daily (account_id, usage_date, input_tokens, output_tokens, messages)
     values (?, current_date, ?, ?, ?)
     on conflict (account_id, usage_date) do update set
       input_tokens = agent_usage_daily.input_tokens + excluded.input_tokens,
       output_tokens = agent_usage_daily.output_tokens + excluded.output_tokens,
       messages = agent_usage_daily.messages + excluded.messages`,
    [accountId, usage.inputTokens, usage.outputTokens, usage.messages],
  );
}
