import { describe, expect, it } from 'vitest';

import { getBookingFinalInlineKeyboard } from '../keyboards';

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
