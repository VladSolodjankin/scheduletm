import { beforeEach, describe, expect, it, vi } from 'vitest';

type EmailPayload = {
  to: { email: string }[];
  subject: string;
  htmlContent: string;
  textContent: string;
};
const axiosPostMock = vi.hoisted(() => vi.fn<(url: string, payload: EmailPayload, options: unknown) => Promise<unknown>>());
vi.mock('axios', () => ({ default: { post: axiosPostMock, isAxiosError: () => false } }));
vi.mock('../src/config/env.js', () => ({
  env: { BREVO_API_KEY: 'configured', EMAIL_FROM_ADDRESS: 'sender@example.com', EMAIL_FROM_NAME: 'Meetli' },
}));
const emails = await import('../src/services/emailDeliveryService.js');
const recipient = 'recipient@example.com';
const name = 'A <script>alert("name")</script> & B';
const link = `https://meetli.cc/invite?token=${'a'.repeat(200)}&email=a%40example.com&label="test"`;
const scheduledAt = '2026-09-21T13:00:00.000Z';

describe('branded email payloads', () => {
  beforeEach(() => { axiosPostMock.mockReset(); axiosPostMock.mockResolvedValue({}); });

  const cases = [
    { subject: 'Meetli — подтверждение email', send: () => emails.sendEmailVerificationEmail({ to: recipient, firstName: name, verificationCode: '0042' }), code: true },
    { subject: 'Meetli — подтверждение нового email', send: () => emails.sendEmailChangeVerificationEmail({ to: recipient, firstName: name, verificationCode: '0042' }), code: true },
    { subject: 'Meetli — восстановление пароля', send: () => emails.sendPasswordResetEmail({ to: recipient, firstName: name, resetCode: '0042', locale: 'ru' }), code: true },
    { subject: 'Meetli — password reset', send: () => emails.sendPasswordResetEmail({ to: recipient, firstName: name, resetCode: '0042', locale: 'en-US' }), code: true, english: true },
    { subject: 'Meetli — регистрация завершена', send: () => emails.sendRegistrationSuccessEmail({ to: recipient, firstName: name }) },
    { subject: 'Meetli — приглашение в аккаунт', send: () => emails.sendManagedUserInviteEmail({ to: recipient, firstName: name, inviteLink: link }), invite: true },
    { subject: 'Meetli — напоминание о записи', send: () => emails.sendAppointmentNotificationEmail({ to: recipient, clientName: name, specialistName: 'Doctor <A> & B', scheduledAt }), reminder: true },
  ];
  it.each(cases)('preserves delivery contract and escapes dynamic data: $subject', async ({ subject, send, code, english, invite, reminder }) => {
    await expect(send()).resolves.toBe(true);
    expect(axiosPostMock).toHaveBeenCalledTimes(1);
    const [url, payload] = axiosPostMock.mock.calls[0]!;
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(payload.to).toEqual([{ email: recipient }]);
    expect(payload.subject).toBe(subject);
    expect(payload.htmlContent).toContain(`<html lang="${english ? 'en' : 'ru'}">`);
    expect(payload.htmlContent).toContain('&lt;script&gt;alert(&quot;name&quot;)&lt;/script&gt; &amp; B');
    expect(payload.htmlContent).not.toContain('<script>');
    expect(payload.textContent).toContain(name);
    if (code) {
      expect(payload.htmlContent).toContain('>0042</p>');
      expect(payload.textContent).toContain(': 0042');
      expect(payload.htmlContent.match(/<div[^>]*>(.*?)<\/div>/)?.[1]).not.toContain('0042');
    }
    if (invite) {
      const escapedLink = link.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      expect(payload.htmlContent).toContain(`href="${escapedLink}"`);
      expect(payload.htmlContent).toContain(`>${escapedLink}</a>`);
      expect(payload.textContent).toContain(link);
      expect(payload.textContent).toContain('24 часа');
    }
    if (reminder) {
      expect(payload.htmlContent).toContain('Doctor &lt;A&gt; &amp; B');
      expect(payload.htmlContent).toContain(scheduledAt);
      expect(payload.textContent).toContain(scheduledAt);
    }
    if (subject.includes('reset') || subject.includes('восстановление')) {
      expect(payload.textContent).toContain(english ? '10 minutes' : '10 минут');
    }
  });

  it('retains greeting fallbacks and long names without truncating content', async () => {
    await emails.sendPasswordResetEmail({ to: recipient, resetCode: '0042', locale: 'en', firstName: ' ' });
    expect(axiosPostMock.mock.calls[0]![1].textContent).toContain('Hello, there!');
    await emails.sendEmailVerificationEmail({ to: recipient, verificationCode: '0042' });
    expect(axiosPostMock.mock.calls[1]![1].textContent).toContain('Здравствуйте, пользователь!');
    const longName = 'Александра'.repeat(40);
    await emails.sendRegistrationSuccessEmail({ to: recipient, firstName: longName });
    expect(axiosPostMock.mock.calls[2]![1].htmlContent).toContain(longName);
  });
});
