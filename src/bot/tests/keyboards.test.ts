import { describe, expect, it } from 'vitest';

import {
  getBookingFinalInlineKeyboard,
  getDatesInlineKeyboardWithPagination,
  getMultiSessionModeKeyboard,
  getSpecialistsInlineKeyboard,
} from '../keyboards';

describe('getBookingFinalInlineKeyboard', () => {
  it('returns localized calendar choice buttons and payment button with URLs', () => {
    const keyboard = getBookingFinalInlineKeyboard(
      'ru',
      'https://calendar.google.com/calendar/render?x=1',
      'https://example.com/calendar/apple.ics?x=2',
      'https://outlook.live.com/calendar/0/deeplink/compose?x=3',
      'https://example.com/pay/15',
    );

    expect(keyboard).toEqual({
      inline_keyboard: [
        [{ text: '📅 Google Calendar', url: 'https://calendar.google.com/calendar/render?x=1' }],
        [{ text: '🍎 Apple Calendar (.ics)', url: 'https://example.com/calendar/apple.ics?x=2' }],
        [{ text: '🪟 Microsoft Calendar', url: 'https://outlook.live.com/calendar/0/deeplink/compose?x=3' }],
        [{ text: '💳 Перейти к оплате', url: 'https://example.com/pay/15' }],
      ],
    });
  });
});

describe('getSpecialistsInlineKeyboard', () => {
  it('adds a back button to return to services step', () => {
    const keyboard = getSpecialistsInlineKeyboard(
      [{ id: 5, name: 'Dr. Smith' }],
      'ru',
    );

    expect(keyboard).toEqual({
      inline_keyboard: [
        [{ text: 'Dr. Smith', callback_data: 'specialist:5' }],
        [{ text: '⬅️ Назад', callback_data: 'back:services' }],
      ],
    });
  });
});

describe('getDatesInlineKeyboardWithPagination', () => {
  it('adds prev/next page controls when requested', () => {
    const keyboard = getDatesInlineKeyboardWithPagination(
      ['2026-04-20', '2026-04-21'],
      14,
      true,
      true,
    );

    expect(keyboard).toEqual({
      inline_keyboard: [
        [{ text: '2026-04-20', callback_data: 'date:2026-04-20' }],
        [{ text: '2026-04-21', callback_data: 'date:2026-04-21' }],
        [
          { text: '⬅️', callback_data: 'date_nav:0' },
          { text: '➡️', callback_data: 'date_nav:28' },
        ],
      ],
    });
  });
});

describe('getMultiSessionModeKeyboard', () => {
  it('returns clear options for package booking strategy', () => {
    const keyboard = getMultiSessionModeKeyboard('ru');
    expect(keyboard.inline_keyboard).toHaveLength(2);
    expect(keyboard.inline_keyboard[0][0].callback_data).toBe('multisession:same');
    expect(keyboard.inline_keyboard[1][0].callback_data).toBe('multisession:custom');
  });
});
