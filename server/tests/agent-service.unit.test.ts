import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebUserRole } from '../src/types/webUserRole.js';

vi.mock('../src/config/env.js', async (original) => ({
  env: { ...(await original<typeof import('../src/config/env.js')>()).env, ANTHROPIC_API_KEY: 'test-key' },
}));

// Scripted model: each call to messages.stream returns the next prepared response.
const model = vi.hoisted(() => ({
  responses: [] as unknown[],
  requests: [] as Array<Record<string, unknown>>,
  transcriptions: [] as unknown[],
  transcriptionRequests: [] as Array<Record<string, unknown>>,
}));
vi.mock('@anthropic-ai/sdk', () => {
  class FakeAnthropic {
    messages = {
      // Non-streaming call, used only to transcribe attachments.
      create: async (params: Record<string, unknown>) => {
        model.transcriptionRequests.push(structuredClone(params));
        return model.transcriptions.shift();
      },
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
  countAgentUserTurns: vi.fn(),
  createAgentConversation: vi.fn(),
  createAgentPendingAction: vi.fn(),
  expireAgentPendingAction: vi.fn(),
  findAgentConversation: vi.fn(),
  findAgentPendingAction: vi.fn(),
  finishAgentPendingAction: vi.fn(),
  getAgentUsageToday: vi.fn(),
  insertAgentMessage: vi.fn(),
  listAgentConversations: vi.fn(),
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
const setupStatus = vi.hoisted(() => ({ computeSetupStatus: vi.fn() }));
vi.mock('../src/services/agent/agentSetupStatus.js', () => setupStatus);

import {
  AgentError,
  getAgentSetupStatus,
  getAgentConversation,
  listAgentConversationSummaries,
  prepareAgentChat,
  resolveAgentAction,
  runAgentChat,
  type AgentStreamEvent,
} from '../src/services/agent/agentService.js';
import type { PreparedAgentAttachment } from '../src/services/agent/agentAttachments.js';

const owner = { id: '7', accountId: 2, email: '', role: WebUserRole.Owner, passwordSalt: '', passwordHash: '', createdAt: '' };
const CONVERSATION = '6f0d3c1e-2d55-4b1f-9a51-0f4c5b7e8a10';
const ACTION = '1f2ec7e3-f737-48f7-af97-ed82f2791bc7';
const usage = { input_tokens: 10, output_tokens: 5 };
const brows = { name: 'Brows', basePrice: 1500, baseDurationMinutes: 60 };

async function chat(message: string, attachments?: PreparedAgentAttachment[]) {
  const events: AgentStreamEvent[] = [];
  await runAgentChat({
    actor: owner, conversationId: CONVERSATION, message, attachments, emit: (event) => events.push(event), signal: new AbortController().signal,
  });
  return events;
}
const PHOTO_DATA = 'cGhvdG8tYnl0ZXM=';
const photo: PreparedAgentAttachment = { name: 'price.jpg', kind: 'image', mediaType: 'image/jpeg', data: PHOTO_DATA };
const blockTypes = (request: Record<string, unknown>) => (request.messages as Array<{ content: unknown }>)
  .flatMap(({ content }) => (Array.isArray(content) ? content : []) as Array<{ type: string }>)
  .map(({ type }) => type);

describe('agent service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    model.responses = [];
    model.requests = [];
    model.transcriptions = [];
    model.transcriptionRequests = [];
    store.messages = [];
    repository.insertAgentMessage.mockImplementation(async (_id: string, role: string, content: unknown) => {
      store.messages.push({ id: String(store.messages.length + 1), role, content: structuredClone(content) });
    });
    repository.listAgentMessages.mockImplementation(async () => store.messages);
    repository.takeUnreportedAgentActionOutcomes.mockResolvedValue([]);
    repository.getAgentUsageToday.mockResolvedValue({ messages: 0 });
    repository.countAgentUserTurns.mockResolvedValue(0);
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

  it('refuses the 11th message of a chat and never opens another chat by itself', async () => {
    repository.countAgentUserTurns.mockResolvedValue(9);
    expect(await prepareAgentChat(owner, CONVERSATION)).toBe(CONVERSATION);
    repository.countAgentUserTurns.mockResolvedValue(10);
    await expect(prepareAgentChat(owner, CONVERSATION)).rejects.toMatchObject({ code: 'conversation_limit' });
    expect(repository.createAgentConversation).not.toHaveBeenCalled();
    repository.findAgentConversation.mockResolvedValue(null);
    await expect(prepareAgentChat(owner, CONVERSATION)).rejects.toMatchObject({ code: 'conversation_not_found' });
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

  it('marks the system prompt for caching and keeps the per-user line separate', async () => {
    model.responses.push({ stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'Привет' }] });
    await chat('Привет');
    const system = model.requests[0]!.system as Array<{ text: string; cache_control?: unknown }>;
    expect(system[0]!.cache_control).toEqual({ type: 'ephemeral' });
    expect(system[1]!.cache_control).toBeUndefined();
    expect(model.requests[0]!.max_tokens).toBe(16000);
    expect((model.requests[0]!.tools as Array<{ name: string }>).map(({ name }) => name))
      .toEqual(['get_catalog', 'get_setup_status', 'read', 'propose_changes', 'open_section']);
  });

  it('transcribes attachments once and stores only text', async () => {
    model.transcriptions.push({
      stop_reason: 'end_turn', usage: { input_tokens: 900, output_tokens: 40 },
      content: [{ type: 'text', text: '=== 1 ===\nМаникюр | 1500 | 60 мин |\nПедикюр | 2000 | |' }],
    });
    model.responses.push({ stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'Сколько длится педикюр?' }] });

    const events = await chat('Добавь услуги', [photo]);

    expect(model.transcriptionRequests).toHaveLength(1);
    const transcription = model.transcriptionRequests[0]!;
    expect(transcription).toMatchObject({ model: 'claude-haiku-5-5', output_config: { effort: 'low' } });
    expect(blockTypes(transcription)).toEqual(['text', 'image']);
    expect(events[1]).toEqual({ type: 'tool', name: 'read_attachment' });
    // The agent loop never sees the file itself.
    expect(blockTypes(model.requests[0]!)).toEqual(['text', 'text']);
    const stored = store.messages[0]!.content as Array<{ type: string; text: string }>;
    expect(stored).toEqual([
      { type: 'text', text: '[attachment] price.jpg (image)\nМаникюр | 1500 | 60 мин |\nПедикюр | 2000 | |' },
      { type: 'text', text: 'Добавь услуги' },
    ]);
    expect(JSON.stringify(store.messages)).not.toContain(PHOTO_DATA);
    expect(repository.addAgentUsage).toHaveBeenLastCalledWith(2, { inputTokens: 910, outputTokens: 45, messages: 0 });
  });

  it('stores a note when an attachment cannot be read, and allows a message without text', async () => {
    model.transcriptions.push({ stop_reason: 'end_turn', usage, content: [{ type: 'text', text: '=== 1 ===\nUNREADABLE\n=== 2 ===\nКонсультация | 3000 | 90 |' }] });
    model.responses.push({ stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'Пришлите фото четче.' }] });
    await chat('', [photo, { name: 'list.pdf', kind: 'pdf', mediaType: 'application/pdf', data: 'JVBERi0=' }]);
    expect(blockTypes(model.transcriptionRequests[0]!)).toEqual(['text', 'image', 'text', 'document']);
    expect((store.messages[0]!.content as Array<{ text: string }>).map(({ text }) => text)).toEqual([
      '[attachment] price.jpg (image): could not be read',
      '[attachment] list.pdf (pdf)\nКонсультация | 3000 | 90 |',
    ]);
  });

  it('treats a refused transcription as unreadable', async () => {
    model.transcriptions.push({ stop_reason: 'refusal', usage, content: [] });
    model.responses.push({ stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'Не удалось прочитать.' }] });
    await chat('Вот прайс', [photo]);
    expect((store.messages[0]!.content as Array<{ text: string }>)[0]!.text).toBe('[attachment] price.jpg (image): could not be read');
  });

  it('accepts proposals of up to 100 changes', async () => {
    const changes = (count: number) => Array.from({ length: count }, (_, index) => ({
      resource: 'services', operation: 'create', data: { ...brows, name: `Service ${index}` },
    }));
    model.responses.push(
      { stop_reason: 'tool_use', usage, content: [{ type: 'tool_use', id: 'tu_1', name: 'propose_changes', input: { summary: 'many', changes: changes(101) } }] },
      { stop_reason: 'tool_use', usage, content: [{ type: 'tool_use', id: 'tu_2', name: 'propose_changes', input: { summary: 'many', changes: changes(100) } }] },
      { stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'Готово' }] },
    );
    await chat('Добавь прайс');
    const first = (store.messages[2]!.content as Array<{ content: string; is_error?: boolean }>)[0]!;
    expect(JSON.parse(first.content).error).toBe('invalid_tool_input');
    expect(repository.createAgentPendingAction).toHaveBeenCalledTimes(1);
    expect((repository.createAgentPendingAction.mock.calls[0]![0] as { changes: { changes: unknown[] } }).changes.changes).toHaveLength(100);
  });

  it('answers get_setup_status from the setup status service', async () => {
    setupStatus.computeSetupStatus.mockResolvedValue({ steps: [{ key: 'services', done: false, optional: false, path: '/services' }], remaining: 1 });
    model.responses.push(
      { stop_reason: 'tool_use', usage, content: [{ type: 'tool_use', id: 'tu_1', name: 'get_setup_status', input: {} }] },
      { stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'Начнём с услуг.' }] },
    );
    await chat('Привет');
    expect(setupStatus.computeSetupStatus).toHaveBeenCalledWith(owner);
    const result = (store.messages[2]!.content as Array<{ content: string }>)[0]!;
    expect(JSON.parse(result.content)).toMatchObject({ remaining: 1 });
  });

  it('checks access before reporting setup status', async () => {
    await expect(getAgentSetupStatus({ ...owner, role: WebUserRole.Client })).rejects.toMatchObject({ code: 'forbidden' });
    setupStatus.computeSetupStatus.mockResolvedValue({ steps: [], remaining: 0 });
    expect(await getAgentSetupStatus(owner)).toEqual({ steps: [], remaining: 0 });
  });

  it('shows attachments in the history as files, not as their transcription', async () => {
    repository.listAgentPendingActions.mockResolvedValue([]);
    store.messages = [
      { id: '1', role: 'user', content: [
        { type: 'text', text: '[app] The user applied proposal x.' },
        { type: 'text', text: '[attachment] price (1).jpg (image)\nМаникюр | 1500 | 60 |' },
        { type: 'text', text: '[attachment] scan.pdf (pdf): could not be read' },
        { type: 'text', text: 'Добавь' },
      ] },
      { id: '2', role: 'assistant', content: [{ type: 'text', text: 'Хорошо' }] },
      { id: '3', role: 'user', content: [{ type: 'text', text: '[attachment] menu.png (image)\nМеню' }] },
      { id: '4', role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: '{}' }] },
    ];
    const history = await getAgentConversation(owner, CONVERSATION);
    expect(history).toMatchObject({ conversationId: CONVERSATION, userMessageCount: 2, messageLimit: 10 });
    expect(history.items).toEqual([
      { type: 'user', text: 'Добавь', attachments: [{ name: 'price (1).jpg', kind: 'image' }, { name: 'scan.pdf', kind: 'pdf' }] },
      { type: 'assistant', text: 'Хорошо' },
      { type: 'user', text: '', attachments: [{ name: 'menu.png', kind: 'image' }] },
    ]);
  });

  it('opens only the signed-in user\'s own chats', async () => {
    repository.findAgentConversation.mockResolvedValue(null);
    await expect(getAgentConversation(owner, CONVERSATION)).rejects.toMatchObject({ code: 'conversation_not_found' });
    expect(repository.findAgentConversation).toHaveBeenCalledWith(2, 7, CONVERSATION);
    expect(repository.listAgentMessages).not.toHaveBeenCalled();
  });

  it('titles past chats by their first message without app notes', async () => {
    const date = new Date('2026-11-26T10:00:00Z');
    repository.listAgentConversations.mockResolvedValue([
      { id: CONVERSATION, created_at: date, updated_at: date, user_turns: 3, first_user_content: [
        { type: 'text', text: '[app] The user applied proposal x.' },
        { type: 'text', text: 'Добавь   услуги\nиз прайса' },
      ] },
      { id: 'b', created_at: date, updated_at: date, user_turns: 1, first_user_content: [
        { type: 'text', text: '[attachment] price.jpg (image)\nМаникюр | 1500' },
      ] },
      { id: 'c', created_at: date, updated_at: date, user_turns: 1, first_user_content: [{ type: 'text', text: 'а'.repeat(200) }] },
    ]);
    const list = await listAgentConversationSummaries(owner);
    expect(repository.listAgentConversations).toHaveBeenCalledWith(2, 7, 50);
    expect(list[0]).toEqual({
      id: CONVERSATION, title: 'Добавь услуги из прайса', createdAt: date.toISOString(), updatedAt: date.toISOString(), userMessageCount: 3,
    });
    expect(list[1]!.title).toBe('price.jpg');
    expect(list[2]!.title).toHaveLength(80);
    await expect(listAgentConversationSummaries({ ...owner, role: WebUserRole.Client })).rejects.toMatchObject({ code: 'forbidden' });
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
