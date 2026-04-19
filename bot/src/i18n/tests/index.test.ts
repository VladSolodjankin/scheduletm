import { describe, expect, it } from 'vitest';
import { normalizeLanguageCode, t } from '../index';

describe('i18n', () => {
  it('normalizes language codes', () => {
    expect(normalizeLanguageCode(undefined)).toBe('ru');
    expect(normalizeLanguageCode(null)).toBe('ru');
    expect(normalizeLanguageCode('ru')).toBe('ru');
    expect(normalizeLanguageCode('ru-RU')).toBe('ru');
    expect(normalizeLanguageCode('en')).toBe('en');
    expect(normalizeLanguageCode('en-US')).toBe('en');
    expect(normalizeLanguageCode('de')).toBe('ru');
  });

  it('renders translation with params', () => {
    const out = t('ru', 'booking.confirmService', { value: 'Тест' });
    expect(out).toContain('Тест');
  });

  it('replaces multiple params in one string', () => {
    const out = t('en', 'booking.notificationStub', {
      service: 'Service',
      date: '2026-04-18',
      time: '09:00',
      channels: 'email',
    });

    expect(out).toContain('Service');
    expect(out).toContain('2026-04-18');
    expect(out).toContain('09:00');
    expect(out).toContain('email');
    expect(out).not.toContain('{{service}}');
  });

  it('falls back to ru, then to key', () => {
    expect(t('en', 'start.chooseAction')).toBeTruthy();
    expect(t('en', 'this.key.does.not.exist')).toBe('this.key.does.not.exist');
  });
});
