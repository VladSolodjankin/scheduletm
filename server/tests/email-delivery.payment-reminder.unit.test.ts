import { beforeEach, describe, expect, it, vi } from 'vitest';

type EmailPayload = { subject: string; htmlContent: string; textContent: string };
const axiosPostMock = vi.hoisted(() => vi.fn<(url: string, payload: EmailPayload, options: unknown) => Promise<unknown>>());
vi.mock('axios', () => ({ default: { post: axiosPostMock, isAxiosError: () => false } }));
vi.mock('../src/config/env.js', () => ({
  env: { BREVO_API_KEY: 'configured', EMAIL_FROM_ADDRESS: 'sender@example.com', EMAIL_FROM_NAME: 'Meetli' },
}));
const emails = await import('../src/services/emailDeliveryService.js');

const base = {
  to: 'client@example.com',
  clientName: 'Anna',
  specialistName: 'Dr. <b>Who</b>',
  scheduledAt: 'Friday 10:00',
  notificationType: 'payment_reminder' as const,
  serviceName: 'Consultation',
};

const payment = {
  amountText: '1 500 RUB',
  payUrl: 'https://app.test/pay/tok123',
  bankTransferText: 'IBAN GE00 <1>\nBank X',
  customLink: { title: 'PayPal', url: 'https://paypal.me/x' },
  cashComment: 'At the office',
};

describe('payment reminder email', () => {
  beforeEach(() => { axiosPostMock.mockReset(); axiosPostMock.mockResolvedValue({}); });

  const send = async (input: Parameters<typeof emails.sendAppointmentNotificationEmail>[0]) => {
    await emails.sendAppointmentNotificationEmail(input);
    return axiosPostMock.mock.calls[0]![1];
  };

  it('renders a Pay button, the amount and the manual methods block (ru)', async () => {
    const payload = await send({ ...base, payment });
    expect(payload.subject).toBe('Meetli - напоминание об оплате');
    expect(payload.htmlContent).toContain('Оплатить онлайн');
    expect(payload.htmlContent).toContain('href="https://app.test/pay/tok123"');
    expect(payload.htmlContent).toContain('Или оплатите другим способом');
    expect(payload.htmlContent).toContain('IBAN GE00 &lt;1&gt;');
    expect(payload.htmlContent).toContain('href="https://paypal.me/x"');
    expect(payload.htmlContent).toContain('At the office');
    expect(payload.htmlContent).toContain('Dr. &lt;b&gt;Who&lt;/b&gt;');
    expect(payload.textContent).toContain('Оплатить онлайн: https://app.test/pay/tok123');
    expect(payload.textContent).toContain('Сумма: 1 500 RUB');
  });

  it('renders English copy for an en locale', async () => {
    const payload = await send({ ...base, locale: 'en', payment });
    expect(payload.subject).toBe('Meetli - payment reminder');
    expect(payload.htmlContent).toContain('<html lang="en">');
    expect(payload.htmlContent).toContain('Pay online');
    expect(payload.htmlContent).toContain('Or pay another way');
    expect(payload.htmlContent).toContain('If the button does not work');
    expect(payload.htmlContent).not.toMatch(/Оплатить|Если кнопка/);
  });

  it('omits the pay button when there is no online payment and shows only enabled manual methods', async () => {
    const payload = await send({
      ...base,
      payment: { ...payment, payUrl: null, customLink: null, cashComment: null },
    });
    expect(payload.htmlContent).not.toContain('Оплатить онлайн');
    expect(payload.htmlContent).not.toContain('paypal');
    expect(payload.htmlContent).toContain('Банковский перевод');
  });

  it('marks test reminders with a banner', async () => {
    const payload = await send({ ...base, locale: 'en', payment: { ...payment, isTest: true } });
    expect(payload.htmlContent).toContain('This is a test reminder');
  });

  it('keeps the manage link CTA for other notification types', async () => {
    const payload = await send({ ...base, notificationType: 'appointment_created', manageUrl: 'https://app.test/appointments/manage/x' });
    expect(payload.htmlContent).toContain('Управлять записью');
  });
});
