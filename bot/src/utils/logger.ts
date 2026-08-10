export type LogLevel = 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

const ALLOWED_KEYS = new Set([
  'account_id',
  'alert',
  'auto_set_webhook',
  'code',
  'count',
  'deleted_count',
  'error',
  'last_error_date',
  'level',
  'message',
  'name',
  'node_env',
  'pending_update_count',
  'port',
  'processed',
  'reason',
  'request_id',
  'result',
  'specialist_id',
  'status',
  'ts',
  'update_id',
]);

const REDACTED_KEYS = /^(?:authorization|body|chat(?:_id)?|email|first_?name|ip|last_?name|message(?:_text)?|payload(?:_json)?|phone|recipient|secret|token|url|user(?:_id)?)$/i;
const MAX_DEPTH = 5;
const MAX_STRING_LENGTH = 500;

function sanitizeError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: '[redacted]',
  };
}

export function sanitizeLogValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[truncated]';
  if (value instanceof Error) return sanitizeError(value);
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH);
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeLogValue(item, depth + 1));
  }
  if (typeof value !== 'object') return String(value).slice(0, MAX_STRING_LENGTH);

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (REDACTED_KEYS.test(key)) {
      sanitized[key] = '[redacted]';
      continue;
    }
    if (!ALLOWED_KEYS.has(key)) continue;
    sanitized[key] = sanitizeLogValue(child, depth + 1);
  }
  return sanitized;
}

function emit(level: LogLevel, message: string, context: LogContext = {}) {
  const payload = {
    level,
    message,
    ts: new Date().toISOString(),
    ...(sanitizeLogValue(context) as LogContext),
  };

  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
    return;
  }

  console.log(line);
}

export function logInfo(message: string, context: LogContext = {}) {
  emit('info', message, context);
}

export function logWarn(message: string, context: LogContext = {}) {
  emit('warn', message, context);
}

export function logError(message: string, context: LogContext = {}) {
  emit('error', message, context);
}
