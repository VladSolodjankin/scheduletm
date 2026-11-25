import { apiClient, apiUrl, authHeaders, tryRefreshAccessToken } from './client';

export type AgentChange = {
  resource: string;
  operation: 'create' | 'update';
  id?: number;
  data: Record<string, unknown>;
  before?: Record<string, unknown> | null;
};

export type AgentAction = {
  id: string;
  summary: string;
  changes: AgentChange[];
  status: 'pending' | 'confirmed' | 'rejected' | 'expired' | 'failed';
  result: { appliedCount?: number; error?: string } | null;
  expiresAt: string;
};

export type AgentHistoryItem =
  | { type: 'user'; text: string }
  | { type: 'assistant'; text: string }
  | { type: 'action'; action: AgentAction }
  | { type: 'section'; section: string; path: string };

export type AgentStreamEvent =
  | { type: 'conversation'; conversationId: string }
  | { type: 'text'; delta: string }
  | { type: 'tool'; name: string }
  | { type: 'pending_action'; action: AgentAction }
  | { type: 'section'; section: string; path: string }
  | { type: 'done' }
  | { type: 'error'; code: string };

export type AgentStatus = { available: boolean; dailyLimit: number; usedToday: number };

export class AgentRequestError extends Error {
  constructor(public code: string) { super(code); }
}

export const agentApi = {
  status: async (accessToken: string) =>
    (await apiClient.get<AgentStatus>('/api/agent/status', { headers: authHeaders(accessToken) })).data,
  latest: async (accessToken: string) =>
    (await apiClient.get<{ conversation: { conversationId: string; items: AgentHistoryItem[] } | null }>(
      '/api/agent/conversations/latest', { headers: authHeaders(accessToken) },
    )).data.conversation,
  resolve: async (accessToken: string, actionId: string, decision: 'confirm' | 'reject') =>
    (await apiClient.post<{ action: AgentAction }>(
      `/api/agent/actions/${actionId}/${decision}`, {}, { headers: authHeaders(accessToken) },
    )).data.action,
};

/**
 * Sends a message and reads the answer as server-sent events. Uses fetch because axios cannot stream
 * in the browser, so the expired-token retry that axios does elsewhere is done here by hand.
 */
export async function streamAgentChat(input: {
  accessToken: string;
  conversationId: string | null;
  message: string;
  signal: AbortSignal;
  onEvent: (event: AgentStreamEvent) => void;
}): Promise<void> {
  const send = (token: string) => fetch(apiUrl('/api/agent/chat'), {
    method: 'POST',
    credentials: 'include',
    signal: input.signal,
    headers: { ...authHeaders(token), 'content-type': 'application/json' },
    body: JSON.stringify({ message: input.message, ...(input.conversationId ? { conversationId: input.conversationId } : {}) }),
  });

  let response = await send(input.accessToken);
  if (response.status === 401) {
    const refreshed = await tryRefreshAccessToken();
    if (!refreshed) {throw new AgentRequestError('session_expired');}
    response = await send(refreshed);
  }
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => ({})) as { code?: string };
    throw new AgentRequestError(body.code ?? (response.status === 401 ? 'session_expired' : 'agent_failed'));
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) {break;}
    buffer += value;
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = frame.split('\n').filter((line) => line.startsWith('data: ')).map((line) => line.slice(6)).join('\n');
      if (data) {input.onEvent(JSON.parse(data) as AgentStreamEvent);}
      boundary = buffer.indexOf('\n\n');
    }
  }
}
