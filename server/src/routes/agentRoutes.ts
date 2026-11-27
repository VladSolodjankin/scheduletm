import Anthropic from '@anthropic-ai/sdk';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import { isClientRole } from '../policies/rolePermissions.js';
import { getAgentUsageToday } from '../repositories/agentRepository.js';
import {
  AGENT_ATTACHMENT_MAX_COUNT,
  AgentAttachmentError,
  prepareAgentAttachments,
  type PreparedAgentAttachment,
} from '../services/agent/agentAttachments.js';
import {
  AGENT_CONVERSATION_MESSAGE_LIMIT,
  AGENT_DAILY_MESSAGE_LIMIT,
  AgentError,
  getAgentConversation,
  getAgentSetupStatus,
  isAgentAvailable,
  listAgentConversationSummaries,
  prepareAgentChat,
  resolveAgentAction,
  runAgentChat,
  type AgentStreamEvent,
} from '../services/agent/agentService.js';
import { trackServerError } from '../services/errorTrackingService.js';
import { formatZodError } from '../utils/validation.js';

export const agentRoutes = Router();
agentRoutes.use(requireAccessToken);

const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  // Unsupported types are answered with 415 by prepareAgentAttachments.
  mimeType: z.string().trim().toLowerCase().max(100),
  data: z.string().min(1),
});
const chatSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().max(4000),
  attachments: z.array(attachmentSchema).max(AGENT_ATTACHMENT_MAX_COUNT).optional(),
}).refine((value) => value.message.length > 0 || (value.attachments?.length ?? 0) > 0, {
  path: ['message'],
  message: 'message_or_attachment_required',
});
const actionIdSchema = z.string().uuid();
const conversationIdSchema = z.string().uuid();

const STATUS_BY_CODE: Record<AgentError['code'], number> = {
  agent_unavailable: 503,
  forbidden: 403,
  agent_daily_limit: 429,
  agent_busy: 409,
  conversation_not_found: 404,
  conversation_limit: 409,
  action_not_found: 404,
  action_already_resolved: 409,
};
const ATTACHMENT_STATUS_BY_CODE: Record<AgentAttachmentError['code'], number> = {
  attachment_too_large: 413,
  unsupported_attachment: 415,
  invalid_attachment: 400,
};

const actorOf = (req: Request) => (req as unknown as AuthedRequest).user;

function handleError(error: unknown, req: Request, res: Response) {
  if (error instanceof AgentError) return res.status(STATUS_BY_CODE[error.code]).json({ code: error.code });
  if (error instanceof AgentAttachmentError) return res.status(ATTACHMENT_STATUS_BY_CODE[error.code]).json({ code: error.code });
  void trackServerError({ actor: actorOf(req), method: req.method, path: req.path, error });
  res.locals.errorTracked = true;
  return res.status(500).json({ code: 'internal_error' });
}

agentRoutes.get('/status', async (req, res) => {
  const actor = actorOf(req);
  try {
    const available = isAgentAvailable() && !isClientRole(actor.role);
    const usedToday = available ? (await getAgentUsageToday(actor.accountId)).messages : 0;
    return res.json({
      available,
      dailyLimit: AGENT_DAILY_MESSAGE_LIMIT,
      usedToday,
      conversationMessageLimit: AGENT_CONVERSATION_MESSAGE_LIMIT,
    });
  } catch (error) { return handleError(error, req, res); }
});

agentRoutes.get('/setup-status', async (req, res) => {
  try {
    return res.json(await getAgentSetupStatus(actorOf(req)));
  } catch (error) { return handleError(error, req, res); }
});

agentRoutes.get('/conversations', async (req, res) => {
  try {
    return res.json({ conversations: await listAgentConversationSummaries(actorOf(req)) });
  } catch (error) { return handleError(error, req, res); }
});

agentRoutes.get('/conversations/:id', async (req, res) => {
  const id = conversationIdSchema.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ code: 'invalid_conversation_id' });
  try {
    return res.json({ conversation: await getAgentConversation(actorOf(req), id.data) });
  } catch (error) { return handleError(error, req, res); }
});

agentRoutes.post('/chat', async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(formatZodError(parsed.error));
  const actor = actorOf(req);

  let conversationId: string;
  let attachments: PreparedAgentAttachment[];
  try {
    conversationId = await prepareAgentChat(actor, parsed.data.conversationId);
    attachments = await prepareAgentAttachments(parsed.data.attachments ?? []);
  } catch (error) { return handleError(error, req, res); }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });
  const emit = (event: AgentStreamEvent) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    await runAgentChat({ actor, conversationId, message: parsed.data.message, attachments, emit, signal: controller.signal });
  } catch (error) {
    if (!(error instanceof Anthropic.APIUserAbortError)) {
      if (error instanceof AgentError) emit({ type: 'error', code: error.code });
      else if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
        emit({ type: 'error', code: 'agent_temporarily_unavailable' });
      } else {
        void trackServerError({ actor, method: req.method, path: req.path, error });
        res.locals.errorTracked = true;
        emit({ type: 'error', code: 'agent_failed' });
      }
    }
  }
  res.end();
});

for (const decision of ['confirm', 'reject'] as const) {
  agentRoutes.post(`/actions/:id/${decision}`, async (req, res) => {
    const id = actionIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ code: 'invalid_action_id' });
    try {
      return res.json({ action: await resolveAgentAction(actorOf(req), id.data, decision) });
    } catch (error) { return handleError(error, req, res); }
  });
}
