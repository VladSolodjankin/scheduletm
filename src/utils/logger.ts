export type LogLevel = 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

function emit(level: LogLevel, message: string, context: LogContext = {}) {
  const payload = {
    level,
    message,
    ts: new Date().toISOString(),
    ...context,
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
