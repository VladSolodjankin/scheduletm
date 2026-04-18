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
  // Intentionally disabled for now.
  // We keep this stub to preserve future notification workflow entry-point,
  // but actual reminder delivery will be moved to a dedicated background job.
  void input;
}
