import { sendMessage } from '../bot/bot';
import { normalizeLanguageCode, t } from '../i18n';

type SendBookingStubNotificationInput = {
  chatId: number;
  languageCode?: string | null;
  hasPhone: boolean;
  hasEmail: boolean;
  selectedDate: string;
  selectedTime: string;
  serviceName: string;
};

export async function sendBookingStubNotification(
  input: SendBookingStubNotificationInput,
) {
  const lang = normalizeLanguageCode(input.languageCode);
  const channels: string[] = [];

  if (input.hasPhone) channels.push(t(lang, 'booking.channelPhone'));
  if (input.hasEmail) channels.push(t(lang, 'booking.channelEmail'));

  if (!channels.length) {
    return;
  }

  await sendMessage(
    input.chatId,
    t(lang, 'booking.notificationStub', {
      service: input.serviceName,
      date: input.selectedDate,
      time: input.selectedTime,
      channels: channels.join(', '),
    }),
  );
}
