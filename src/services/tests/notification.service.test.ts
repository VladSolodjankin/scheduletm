import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../bot/bot', () => {
  return {
    sendMessage: vi.fn(),
  };
});

describe('sendBookingStubNotification', () => {
  beforeEach(() => {
    // Ensure the module under test is evaluated with the mocked bot module.
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('does nothing when no channels are available', async () => {
    const { sendBookingStubNotification } = await import('../notification.service');
    const { sendMessage } = await import('../../bot/bot');

    await sendBookingStubNotification({
      chatId: 1,
      languageCode: 'ru',
      hasPhone: false,
      hasEmail: false,
      selectedDate: '2026-04-18',
      selectedTime: '09:00',
      serviceName: 'Test',
    });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('does nothing even when channels are available (stubbed)', async () => {
    const { sendBookingStubNotification } = await import('../notification.service');
    const { sendMessage } = await import('../../bot/bot');

    await sendBookingStubNotification({
      chatId: 1,
      languageCode: 'ru',
      hasPhone: true,
      hasEmail: true,
      selectedDate: '2026-04-18',
      selectedTime: '09:00',
      serviceName: 'Тест',
    });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('does nothing for other languages too', async () => {
    const { sendBookingStubNotification } = await import('../notification.service');
    const { sendMessage } = await import('../../bot/bot');

    await sendBookingStubNotification({
      chatId: 1,
      languageCode: 'en-US',
      hasPhone: true,
      hasEmail: false,
      selectedDate: '2026-04-18',
      selectedTime: '09:00',
      serviceName: 'Test',
    });

    expect(sendMessage).not.toHaveBeenCalled();
  });
});
