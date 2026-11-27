import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const resolveUserByAccessToken = vi.hoisted(() => vi.fn());
const agent = vi.hoisted(() => ({
  getAgentConversation: vi.fn(),
  getAgentSetupStatus: vi.fn(),
  isAgentAvailable: vi.fn(),
  listAgentConversationSummaries: vi.fn(),
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
      .toEqual({ available: true, dailyLimit: 50, usedToday: 3, conversationMessageLimit: 10 });
    resolveUserByAccessToken.mockResolvedValue({ ...actor, role: WebUserRole.Client });
    expect(await (await fetch(`${baseUrl}/api/agent/status`, { headers })).json())
      .toEqual({ available: false, dailyLimit: 50, usedToday: 0, conversationMessageLimit: 10 });
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
    ['conversation_limit', 409],
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

  it('validates attachments before streaming', async () => {
    agent.prepareAgentChat.mockResolvedValue('conv-1');
    const attachment = (patch: Record<string, unknown>) => ({ name: 'a.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQ=', ...patch });
    expect((await chat({ message: '' })).status).toBe(400);
    expect((await chat({ message: 'hi', attachments: [attachment({}), attachment({}), attachment({}), attachment({})] })).status).toBe(400);

    const cases = [
      [attachment({ mimeType: 'text/plain' }), 415, 'unsupported_attachment'],
      [attachment({ data: Buffer.from('not a pdf').toString('base64') }), 415, 'unsupported_attachment'],
      [attachment({ data: '***' }), 400, 'invalid_attachment'],
      [attachment({ mimeType: 'image/png', data: Buffer.alloc(5 * 1024 * 1024 + 3).toString('base64') }), 413, 'attachment_too_large'],
    ] as const;
    for (const [file, status, code] of cases) {
      const response = await chat({ message: '', attachments: [file] });
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ code });
    }
    expect(agent.runAgentChat).not.toHaveBeenCalled();
  });

  it('rejects request bodies over the chat limit', async () => {
    const response = await chat({ message: '', attachments: [{ name: 'a.pdf', mimeType: 'application/pdf', data: 'A'.repeat(17 * 1024 * 1024) }] });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ code: 'attachment_too_large' });
  });

  it('passes checked attachments to the agent', async () => {
    agent.prepareAgentChat.mockResolvedValue('conv-1');
    agent.runAgentChat.mockImplementation(async ({ emit }) => emit({ type: 'done' }));
    const data = Buffer.from('%PDF-1.4').toString('base64');
    const response = await chat({ message: '', attachments: [{ name: 'menu.pdf', mimeType: 'application/pdf', data }] });
    expect(response.status).toBe(200);
    await response.text();
    expect(agent.runAgentChat).toHaveBeenCalledWith(expect.objectContaining({
      message: '', attachments: [{ name: 'menu.pdf', kind: 'pdf', mediaType: 'application/pdf', data }],
    }));
  });

  it('reports setup status and refuses clients', async () => {
    const status = { steps: [{ key: 'services', done: false, optional: false, path: '/services' }], remaining: 1 };
    agent.getAgentSetupStatus.mockResolvedValue(status);
    const response = await fetch(`${baseUrl}/api/agent/setup-status`, { headers });
    expect(await response.json()).toEqual(status);
    expect(agent.getAgentSetupStatus).toHaveBeenCalledWith(actor);

    agent.getAgentSetupStatus.mockRejectedValue(new AgentError('forbidden'));
    const forbidden = await fetch(`${baseUrl}/api/agent/setup-status`, { headers });
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({ code: 'forbidden' });
    expect((await fetch(`${baseUrl}/api/agent/setup-status`)).status).toBe(401);
  });

  it('lists past chats and opens one by id', async () => {
    const CONVERSATION = '6f0d3c1e-2d55-4b1f-9a51-0f4c5b7e8a10';
    agent.listAgentConversationSummaries.mockResolvedValue([{ id: CONVERSATION, title: 'Прайс' }]);
    const list = await fetch(`${baseUrl}/api/agent/conversations`, { headers });
    expect(await list.json()).toEqual({ conversations: [{ id: CONVERSATION, title: 'Прайс' }] });
    expect(agent.listAgentConversationSummaries).toHaveBeenCalledWith(actor);

    agent.getAgentConversation.mockResolvedValue({ conversationId: CONVERSATION, items: [], userMessageCount: 0, messageLimit: 10 });
    const one = await fetch(`${baseUrl}/api/agent/conversations/${CONVERSATION}`, { headers });
    expect(await one.json()).toEqual({ conversation: { conversationId: CONVERSATION, items: [], userMessageCount: 0, messageLimit: 10 } });
    expect(agent.getAgentConversation).toHaveBeenCalledWith(actor, CONVERSATION);

    expect((await fetch(`${baseUrl}/api/agent/conversations/nope`, { headers })).status).toBe(400);
    agent.getAgentConversation.mockRejectedValue(new AgentError('conversation_not_found'));
    expect((await fetch(`${baseUrl}/api/agent/conversations/${CONVERSATION}`, { headers })).status).toBe(404);
    expect((await fetch(`${baseUrl}/api/agent/conversations`)).status).toBe(401);
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
