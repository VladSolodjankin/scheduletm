import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebUserRole } from '../src/types/webUserRole.js';

vi.mock('../src/config/env.js', async (original) => ({
  env: { ...(await original<typeof import('../src/config/env.js')>()).env, ANTHROPIC_API_KEY: 'test-key' },
}));

// Scripted model: each call to messages.stream returns the next prepared response.
const model = vi.hoisted(() => ({ responses: [] as unknown[], requests: [] as Array<Record<string, unknown>> }));
vi.mock('@anthropic-ai/sdk', () => {
  class FakeAnthropic {
    messages = {
      stream: (params: Record<string, unknown>) => {
        model.requests.push(structuredClone(params));
        const response = model.responses.shift() as { content: Array<{ type: string; text?: string }> };
        const listeners: Array<(delta: string) => void> = [];
        return {
          on: (_event: string, listener: (delta: string) => void) => { listeners.push(listener); },
          finalMessage: async () => {
            for (const block of response.content) if (block.type === 'text') listeners.forEach((listener) => listener(block.text!));
            return response;
          },
        };
      },
    };
  }
  return { default: FakeAnthropic };
});

const store = vi.hoisted(() => ({ messages: [] as Array<{ id: string; role: string; content: unknown }>, actions: new Map<string, Record<string, unknown>>() }));
const repository = vi.hoisted(() => ({
  addAgentUsage: vi.fn(),
  claimAgentPendingAction: vi.fn(),
  countAgentMessages: vi.fn(),
  createAgentConversation: vi.fn(),
  createAgentPendingAction: vi.fn(),
  expireAgentPendingAction: vi.fn(),
  findAgentConversation: vi.fn(),
  findAgentPendingAction: vi.fn(),
  findLatestAgentConversation: vi.fn(),
  finishAgentPendingAction: vi.fn(),
  getAgentUsageToday: vi.fn(),
  insertAgentMessage: vi.fn(),
  listAgentMessages: vi.fn(),
  listAgentPendingActions: vi.fn(),
  takeUnreportedAgentActionOutcomes: vi.fn(),
}));
vi.mock('../src/repositories/agentRepository.js', () => repository);
const services = vi.hoisted(() => ({
  createServiceForActor: vi.fn(), getServicesForActor: vi.fn(), updateAssignmentForActor: vi.fn(), updateServiceForActor: vi.fn(),
}));
vi.mock('../src/services/serviceService.js', () => services);
vi.mock('../src/services/settingsService.js', async (original) => ({
  ...await original<typeof import('../src/services/settingsService.js')>(),
  getUserSettings: vi.fn(async () => ({ locale: 'ru', timezone: 'Europe/Moscow' })),
}));

import { AgentError, prepareAgentChat, resolveAgentAction, runAgentChat, type AgentStreamEvent } from '../src/services/agent/agentService.js';

const owner = { id: '7', accountId: 2, email: '', role: WebUserRole.Owner, passwordSalt: '', passwordHash: '', createdAt: '' };
const CONVERSATION = '6f0d3c1e-2d55-4b1f-9a51-0f4c5b7e8a10';
const ACTION = '1f2ec7e3-f737-48f7-af97-ed82f2791bc7';
const usage = { input_tokens: 10, output_tokens: 5 };
const brows = { name: 'Brows', basePrice: 1500, baseDurationMinutes: 60 };

async function chat(message: string) {
  const events: AgentStreamEvent[] = [];
  await runAgentChat({ actor: owner, conversationId: CONVERSATION, message, emit: (event) => events.push(event), signal: new AbortController().signal });
  return events;
}

describe('agent service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    model.responses = [];
    model.requests = [];
    store.messages = [];
    repository.insertAgentMessage.mockImplementation(async (_id: string, role: string, content: unknown) => {
      store.messages.push({ id: String(store.messages.length + 1), role, content: structuredClone(content) });
    });
    repository.listAgentMessages.mockImplementation(async () => store.messages);
    repository.takeUnreportedAgentActionOutcomes.mockResolvedValue([]);
    repository.getAgentUsageToday.mockResolvedValue({ messages: 0 });
    repository.countAgentMessages.mockResolvedValue(0);
    repository.findAgentConversation.mockResolvedValue({ id: CONVERSATION });
    repository.createAgentPendingAction.mockImplementation(async (input: { changes: unknown }) => ({
      id: ACTION, conversation_id: CONVERSATION, changes: input.changes, status: 'pending', result: null,
      expires_at: new Date(Date.now() + 60_000), created_at: new Date(),
    }));
  });

  it('refuses clients and accounts over the daily limit before opening a stream', async () => {
    await expect(prepareAgentChat({ ...owner, role: WebUserRole.Client }, undefined)).rejects.toMatchObject({ code: 'forbidden' });
    repository.getAgentUsageToday.mockResolvedValue({ messages: 50 });
    await expect(prepareAgentChat(owner, CONVERSATION)).rejects.toMatchObject({ code: 'agent_daily_limit' });
  });

  it('turns a proposal into a pending action without changing anything', async () => {
    model.responses.push(
      { stop_reason: 'tool_use', usage, content: [
        { type: 'text', text: 'Добавлю услугу.' },
        { type: 'tool_use', id: 'tu_1', name: 'propose_changes', input: {
          summary: 'Добавить услугу «Брови»', changes: [{ resource: 'services', operation: 'create', data: brows }],
        } },
      ] },
      { stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'Нажмите «Применить».' }] },
    );

    const events = await chat('Добавь брови за 1500, час');

    expect(services.createServiceForActor).not.toHaveBeenCalled();
    expect(events).toEqual(expect.arrayContaining([
      { type: 'conversation', conversationId: CONVERSATION },
      { type: 'text', delta: 'Добавлю услугу.' },
      { type: 'tool', name: 'propose_changes' },
      expect.objectContaining({ type: 'pending_action', action: expect.objectContaining({ id: ACTION, status: 'pending' }) }),
      { type: 'done' },
    ]));
    // The tool result goes back to the model, and the whole exchange is stored for replay.
    expect(store.messages.map(({ role }) => role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    const toolResult = (store.messages[2]!.content as Array<{ content: string }>)[0]!;
    expect(JSON.parse(toolResult.content)).toMatchObject({ actionId: ACTION, status: 'waiting_for_user' });
    expect(model.requests[1]!.messages).toHaveLength(3);
    expect(model.requests[0]).toMatchObject({ model: 'claude-haiku-5-5', output_config: { effort: 'low' } });
  });

  it('returns validation problems to the model instead of proposing', async () => {
    model.responses.push(
      { stop_reason: 'tool_use', usage, content: [
        { type: 'tool_use', id: 'tu_1', name: 'propose_changes', input: {
          summary: 'x', changes: [{ resource: 'services', operation: 'create', data: { name: 'Brows' } }],
        } },
      ] },
      { stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'Сколько стоит услуга?' }] },
    );
    const events = await chat('Добавь брови');
    expect(repository.createAgentPendingAction).not.toHaveBeenCalled();
    expect(events.some((event) => event.type === 'pending_action')).toBe(false);
    const toolResult = (store.messages[2]!.content as Array<{ content: string; is_error?: boolean }>)[0]!;
    expect(toolResult.is_error).toBe(true);
    expect(JSON.parse(toolResult.content).error).toBe('invalid_changes');
  });

  it('tells the model about applied or cancelled proposals with the next message', async () => {
    repository.takeUnreportedAgentActionOutcomes.mockResolvedValue([{
      id: ACTION, changes: { summary: 'Добавить брови', changes: [] }, status: 'confirmed', result: { appliedCount: 1 },
      expires_at: new Date(), created_at: new Date(),
    }]);
    model.responses.push({ stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'Готово.' }] });
    await chat('Что дальше?');
    const [note, message] = store.messages[0]!.content as Array<{ text: string }>;
    expect(note!.text).toMatch(/^\[app\] The user applied proposal/);
    expect(message!.text).toBe('Что дальше?');
  });

  it('answers unfinished tool calls when the run is interrupted', async () => {
    model.responses.push({ stop_reason: 'tool_use', usage, content: [
      { type: 'tool_use', id: 'tu_1', name: 'read', input: { resource: 'services' } },
    ] });
    services.getServicesForActor.mockResolvedValue({ services: [], specialists: [] });
    // Storing the tool results fails once, as if the run stopped between the tool call and its result.
    const save = repository.insertAgentMessage.getMockImplementation()!;
    repository.insertAgentMessage.mockImplementation(async (id: string, role: string, content: unknown) => {
      if (store.messages.length === 2 && !(content as Array<{ content: string }>)[0]!.content.includes('interrupted')) {
        throw new Error('connection lost');
      }
      return save(id, role, content);
    });
    await expect(chat('Покажи услуги')).rejects.toThrow('connection lost');
    expect(store.messages.map(({ role }) => role)).toEqual(['user', 'assistant', 'user']);
    const [result] = store.messages[2]!.content as Array<{ tool_use_id: string; is_error: boolean; content: string }>;
    expect(result).toMatchObject({ tool_use_id: 'tu_1', is_error: true });
    expect(JSON.parse(result!.content)).toEqual({ error: 'interrupted' });
  });

  describe('confirming proposals', () => {
    const record = (patch: Record<string, unknown> = {}) => ({
      id: ACTION, conversation_id: CONVERSATION, status: 'pending', result: null,
      expires_at: new Date(Date.now() + 60_000), created_at: new Date(),
      changes: { summary: 'Две услуги', changes: [
        { resource: 'services', operation: 'create', data: brows },
        { resource: 'services', operation: 'create', data: { ...brows, name: 'Lashes' } },
      ] },
      ...patch,
    });

    it('applies every change through the services', async () => {
      repository.findAgentPendingAction.mockResolvedValue(record());
      repository.claimAgentPendingAction.mockResolvedValue(true);
      const action = await resolveAgentAction(owner, ACTION, 'confirm');
      expect(services.createServiceForActor).toHaveBeenCalledTimes(2);
      expect(action).toMatchObject({ status: 'confirmed', result: { appliedCount: 2 } });
      expect(repository.finishAgentPendingAction).toHaveBeenCalledWith(ACTION, 'confirmed', { appliedCount: 2 });
    });

    it('stops at the first failing change and reports it', async () => {
      repository.findAgentPendingAction.mockResolvedValue(record());
      repository.claimAgentPendingAction.mockResolvedValue(true);
      services.createServiceForActor.mockResolvedValueOnce({ id: 1 }).mockRejectedValueOnce(new Error('CONFLICT'));
      const action = await resolveAgentAction(owner, ACTION, 'confirm');
      expect(action).toMatchObject({ status: 'failed', result: { appliedCount: 1, failedIndex: 1, error: 'conflict' } });
    });

    it('does not apply missing, expired or already resolved proposals', async () => {
      repository.findAgentPendingAction.mockResolvedValue(null);
      await expect(resolveAgentAction(owner, ACTION, 'confirm')).rejects.toMatchObject({ code: 'action_not_found' });

      repository.findAgentPendingAction.mockResolvedValue(record({ expires_at: new Date(Date.now() - 1000) }));
      await expect(resolveAgentAction(owner, ACTION, 'confirm')).rejects.toMatchObject({ code: 'action_not_found' });
      expect(repository.expireAgentPendingAction).toHaveBeenCalledWith(ACTION);

      repository.findAgentPendingAction.mockResolvedValue(record());
      repository.claimAgentPendingAction.mockResolvedValue(false);
      await expect(resolveAgentAction(owner, ACTION, 'confirm')).rejects.toBeInstanceOf(AgentError);
      expect(services.createServiceForActor).not.toHaveBeenCalled();
    });

    it('cancels without touching data', async () => {
      repository.findAgentPendingAction.mockResolvedValue(record());
      repository.claimAgentPendingAction.mockResolvedValue(true);
      expect(await resolveAgentAction(owner, ACTION, 'reject')).toMatchObject({ status: 'rejected' });
      expect(repository.claimAgentPendingAction).toHaveBeenCalledWith(ACTION, 'rejected');
      expect(services.createServiceForActor).not.toHaveBeenCalled();
    });
  });
});
