import AttachFileRounded from '@mui/icons-material/AttachFileRounded';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CloseFullscreenRounded from '@mui/icons-material/CloseFullscreenRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import OpenInFullRounded from '@mui/icons-material/OpenInFullRounded';
import PhotoCameraRounded from '@mui/icons-material/PhotoCameraRounded';
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined';
import RadioButtonUncheckedRounded from '@mui/icons-material/RadioButtonUncheckedRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import {
  Box,
  Chip,
  Drawer,
  Fab,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  agentApi,
  AgentRequestError,
  streamAgentChat,
  type AgentAction,
  type AgentChange,
  type AgentAttachmentRef,
  type AgentConversation,
  type AgentConversationSummary,
  type AgentHistoryItem,
  type AgentSetupStatus,
  type AgentStatus,
} from '../../shared/api/agent';
import { useAuth } from '../../shared/auth/AuthContext';
import type { TranslationKey } from '../../shared/i18n/dictionaries';
import { useI18n } from '../../shared/i18n/I18nContext';
import { AppButton } from '../../shared/ui/AppButton';
import { AppIcons } from '../../shared/ui/AppIcons';
import { AppStatusBadge, AppStatusMessage, type AppStatusTone } from '../../shared/ui/AppStatus';
import {
  ATTACHMENT_ACCEPT,
  AttachmentError,
  MAX_ATTACHMENTS,
  MAX_TOTAL_BASE64_LENGTH,
  prepareAttachment,
  type PreparedAttachment,
} from './agentAttachments';

const SUGGESTIONS = [
  'agent.suggestionServices',
  'agent.suggestionReminders',
  'agent.suggestionSpecialist',
  'agent.suggestionIntegrations',
] as const satisfies readonly TranslationKey[];

const TOOL_STATUS: Record<string, TranslationKey> = {
  get_catalog: 'agent.toolCatalog',
  read: 'agent.toolRead',
  propose_changes: 'agent.toolPropose',
  open_section: 'agent.toolSection',
  read_attachment: 'agent.toolReadAttachment',
  get_setup_status: 'agent.toolSetupStatus',
};

const ERROR_TEXT: Record<string, TranslationKey> = {
  agent_unavailable: 'agent.errorUnavailable',
  agent_daily_limit: 'agent.errorLimit',
  agent_busy: 'agent.errorBusy',
  agent_refused: 'agent.errorRefused',
  session_expired: 'agent.errorSession',
  attachment_too_large: 'agent.errorAttachmentTooLarge',
  unsupported_attachment: 'agent.errorAttachmentUnsupported',
  invalid_attachment: 'agent.errorAttachmentInvalid',
  conversation_not_found: 'agent.errorChatNotFound',
};

/** Used until the status request answers; the server sends the real per-chat limit. */
const DEFAULT_CHAT_MESSAGE_LIMIT = 10;
/** The daily counter is shown only when this few messages are left today. */
const DAILY_USAGE_WARNING = 10;

type SetupState =
  | { state: 'idle' | 'loading' | 'error' }
  | { state: 'ready'; data: AgentSetupStatus };

type HistoryState =
  | { state: 'idle' | 'loading' | 'error' }
  | { state: 'ready'; data: AgentConversationSummary[] };

function AttachmentChips({ attachments, onRemove, removeLabel, disabled, inverted }: {
  attachments: (AgentAttachmentRef & { id?: string })[];
  onRemove?: (index: number) => void;
  removeLabel?: (name: string) => string;
  disabled?: boolean;
  inverted?: boolean;
}) {
  return (
    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
      {attachments.map((attachment, index) => {
        const Icon = attachment.kind === 'pdf' ? PictureAsPdfOutlined : ImageOutlined;
        return (
          <Chip
            key={attachment.id ?? index}
            size="small"
            variant="outlined"
            icon={<Icon fontSize="small" />}
            label={attachment.name}
            disabled={disabled}
            onDelete={onRemove ? () => onRemove(index) : undefined}
            deleteIcon={onRemove && removeLabel ? (
              <IconButton size="small" aria-label={removeLabel(attachment.name)} sx={{ p: 0.25 }}><AppIcons.close fontSize="small" /></IconButton>
            ) : undefined}
            sx={{
              maxWidth: '100%',
              ...(inverted ? { color: 'inherit', borderColor: 'currentColor', '& .MuiChip-icon': { color: 'inherit' } } : {}),
            }}
          />
        );
      })}
    </Stack>
  );
}

const STATUS_TONE: Record<AgentAction['status'], AppStatusTone> = {
  pending: 'info', confirmed: 'success', rejected: 'neutral', expired: 'neutral', failed: 'danger',
};
const STATUS_TEXT: Record<AgentAction['status'], TranslationKey> = {
  pending: 'agent.actionPending',
  confirmed: 'agent.actionConfirmed',
  rejected: 'agent.actionRejected',
  expired: 'agent.actionExpired',
  failed: 'agent.actionFailed',
};

type Translate = (key: TranslationKey) => string;
type ChangeRow = { key: string; label: string; value: string; before?: string };

/** Falls back to the raw name when a label is missing, instead of showing the translation key. */
const labelOf = (t: Translate, prefix: string, name: string) => {
  const key = `agent.${prefix}${name}` as TranslationKey;
  const text = t(key);
  return text === key ? name : text;
};

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') {return '—';}
  if (typeof value === 'boolean') {return value ? '✓' : '✕';}
  if (Array.isArray(value)) {return value.map((item) => (typeof item === 'number' ? `#${item}` : String(item))).join(', ');}
  if (typeof value === 'object') {return JSON.stringify(value);}
  return String(value);
};

const WEEKDAY_KEYS = [
  'publicPageBuilder.monday', 'publicPageBuilder.tuesday', 'publicPageBuilder.wednesday', 'publicPageBuilder.thursday',
  'publicPageBuilder.friday', 'publicPageBuilder.saturday', 'publicPageBuilder.sunday',
] as const satisfies readonly TranslationKey[];

/** Work days arrive as ISO weekday numbers; show them as day names instead of `#1, #2`. */
const formatField = (t: Translate, key: string, value: unknown) => {
  if (key === 'workDays' && Array.isArray(value)) {
    return value.map((day) => (typeof day === 'number' && WEEKDAY_KEYS[day - 1] ? t(WEEKDAY_KEYS[day - 1]) : String(day))).join(', ');
  }
  return formatValue(value);
};

type NotificationItem = { notificationType: string; preferredChannel?: string; enabled?: boolean; sendTimings?: string[]; frequency?: string };

const formatNotification = (t: Translate, item: NotificationItem) => {
  if (item.enabled === false) {return t('agent.notificationOff');}
  const timings = (item.sendTimings ?? []).map((timing) => (timing === 'immediate' ? t('agent.notificationImmediate') : timing));
  return [item.preferredChannel, timings.join(', '), item.frequency === 'daily' ? t('agent.notificationDaily') : null]
    .filter(Boolean).join(' · ');
};

function rowsOf(t: Translate, change: AgentChange): ChangeRow[] {
  const { changes: nested, items, ...fields } = change.data;
  const rows: ChangeRow[] = Object.entries(fields).map(([key, value]) => ({
    key,
    label: labelOf(t, 'field_', key),
    value: key === 'specialistId' || key === 'userId' ? `#${String(value)}` : formatField(t, key, value),
    before: change.before && key in change.before ? formatField(t, key, change.before[key]) : undefined,
  }));
  if (nested && typeof nested === 'object') {
    for (const [key, value] of Object.entries(nested as Record<string, unknown>)) {
      rows.push({ key, label: labelOf(t, 'field_', key), value: formatValue(value) });
    }
  }
  if (Array.isArray(items)) {
    for (const item of items as NotificationItem[]) {
      rows.push({ key: item.notificationType, label: labelOf(t, 'notification_', item.notificationType), value: formatNotification(t, item) });
    }
  }
  return rows;
}

const isExpired = (action: AgentAction) => action.status === 'pending' && new Date(action.expiresAt).getTime() <= Date.now();

function ChangeList({ changes, t }: { changes: AgentChange[]; t: Translate }) {
  return (
    <Stack spacing={1}>
      {changes.map((change, index) => (
        <Box key={index} sx={{ borderLeft: 2, borderColor: 'divider', pl: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            {t(change.operation === 'create' ? 'agent.create' : 'agent.update')} · {t(`agent.resource_${change.resource}` as TranslationKey)}
            {change.id ? ` #${change.id}` : ''}
          </Typography>
          {rowsOf(t, change).map((row) => (
            <Typography key={row.key} variant="body2" sx={{ wordBreak: 'break-word' }}>
              <Box component="span" sx={{ color: 'text.secondary' }}>{row.label}: </Box>
              {row.value}
              {row.before !== undefined ? (
                <Box component="span" sx={{ color: 'text.secondary' }}> ({t('agent.was')} {row.before})</Box>
              ) : null}
            </Typography>
          ))}
          {change.resource === 'specialist_invites' ? (
            <Typography variant="caption" color="warning.main">{t('agent.inviteNote')}</Typography>
          ) : null}
        </Box>
      ))}
    </Stack>
  );
}

/** `onChangesApplied` lets the layout reload the open page after the assistant saved something. */
export function AgentAssistant({ onChangesApplied }: { onChangesApplied?: () => void }) {
  const { t } = useI18n();
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AgentHistoryItem[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [toolStatus, setToolStatus] = useState<TranslationKey | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PreparedAttachment[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [setup, setSetup] = useState<SetupState>({ state: 'idle' });
  /** User messages sent in the current chat, counted against the per-chat limit. */
  const [userCount, setUserCount] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<HistoryState>({ state: 'idle' });
  /** A past chat opened from the history; shown read-only instead of the current chat. */
  const [viewed, setViewed] = useState<AgentConversation | null>(null);
  const [openingChat, setOpeningChat] = useState<string | null>(null);
  /** On phones the full view shows either the chat list or a chat. */
  const [historyOnPhone, setHistoryOnPhone] = useState(false);
  const historyRequestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const setupRequestRef = useRef(0);
  const isEmpty = items.length === 0;

  useEffect(() => {
    if (!accessToken) {return;}
    agentApi.status(accessToken).then(setStatus).catch(() => setStatus(null));
  }, [accessToken]);

  /**
   * Setup progress for an empty chat, reloaded on every open so it reflects changes made meanwhile.
   * Each request gets a number; closing the panel or a newer request makes older answers stale.
   */
  const loadSetup = useCallback(() => {
    if (!accessToken) {return;}
    setupRequestRef.current += 1;
    const requestId = setupRequestRef.current;
    setSetup({ state: 'loading' });
    agentApi.setupStatus(accessToken)
      .then((data) => { if (setupRequestRef.current === requestId) {setSetup({ state: 'ready', data });} })
      .catch(() => { if (setupRequestRef.current === requestId) {setSetup({ state: 'error' });} });
  }, [accessToken]);

  /**
   * Every page load starts a new chat so old talks never grow the model's context.
   * The current chat stays while the user moves between sections, e.g. after "Open section".
   */
  const openPanel = () => {
    setOpen(true);
    if (isEmpty) {loadSetup();}
  };

  const closePanel = () => {
    setupRequestRef.current += 1;
    historyRequestRef.current += 1;
    setOpen(false);
  };

  const loadHistory = useCallback(() => {
    if (!accessToken) {return;}
    historyRequestRef.current += 1;
    const requestId = historyRequestRef.current;
    setHistory((current) => (current.state === 'ready' ? current : { state: 'loading' }));
    agentApi.conversations(accessToken)
      .then((data) => { if (historyRequestRef.current === requestId) {setHistory({ state: 'ready', data });} })
      .catch(() => { if (historyRequestRef.current === requestId) {setHistory({ state: 'error' });} });
  }, [accessToken]);

  const toggleExpanded = () => {
    if (expanded) {
      historyRequestRef.current += 1;
      setViewed(null);
      setHistoryOnPhone(false);
    } else {
      loadHistory();
    }
    setExpanded(!expanded);
  };

  const openHistoryChat = async (summary: AgentConversationSummary) => {
    if (!accessToken) {return;}
    setHistoryOnPhone(false);
    setError(null);
    if (summary.id === conversationId) {
      setViewed(null);
      return;
    }
    setOpeningChat(summary.id);
    try {
      setViewed(await agentApi.conversation(accessToken, summary.id));
    } catch {
      setError('agent.errorChatNotFound');
    } finally {
      setOpeningChat(null);
    }
  };

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [items, toolStatus]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const updateAction = useCallback((action: AgentAction) => {
    const replace = (list: AgentHistoryItem[]) => list.map((item): AgentHistoryItem => (
      item.type === 'action' && item.action.id === action.id ? { type: 'action', action } : item
    ));
    setItems(replace);
    setViewed((current) => current && { ...current, items: replace(current.items) });
  }, []);

  const addFiles = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Reset so picking the same file again still fires a change event.
    event.target.value = '';
    if (files.length === 0) {return;}
    const free = MAX_ATTACHMENTS - attachments.length;
    setError(free < files.length ? 'agent.errorAttachmentTooMany' : null);
    if (free <= 0) {return;}
    setPreparing(true);
    const prepared: PreparedAttachment[] = [];
    let failure: TranslationKey | null = null;
    let totalBase64 = attachments.reduce((sum, item) => sum + item.data.length, 0);
    for (const file of files.slice(0, free)) {
      try {
        const attachment = await prepareAttachment(file);
        if (totalBase64 + attachment.data.length > MAX_TOTAL_BASE64_LENGTH) {
          throw new AttachmentError('attachment_too_large');
        }
        totalBase64 += attachment.data.length;
        prepared.push(attachment);
      } catch (caught) {
        failure = caught instanceof AttachmentError && caught.code === 'attachment_too_large'
          ? 'agent.errorAttachmentTooLarge'
          : 'agent.errorAttachmentUnsupported';
      }
    }
    setAttachments((current) => [...current, ...prepared].slice(0, MAX_ATTACHMENTS));
    if (failure) {setError(failure);}
    setPreparing(false);
  }, [attachments]);

  const removeAttachment = (index: number) => {
    setAttachments((current) => current.filter((_, position) => position !== index));
  };

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    const files = attachments;
    if ((!message && files.length === 0) || streaming || preparing || !accessToken) {return;}
    setInput('');
    setError(null);
    setStreaming(true);
    setToolStatus(files.length > 0 ? 'agent.uploading' : 'agent.thinking');
    setItems((current) => [...current, {
      type: 'user',
      text: message,
      ...(files.length > 0 ? { attachments: files.map(({ name, kind }) => ({ name, kind })) } : {}),
    }]);
    const controller = new AbortController();
    abortRef.current = controller;
    let failed = false;
    try {
      await streamAgentChat({
        accessToken,
        conversationId,
        message,
        attachments: files.map(({ name, mimeType, data }) => ({ name, mimeType, data })),
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === 'conversation') {
            // The server sends this once the message is accepted, so it counts towards the chat limit.
            setConversationId(event.conversationId);
            setUserCount((current) => current + 1);
          }
          if (event.type === 'tool') {setToolStatus(TOOL_STATUS[event.name] ?? 'agent.thinking');}
          if (event.type === 'error') {
            failed = true;
            setError(ERROR_TEXT[event.code] ?? 'agent.errorGeneric');
          }
          if (event.type === 'text') {
            setToolStatus(null);
            setItems((current) => {
              const last = current.at(-1);
              return last?.type === 'assistant'
                ? [...current.slice(0, -1), { type: 'assistant', text: last.text + event.delta }]
                : [...current, { type: 'assistant', text: event.delta }];
            });
          }
          if (event.type === 'pending_action') {setItems((current) => [...current, { type: 'action', action: event.action }]);}
          if (event.type === 'section') {setItems((current) => [...current, { type: 'section', section: event.section, path: event.path }]);}
        },
      });
      setStatus((current) => current && { ...current, usedToday: current.usedToday + 1 });
      // Keep the files after a failure so they can be sent again without picking them anew.
      if (!failed && files.length > 0) {setAttachments((current) => current.filter((item) => !files.includes(item)));}
    } catch (caught) {
      if (caught instanceof AgentRequestError && caught.code === 'conversation_limit') {
        // Nothing was sent: take the message back so it can go to a new chat, and show the limit notice.
        setItems((current) => current.slice(0, -1));
        setInput(message);
        setUserCount(Math.max(status?.conversationMessageLimit ?? DEFAULT_CHAT_MESSAGE_LIMIT, 1));
      } else if (!controller.signal.aborted) {
        setError(caught instanceof AgentRequestError ? (ERROR_TEXT[caught.code] ?? 'agent.errorGeneric') : 'agent.errorGeneric');
      }
    } finally {
      setStreaming(false);
      setToolStatus(null);
      if (expanded) {loadHistory();}
    }
  }, [accessToken, attachments, conversationId, expanded, loadHistory, preparing, status, streaming]);

  const resolve = useCallback(async (action: AgentAction, decision: 'confirm' | 'reject') => {
    if (!accessToken) {return;}
    setResolving(action.id);
    setError(null);
    try {
      const resolved = await agentApi.resolve(accessToken, action.id, decision);
      updateAction(resolved);
      if ((resolved.result?.appliedCount ?? 0) > 0) {onChangesApplied?.();}
    } catch {
      setError('agent.errorAction');
      const chatId = viewed?.conversationId ?? conversationId;
      const fresh = chatId ? await agentApi.conversation(accessToken, chatId).catch(() => null) : null;
      const item = fresh?.items.find((entry) => entry.type === 'action' && entry.action.id === action.id);
      if (item?.type === 'action') {updateAction(item.action);}
    } finally {
      setResolving(null);
    }
  }, [accessToken, conversationId, viewed, updateAction, onChangesApplied]);

  const startNewChat = () => {
    abortRef.current?.abort();
    setConversationId(null);
    setItems([]);
    setUserCount(0);
    setViewed(null);
    setHistoryOnPhone(false);
    setAttachments([]);
    setError(null);
    loadSetup();
  };

  const openPriceListPicker = () => {
    if (!input.trim()) {setInput(t('agent.priceListPrompt'));}
    fileInputRef.current?.click();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  };

  if (!status?.available) {return null;}

  const busy = streaming || preparing;
  const chatLimit = status.conversationMessageLimit || DEFAULT_CHAT_MESSAGE_LIMIT;
  const limitReached = userCount >= chatLimit;
  const shownItems = viewed?.items ?? items;
  const showEmpty = !viewed && isEmpty;
  const shownCount = viewed?.userMessageCount ?? userCount;
  const dailyLeft = status.dailyLimit - status.usedToday;
  const attachDisabled = busy || limitReached || attachments.length >= MAX_ATTACHMENTS;
  const canSend = !busy && !limitReached && (input.trim().length > 0 || attachments.length > 0);
  const setupData = setup.state === 'ready' ? setup.data : null;
  const showStaticSuggestions = setup.state === 'error' || setupData?.remaining === 0;

  const renderSetup = () => {
    if (setup.state === 'loading') {
      return (
        <Stack spacing={1} role="status" aria-busy="true" aria-label={t('agent.setupLoading')}>
          <Skeleton variant="text" width="40%" />
          <Skeleton variant="rounded" height={44} />
          <Skeleton variant="rounded" height={44} />
          <Skeleton variant="rounded" height={44} />
        </Stack>
      );
    }
    if (!setupData) {return null;}
    if (setupData.remaining === 0) {
      return <AppStatusMessage severity="success" message={t('agent.setupDone')} />;
    }
    // Stable sort keeps the server's order inside the required and optional groups.
    const steps = [...setupData.steps].sort((a, b) => Number(a.optional) - Number(b.optional));
    return (
      <Stack spacing={1}>
        <Typography variant="subtitle2">{t('agent.setupRemaining').replace('{count}', String(setupData.remaining))}</Typography>
        <Stack component="ul" role="list" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {steps.map((step) => (
            <Stack
              component="li"
              key={step.key}
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ alignItems: 'center', flexWrap: 'wrap', border: 1, borderColor: 'divider', borderRadius: 2, px: 1.5, py: 1 }}
            >
              {step.done
                ? <CheckCircleRounded color="success" fontSize="small" aria-hidden />
                : <RadioButtonUncheckedRounded color="disabled" fontSize="small" aria-hidden />}
              <Box sx={{ flex: '1 1 140px', minWidth: 0 }}>
                <Typography variant="body2">{t(`agent.setup_${step.key}`)}</Typography>
                <Typography variant="caption" color={step.done ? 'success.main' : 'text.secondary'}>
                  {[t(step.done ? 'agent.setupStepDone' : 'agent.setupStepTodo'), step.optional ? t('agent.setupOptional') : null]
                    .filter(Boolean).join(' · ')}
                </Typography>
              </Box>
              {step.done ? null : (
                <Stack direction="row" spacing={1}>
                  <AppButton size="small" variant="outlined" onClick={() => void send(t(`agent.setupPrompt_${step.key}`))} disabled={busy}>
                    {t('agent.setupHelp')}
                  </AppButton>
                  {step.path ? (
                    <AppButton
                      size="small"
                      variant="text"
                      endIcon={<AppIcons.openLink fontSize="small" />}
                      onClick={() => { if (step.path) {navigate(step.path);} closePanel(); }}
                    >
                      {t('agent.openSection')}
                    </AppButton>
                  ) : null}
                </Stack>
              )}
            </Stack>
          ))}
        </Stack>
      </Stack>
    );
  };

  const renderAction = (action: AgentAction) => {
    const effectiveStatus = isExpired(action) ? 'expired' : action.status;
    const failedText = t('agent.actionFailed')
      .replace('{applied}', String(action.result?.appliedCount ?? 0))
      .replace('{total}', String(action.changes.length))
      .replace('{error}', action.result?.error ?? '');
    return (
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5, bgcolor: 'background.paper' }}>
        <Stack spacing={1.25}>
          <Typography variant="subtitle2">{action.summary}</Typography>
          <ChangeList changes={action.changes} t={t} />
          {effectiveStatus === 'pending' ? (
            <Stack direction="row" spacing={1}>
              <AppButton size="small" isLoading={resolving === action.id} onClick={() => void resolve(action, 'confirm')}>
                {t('agent.apply')}
              </AppButton>
              <AppButton size="small" variant="outlined" disabled={resolving === action.id} onClick={() => void resolve(action, 'reject')}>
                {t('agent.cancel')}
              </AppButton>
            </Stack>
          ) : null}
          <Box>
            <AppStatusBadge
              tone={STATUS_TONE[effectiveStatus]}
              label={effectiveStatus === 'failed' ? failedText : t(STATUS_TEXT[effectiveStatus])}
            />
          </Box>
        </Stack>
      </Box>
    );
  };

  const formatDate = (value: string) => new Date(value).toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  const renderHistory = () => {
    if (history.state === 'error') {
      return <Box sx={{ p: 2 }}><AppStatusMessage severity="error" message={t('agent.historyError')} /></Box>;
    }
    if (history.state !== 'ready') {
      return (
        <Stack spacing={1} sx={{ p: 2 }} role="status" aria-busy="true" aria-label={t('agent.history')}>
          <Skeleton variant="rounded" height={48} />
          <Skeleton variant="rounded" height={48} />
          <Skeleton variant="rounded" height={48} />
        </Stack>
      );
    }
    if (history.data.length === 0) {
      return <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>{t('agent.historyEmpty')}</Typography>;
    }
    const selectedId = viewed?.conversationId ?? conversationId;
    return (
      <List dense disablePadding aria-label={t('agent.history')}>
        {history.data.map((chat) => {
          const isCurrent = chat.id === conversationId;
          return (
            <ListItemButton
              key={chat.id}
              selected={chat.id === selectedId}
              disabled={openingChat !== null}
              onClick={() => void openHistoryChat(chat)}
              sx={{ borderRadius: 2, mx: 1, my: 0.25 }}
            >
              <ListItemText
                primary={chat.title || t('agent.untitledChat')}
                secondary={[
                  isCurrent ? t('agent.currentChat') : formatDate(chat.updatedAt),
                  `${chat.userMessageCount}/${chatLimit}`,
                ].join(' · ')}
                slotProps={{ primary: { noWrap: true } }}
              />
            </ListItemButton>
          );
        })}
      </List>
    );
  };

  const renderComposer = () => {
    if (viewed) {
      return (
        <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
          <Typography variant="body2" color="text.secondary">{t('agent.pastChatNote')}</Typography>
          <AppButton size="small" variant="outlined" onClick={() => setViewed(null)}>{t('agent.backToCurrent')}</AppButton>
        </Stack>
      );
    }
    if (limitReached) {
      return (
        <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
          <AppStatusMessage severity="info" message={t('agent.chatLimitReached').replace('{limit}', String(chatLimit))} />
          <AppButton size="small" onClick={startNewChat} disabled={streaming}>{t('agent.newChat')}</AppButton>
        </Stack>
      );
    }
    return (
      <>
        {attachments.length > 0 ? (
          <AttachmentChips
            attachments={attachments}
            onRemove={removeAttachment}
            removeLabel={(name) => t('agent.removeAttachment').replace('{name}', name)}
            disabled={streaming}
          />
        ) : null}
        {preparing ? (
          <Stack spacing={0.5} role="status">
            <Typography variant="caption" color="text.secondary">{t('agent.preparingFiles')}</Typography>
            <LinearProgress />
          </Stack>
        ) : null}
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-end' }}>
          <IconButton aria-label={t('agent.attach')} title={t('agent.attach')} onClick={() => fileInputRef.current?.click()} disabled={attachDisabled}>
            <AttachFileRounded />
          </IconButton>
          <IconButton
            aria-label={t('agent.takePhoto')}
            onClick={() => cameraInputRef.current?.click()}
            disabled={attachDisabled}
            sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
          >
            <PhotoCameraRounded />
          </IconButton>
          <TextField
            fullWidth
            multiline
            maxRows={5}
            size="small"
            value={input}
            placeholder={t('agent.placeholder')}
            onChange={(event) => setInput(event.target.value.slice(0, 4000))}
            onKeyDown={onKeyDown}
            slotProps={{ htmlInput: { 'aria-label': t('agent.placeholder') } }}
          />
          <IconButton color="primary" aria-label={t('agent.send')} onClick={() => void send(input)} disabled={!canSend}>
            <SendRounded />
          </IconButton>
        </Stack>
      </>
    );
  };

  return (
    <>
      <Tooltip title={t('agent.open')} placement="left">
        <Fab
          color="primary"
          aria-label={t('agent.open')}
          onClick={openPanel}
          sx={{ position: 'fixed', right: { xs: 16, md: 24 }, bottom: { xs: 16, md: 24 }, zIndex: (theme) => theme.zIndex.drawer - 1 }}
        >
          <AutoAwesomeRounded />
        </Fab>
      </Tooltip>
      <Drawer
        anchor="right"
        open={open}
        onClose={closePanel}
        slotProps={{ paper: { sx: { width: expanded ? '100vw' : { xs: '100vw', sm: 420 }, display: 'flex' } } }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ATTACHMENT_ACCEPT}
          multiple
          hidden
          tabIndex={-1}
          onChange={(event) => void addFiles(event)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          tabIndex={-1}
          onChange={(event) => void addFiles(event)}
        />
        <Stack sx={{ height: '100%' }}>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <AutoAwesomeRounded color="primary" fontSize="small" />
            <Box sx={{ flex: 1, minWidth: 0, pl: 0.5 }}>
              <Typography variant="subtitle1" component="h2" noWrap>{t('agent.title')}</Typography>
              <Typography variant="caption" color="text.secondary" component="p">
                {t('agent.chatUsage').replace('{used}', String(shownCount)).replace('{limit}', String(chatLimit))}
              </Typography>
              {dailyLeft <= DAILY_USAGE_WARNING ? (
                <Typography variant="caption" color="warning.main" component="p">
                  {t('agent.usage').replace('{used}', String(status.usedToday)).replace('{limit}', String(status.dailyLimit))}
                </Typography>
              ) : null}
            </Box>
            {expanded ? (
              <IconButton
                aria-label={t('agent.history')}
                aria-pressed={historyOnPhone}
                onClick={() => setHistoryOnPhone(!historyOnPhone)}
                sx={{ display: { xs: 'inline-flex', md: 'none' } }}
              >
                <HistoryRounded />
              </IconButton>
            ) : null}
            <AppButton size="small" variant="text" onClick={startNewChat} disabled={streaming}>{t('agent.newChat')}</AppButton>
            <Tooltip title={t(expanded ? 'agent.collapse' : 'agent.expand')}>
              <IconButton aria-label={t(expanded ? 'agent.collapse' : 'agent.expand')} onClick={toggleExpanded}>
                {expanded ? <CloseFullscreenRounded /> : <OpenInFullRounded />}
              </IconButton>
            </Tooltip>
            <IconButton aria-label={t('agent.close')} onClick={closePanel}><AppIcons.close /></IconButton>
          </Stack>

          <Stack direction="row" sx={{ flex: 1, minHeight: 0 }}>
            {expanded ? (
              <Box
                component="nav"
                aria-label={t('agent.history')}
                sx={{
                  width: { xs: '100%', md: 300 },
                  flexShrink: 0,
                  overflowY: 'auto',
                  borderRight: { md: 1 },
                  borderColor: 'divider',
                  py: 1,
                  display: { xs: historyOnPhone ? 'block' : 'none', md: 'block' },
                }}
              >
                <Typography variant="overline" color="text.secondary" sx={{ px: 2 }}>{t('agent.history')}</Typography>
                {renderHistory()}
              </Box>
            ) : null}

            <Stack
              sx={{
                flex: 1,
                minWidth: 0,
                display: { xs: expanded && historyOnPhone ? 'none' : 'flex', md: 'flex' },
              }}
            >
              <Stack spacing={1.5} sx={{ flex: 1, overflowY: 'auto', p: 2 }} aria-live="polite">
                {/* alignSelf, not margin: Stack resets its children's margins. */}
                <Stack spacing={1.5} sx={{ width: '100%', maxWidth: expanded ? 820 : 'none', alignSelf: 'center' }}>
                  {openingChat ? <LinearProgress aria-label={t('agent.history')} /> : null}
                  {showEmpty ? (
                    <Stack spacing={1.5} sx={{ py: 2 }}>
                      <Typography variant="h6">{t('agent.emptyTitle')}</Typography>
                      <Typography variant="body2" color="text.secondary">{t('agent.subtitle')}</Typography>
                      {renderSetup()}
                      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                        {showStaticSuggestions ? SUGGESTIONS.map((key) => (
                          <Chip key={key} label={t(key)} variant="outlined" onClick={() => void send(t(key))} disabled={busy} />
                        )) : null}
                        <Chip
                          label={t('agent.suggestionPriceList')}
                          variant="outlined"
                          icon={<AttachFileRounded fontSize="small" />}
                          onClick={openPriceListPicker}
                          disabled={attachDisabled}
                        />
                      </Stack>
                    </Stack>
                  ) : null}
                  {shownItems.map((item, index) => {
                    if (item.type === 'user') {
                      return (
                        <Stack key={index} spacing={0.75} sx={{ alignSelf: 'flex-end', maxWidth: '85%', bgcolor: 'primary.main', color: 'primary.contrastText', px: 1.5, py: 1, borderRadius: 2 }}>
                          {item.attachments?.length ? <AttachmentChips attachments={item.attachments} inverted /> : null}
                          {item.text ? (
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.text}</Typography>
                          ) : null}
                        </Stack>
                      );
                    }
                    if (item.type === 'assistant') {
                      return (
                        <Typography key={index} variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: '95%' }}>
                          {item.text}
                        </Typography>
                      );
                    }
                    if (item.type === 'action') {return <Box key={item.action.id}>{renderAction(item.action)}</Box>;}
                    return (
                      <Stack key={index} direction="row" spacing={1} sx={{ alignItems: 'center', border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                        <Typography variant="body2" sx={{ flex: 1 }}>{t(`agent.section_${item.section}` as TranslationKey)}</Typography>
                        <AppButton
                          size="small"
                          variant="outlined"
                          endIcon={<AppIcons.openLink fontSize="small" />}
                          onClick={() => { navigate(item.path); closePanel(); }}
                        >
                          {t('agent.openSection')}
                        </AppButton>
                      </Stack>
                    );
                  })}
                  {toolStatus && !viewed ? (
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">{t(toolStatus)}</Typography>
                      <LinearProgress />
                    </Stack>
                  ) : null}
                  {error ? <AppStatusMessage severity="error" message={t(error)} /> : null}
                  <div ref={endRef} />
                </Stack>
              </Stack>

              <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                <Stack spacing={1} sx={{ width: '100%', maxWidth: expanded ? 820 : 'none', mx: 'auto' }}>
                  {renderComposer()}
                </Stack>
              </Box>
            </Stack>
          </Stack>
        </Stack>
      </Drawer>
    </>
  );
}
