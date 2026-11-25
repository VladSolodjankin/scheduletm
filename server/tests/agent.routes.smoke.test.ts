import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const resolveUserByAccessToken = vi.hoisted(() => vi.fn());
const agent = vi.hoisted(() => ({
  getLatestAgentConversation: vi.fn(),
  isAgentAvailable: vi.fn(),
  prepareAgentChat: vi.fn(),
  resolveAgentAction: vi.fn(),
  runAgentChat: vi.fn(),
}));
const getAgentUsageToday = vi.hoisted(() => vi.fn());
vi.mock('../src/services/authService.js', () => ({ resolveUserByAccessToken }));
vi.mock('../src/services/agent/agentService.js', async (original) => ({
  ...await original<typeof import('../src/services/agent/agentService.js')>(),
  ...agent,
}));
vi.mock('../src/repositories/agentRepository.js', () => ({ getAgentUsageToday }));

import { AgentError } from '../src/services/agent/agentService.js';

const actor = { id: '5', accountId: 2, email: 'owner@test.dev', role: WebUserRole.Owner, passwordSalt: '', passwordHash: '', createdAt: '' };
const headers = { authorization: 'Bearer token', 'content-type': 'application/json' };
const ACTION = '1f2ec7e3-f737-48f7-af97-ed82f2791bc7';

describe('agent routes', () => {
  const app = createApp();
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;
  const chat = (body: unknown) => fetch(`${baseUrl}/api/agent/chat`, { method: 'POST', headers, body: JSON.stringify(body) });
  beforeAll(async () => {
    server = await new Promise((resolve) => { const started = app.listen(0, () => resolve(started)); });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  beforeEach(() => {
    vi.clearAllMocks();
    resolveUserByAccessToken.mockResolvedValue(actor);
    agent.isAgentAvailable.mockReturnValue(true);
    getAgentUsageToday.mockResolvedValue({ messages: 3 });
  });

  it('requires authentication', async () => {
    expect((await fetch(`${baseUrl}/api/agent/status`)).status).toBe(401);
    const anonymous = await fetch(`${baseUrl}/api/agent/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'hi' }),
    });
    expect(anonymous.status).toBe(401);
  });

  it('reports availability and usage, and hides the assistant from clients', async () => {
    expect(await (await fetch(`${baseUrl}/api/agent/status`, { headers })).json())
      .toEqual({ available: true, dailyLimit: 50, usedToday: 3 });
    resolveUserByAccessToken.mockResolvedValue({ ...actor, role: WebUserRole.Client });
    expect(await (await fetch(`${baseUrl}/api/agent/status`, { headers })).json())
      .toEqual({ available: false, dailyLimit: 50, usedToday: 0 });
  });

  it('validates the chat request', async () => {
    expect((await chat({ message: '   ' })).status).toBe(400);
    expect((await chat({ message: 'hi', conversationId: 'nope' })).status).toBe(400);
    expect((await chat({ message: 'x'.repeat(4001) })).status).toBe(400);
    expect(agent.prepareAgentChat).not.toHaveBeenCalled();
  });

  it.each([
    ['agent_unavailable', 503],
    ['forbidden', 403],
    ['agent_daily_limit', 429],
    ['agent_busy', 409],
    ['conversation_not_found', 404],
  ] as const)('maps %s to HTTP %i before streaming', async (code, status) => {
    agent.prepareAgentChat.mockRejectedValue(new AgentError(code));
    const response = await chat({ message: 'hi' });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ code });
    expect(agent.runAgentChat).not.toHaveBeenCalled();
  });

  it('streams agent events as server-sent events', async () => {
    agent.prepareAgentChat.mockResolvedValue('conv-1');
    agent.runAgentChat.mockImplementation(async ({ emit }) => {
      emit({ type: 'conversation', conversationId: 'conv-1' });
      emit({ type: 'text', delta: 'Привет' });
      emit({ type: 'done' });
    });
    const response = await chat({ message: 'hi' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const events = (await response.text()).split('\n\n').filter(Boolean).map((line) => JSON.parse(line.replace(/^data: /, '')));
    expect(events).toEqual([
      { type: 'conversation', conversationId: 'conv-1' },
      { type: 'text', delta: 'Привет' },
      { type: 'done' },
    ]);
    expect(agent.runAgentChat).toHaveBeenCalledWith(expect.objectContaining({ actor, conversationId: 'conv-1', message: 'hi' }));
  });

  it('reports failures inside the stream without leaking details', async () => {
    agent.prepareAgentChat.mockResolvedValue('conv-1');
    agent.runAgentChat.mockRejectedValue(new Error('secret upstream detail'));
    const text = await (await chat({ message: 'hi' })).text();
    expect(text).toContain('"code":"agent_failed"');
    expect(text).not.toContain('secret');
  });

  it('confirms and rejects proposals', async () => {
    agent.resolveAgentAction.mockResolvedValue({ id: ACTION, status: 'confirmed' });
    const confirm = await fetch(`${baseUrl}/api/agent/actions/${ACTION}/confirm`, { method: 'POST', headers });
    expect(await confirm.json()).toEqual({ action: { id: ACTION, status: 'confirmed' } });
    expect(agent.resolveAgentAction).toHaveBeenCalledWith(actor, ACTION, 'confirm');

    await fetch(`${baseUrl}/api/agent/actions/${ACTION}/reject`, { method: 'POST', headers });
    expect(agent.resolveAgentAction).toHaveBeenLastCalledWith(actor, ACTION, 'reject');

    expect((await fetch(`${baseUrl}/api/agent/actions/not-a-uuid/confirm`, { method: 'POST', headers })).status).toBe(400);
    agent.resolveAgentAction.mockRejectedValue(new AgentError('action_already_resolved'));
    expect((await fetch(`${baseUrl}/api/agent/actions/${ACTION}/confirm`, { method: 'POST', headers })).status).toBe(409);
  });
});
