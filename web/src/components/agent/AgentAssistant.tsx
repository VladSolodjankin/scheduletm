import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import {
  Box,
  Chip,
  Drawer,
  Fab,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  agentApi,
  AgentRequestError,
  streamAgentChat,
  type AgentAction,
  type AgentChange,
  type AgentHistoryItem,
  type AgentStatus,
} from '../../shared/api/agent';
import { useAuth } from '../../shared/auth/AuthContext';
import type { TranslationKey } from '../../shared/i18n/dictionaries';
import { useI18n } from '../../shared/i18n/I18nContext';
import { AppButton } from '../../shared/ui/AppButton';
import { AppIcons } from '../../shared/ui/AppIcons';
import { AppStatusBadge, AppStatusMessage, type AppStatusTone } from '../../shared/ui/AppStatus';

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
};

const ERROR_TEXT: Record<string, TranslationKey> = {
  agent_unavailable: 'agent.errorUnavailable',
  agent_daily_limit: 'agent.errorLimit',
  agent_busy: 'agent.errorBusy',
  agent_refused: 'agent.errorRefused',
  session_expired: 'agent.errorSession',
};

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
    value: key === 'specialistId' || key === 'userId' ? `#${String(value)}` : formatValue(value),
    before: change.before && key in change.before ? formatValue(change.before[key]) : undefined,
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
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState<AgentHistoryItem[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [toolStatus, setToolStatus] = useState<TranslationKey | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!accessToken) {return;}
    agentApi.status(accessToken).then(setStatus).catch(() => setStatus(null));
  }, [accessToken]);

  const openPanel = () => {
    setOpen(true);
    if (loaded || !accessToken) {return;}
    setLoaded(true);
    agentApi.latest(accessToken)
      .then((conversation) => {
        if (!conversation) {return;}
        setConversationId(conversation.conversationId);
        setItems(conversation.items);
      })
      .catch(() => setError('agent.errorGeneric'));
  };

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [items, toolStatus]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const updateAction = useCallback((action: AgentAction) => {
    setItems((current) => current.map((item) => (item.type === 'action' && item.action.id === action.id ? { type: 'action', action } : item)));
  }, []);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || streaming || !accessToken) {return;}
    setInput('');
    setError(null);
    setStreaming(true);
    setToolStatus('agent.thinking' as TranslationKey);
    setItems((current) => [...current, { type: 'user', text: message }]);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamAgentChat({
        accessToken,
        conversationId,
        message,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === 'conversation') {setConversationId(event.conversationId);}
          if (event.type === 'tool') {setToolStatus(TOOL_STATUS[event.name] ?? 'agent.thinking');}
          if (event.type === 'error') {setError(ERROR_TEXT[event.code] ?? 'agent.errorGeneric');}
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
    } catch (caught) {
      if (!controller.signal.aborted) {
        setError(caught instanceof AgentRequestError ? (ERROR_TEXT[caught.code] ?? 'agent.errorGeneric') : 'agent.errorGeneric');
      }
    } finally {
      setStreaming(false);
      setToolStatus(null);
    }
  }, [accessToken, conversationId, streaming]);

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
      const latest = await agentApi.latest(accessToken).catch(() => null);
      const fresh = latest?.items.find((item) => item.type === 'action' && item.action.id === action.id);
      if (fresh?.type === 'action') {updateAction(fresh.action);}
    } finally {
      setResolving(null);
    }
  }, [accessToken, updateAction, onChangesApplied]);

  const startNewChat = () => {
    abortRef.current?.abort();
    setConversationId(null);
    setItems([]);
    setError(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  };

  if (!status?.available) {return null;}

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
        onClose={() => setOpen(false)}
        slotProps={{ paper: { sx: { width: { xs: '100vw', sm: 420 }, display: 'flex' } } }}
      >
        <Stack sx={{ height: '100%' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <AutoAwesomeRounded color="primary" fontSize="small" />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" component="h2">{t('agent.title')}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t('agent.usage').replace('{used}', String(status.usedToday)).replace('{limit}', String(status.dailyLimit))}
              </Typography>
            </Box>
            <AppButton size="small" variant="text" onClick={startNewChat} disabled={streaming}>{t('agent.newChat')}</AppButton>
            <IconButton aria-label={t('agent.close')} onClick={() => setOpen(false)}><AppIcons.close /></IconButton>
          </Stack>

          <Stack spacing={1.5} sx={{ flex: 1, overflowY: 'auto', p: 2 }} aria-live="polite">
            {items.length === 0 ? (
              <Stack spacing={1.5} sx={{ py: 2 }}>
                <Typography variant="h6">{t('agent.emptyTitle')}</Typography>
                <Typography variant="body2" color="text.secondary">{t('agent.subtitle')}</Typography>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {SUGGESTIONS.map((key) => (
                    <Chip key={key} label={t(key)} variant="outlined" onClick={() => void send(t(key))} disabled={streaming} />
                  ))}
                </Stack>
              </Stack>
            ) : null}
            {items.map((item, index) => {
              if (item.type === 'user') {
                return (
                  <Box key={index} sx={{ alignSelf: 'flex-end', maxWidth: '85%', bgcolor: 'primary.main', color: 'primary.contrastText', px: 1.5, py: 1, borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.text}</Typography>
                  </Box>
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
                    onClick={() => { navigate(item.path); setOpen(false); }}
                  >
                    {t('agent.openSection')}
                  </AppButton>
                </Stack>
              );
            })}
            {toolStatus ? (
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary">{t(toolStatus)}</Typography>
                <LinearProgress />
              </Stack>
            ) : null}
            {error ? <AppStatusMessage severity="error" message={t(error)} /> : null}
            <div ref={endRef} />
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end', p: 2, borderTop: 1, borderColor: 'divider' }}>
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
            <IconButton color="primary" aria-label={t('agent.send')} onClick={() => void send(input)} disabled={streaming || !input.trim()}>
              <SendRounded />
            </IconButton>
          </Stack>
        </Stack>
      </Drawer>
    </>
  );
}
