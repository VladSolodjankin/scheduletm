import { afterEach, describe, expect, it, vi } from 'vitest';
import { logError, logInfo, sanitizeLogValue } from '../logger';

describe('logger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('recursively redacts PII and drops fields outside the allowlist', () => {
    expect(sanitizeLogValue({
      request_id: 'request-1',
      secret: 'secret-value',
      result: {
        pending_update_count: 2,
        url: 'https://example.test/telegram/webhook/secret-value',
        description: 'not allowlisted',
        nested: { email: 'person@example.test' },
      },
    })).toEqual({
      request_id: 'request-1',
      secret: '[redacted]',
      result: {
        pending_update_count: 2,
        url: '[redacted]',
      },
    });
  });

  it('serializes errors without stack or custom properties', () => {
    const error = Object.assign(new Error('database unavailable'), {
      password: 'sensitive',
    });
    expect(sanitizeLogValue(error)).toEqual({
      name: 'Error',
      message: '[redacted]',
    });
  });

  it('emits sanitized structured context', () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    logInfo('test.event', {
      count: 1,
      phone: '+15555555555',
      arbitrary: 'discarded',
    });

    const payload = JSON.parse(String(output.mock.calls[0]?.[0]));
    expect(payload).toMatchObject({
      level: 'info',
      message: 'test.event',
      count: 1,
      phone: '[redacted]',
    });
    expect(payload.arbitrary).toBeUndefined();
  });

  it('uses the sanitized error channel', () => {
    const output = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logError('test.failed', { error: new Error('safe summary') });
    expect(JSON.parse(String(output.mock.calls[0]?.[0])).error).toEqual({
      name: 'Error',
      message: '[redacted]',
    });
  });
});
