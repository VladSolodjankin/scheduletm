import axios from 'axios';
import { env } from '../config/env.js';

const BREVO_SEND_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';

type SendEmailPayload = {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
};

async function sendEmail(payload: SendEmailPayload): Promise<boolean> {
  if (!env.BREVO_API_KEY) {
    console.info('[email:stub] provider-not-configured');
    return false;
  }

  try {
    await axios.post(
      BREVO_SEND_EMAIL_URL,
      {
        sender: {
          email: env.EMAIL_FROM_ADDRESS,
          name: env.EMAIL_FROM_NAME,
        },
        to: [{ email: payload.to }],
        subject: payload.subject,
        htmlContent: payload.htmlContent,
        textContent: payload.textContent,
      },
      {
        headers: {
          'api-key': env.BREVO_API_KEY,
          'content-type': 'application/json',
        },
        timeout: 10_000,
      },
    );

    return true;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('[email] delivery-failed', {
        status: error.response?.status,
        code: error.code,
      });
    } else {
      console.error('[email] delivery-failed');
    }
    return false;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderEmailTemplate(content: {
  title: string;
  body: string;
  locale?: 'ru' | 'en';
  code?: { label: string; value: string };
  ctaLabel?: string;
  ctaLink?: string;
  footer?: string;
}): { htmlContent: string; textContent: string } {
  const footer = content.footer ?? 'Вы получили это письмо, потому что пользуетесь Meetli.';
  const ctaHtml = content.ctaLabel && content.ctaLink
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;"><tr><td bgcolor="#2563eb" style="border-radius:8px;text-align:center;"><a href="${escapeHtml(content.ctaLink)}" style="display:inline-block;padding:14px 24px;background:#2563eb;color:#ffffff;font-size:16px;font-weight:700;line-height:24px;text-decoration:none;border-radius:8px;">${escapeHtml(content.ctaLabel)}</a></td></tr></table>
      <p style="margin:0 0 8px;font-size:12px;line-height:20px;">Если кнопка не работает, откройте ссылку:</p>
      <p style="margin:0;font-size:12px;line-height:20px;word-break:break-all;overflow-wrap:anywhere;"><a href="${escapeHtml(content.ctaLink)}" style="color:#2563eb;">${escapeHtml(content.ctaLink)}</a></p>`
    : '';

  const ctaText = content.ctaLabel && content.ctaLink
    ? `\n${content.ctaLabel}: ${content.ctaLink}\n`
    : '';
  const codeHtml = content.code
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;"><tr><td align="center" bgcolor="#e8f0ff" style="padding:24px;border-radius:8px;">
        <p style="margin:0 0 8px;color:#526078;font-size:14px;line-height:20px;">${escapeHtml(content.code.label)}</p>
        <p style="margin:0;color:#0f172a;font-size:36px;font-weight:700;line-height:44px;letter-spacing:8px;">${escapeHtml(content.code.value)}</p>
      </td></tr></table>`
    : '';

  return {
    htmlContent: `
      <!doctype html>
      <html lang="${content.locale ?? 'ru'}">
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(content.title)}</title>
        <style>@media only screen and (max-width:600px){.email-outer{padding:32px 16px!important}.email-inner{padding:24px!important}}</style>
      </head>
      <body style="margin:0;padding:0;background:#f2f5f9;font-family:Inter,Arial,sans-serif;color:#526078;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(content.title)} · Meetli</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f2f5f9"><tr><td class="email-outer" align="center" style="padding:32px;">
          <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="max-width:560px;border:1px solid #d5dce7;border-top:4px solid #2563eb;border-radius:16px;table-layout:fixed;"><tr><td class="email-inner" style="padding:32px;overflow-wrap:anywhere;word-wrap:break-word;">
            <p style="margin:0 0 24px;padding-bottom:24px;border-bottom:1px solid #d5dce7;color:#2563eb;font-size:28px;line-height:36px;font-weight:700;">Meetli</p>
            <h1 style="margin:0 0 16px;color:#0f172a;font-size:28px;line-height:36px;font-weight:700;">${escapeHtml(content.title)}</h1>
            <p style="margin:0;font-size:16px;line-height:26px;">${escapeHtml(content.body)}</p>
            ${codeHtml}
            ${ctaHtml}
            <p style="margin:24px 0 0;padding-top:24px;border-top:1px solid #d5dce7;font-size:12px;line-height:20px;color:#526078;">${escapeHtml(footer)}</p>
          </td></tr></table>
          <!--[if mso]></td></tr></table><![endif]-->
          <p style="margin:24px 0 0;color:#526078;font-size:12px;line-height:20px;">Meetli · meetli.cc</p>
        </td></tr></table>
      </body></html>
    `.trim(),
    textContent: `${content.title}\n\n${content.body}${content.code ? `\n\n${content.code.label}: ${content.code.value}` : ''}${ctaText}\n\n${footer}\n\nMeetli · meetli.cc`,
  };
}

export type SendEmailVerificationInput = {
  to: string;
  firstName?: string;
  verificationCode: string;
};

export async function sendEmailVerificationEmail(input: SendEmailVerificationInput): Promise<boolean> {
  const greetingName = input.firstName?.trim() || 'пользователь';
  const template = renderEmailTemplate({
    title: 'Подтверждение email',
    body: `Здравствуйте, ${greetingName}! Введите этот код в Meetli, чтобы подтвердить email.`,
    code: { label: 'Код подтверждения', value: input.verificationCode },
    footer: 'Если это были не вы — просто проигнорируйте письмо.',
  });

  return sendEmail({
    to: input.to,
    subject: 'Meetli — подтверждение email',
    ...template,
  });
}

export type SendEmailChangeVerificationEmailInput = {
  to: string;
  firstName?: string;
  verificationCode: string;
};

export async function sendEmailChangeVerificationEmail(input: SendEmailChangeVerificationEmailInput): Promise<boolean> {
  const greetingName = input.firstName?.trim() || 'пользователь';
  const template = renderEmailTemplate({
    title: 'Подтверждение нового email',
    body: `Здравствуйте, ${greetingName}! Введите этот код в Meetli, чтобы подтвердить новый email.`,
    code: { label: 'Код подтверждения', value: input.verificationCode },
    footer: 'Если вы не запрашивали смену email — просто проигнорируйте письмо.',
  });

  return sendEmail({
    to: input.to,
    subject: 'Meetli — подтверждение нового email',
    ...template,
  });
}

export type SendPasswordResetEmailInput = {
  to: string;
  firstName?: string;
  locale?: string;
  resetCode: string;
};

export async function sendPasswordResetEmail(input: SendPasswordResetEmailInput): Promise<boolean> {
  const isEnglish = input.locale?.toLowerCase().startsWith('en');
  const greetingName = input.firstName?.trim() || (isEnglish ? 'there' : 'пользователь');
  const template = renderEmailTemplate(isEnglish ? {
    locale: 'en',
    title: 'Password reset',
    body: `Hello, ${greetingName}! Enter this code in Meetli to reset your password.`,
    code: { label: 'Password reset code', value: input.resetCode },
    footer: 'The code is valid for 10 minutes. If you did not request a reset, ignore this email.',
  } : {
    title: 'Восстановление пароля',
    body: `Здравствуйте, ${greetingName}! Введите этот код в Meetli, чтобы восстановить пароль.`,
    code: { label: 'Код восстановления', value: input.resetCode },
    footer: 'Код действует 10 минут. Если вы не запрашивали восстановление, проигнорируйте письмо.',
  });

  return sendEmail({
    to: input.to,
    subject: isEnglish ? 'Meetli — password reset' : 'Meetli — восстановление пароля',
    ...template,
  });
}

export type SendRegistrationSuccessEmailInput = {
  to: string;
  firstName?: string;
};

export async function sendRegistrationSuccessEmail(input: SendRegistrationSuccessEmailInput): Promise<boolean> {
  const greetingName = input.firstName?.trim() || 'пользователь';
  const template = renderEmailTemplate({
    title: 'Регистрация завершена',
    body: `Здравствуйте, ${greetingName}! Ваш email подтверждён, аккаунт успешно активирован.`,
  });

  return sendEmail({
    to: input.to,
    subject: 'Meetli — регистрация завершена',
    ...template,
  });
}

export type SendManagedUserInviteEmailInput = {
  to: string;
  firstName: string;
  inviteLink: string;
};

export async function sendManagedUserInviteEmail(input: SendManagedUserInviteEmailInput): Promise<boolean> {
  const template = renderEmailTemplate({
    title: 'Приглашение в Meetli',
    body: `Здравствуйте, ${input.firstName}! Для завершения регистрации перейдите по ссылке и задайте пароль.`,
    ctaLabel: 'Принять приглашение',
    ctaLink: input.inviteLink,
    footer: 'Ссылка действует 24 часа и может быть использована только один раз.',
  });

  return sendEmail({
    to: input.to,
    subject: 'Meetli — приглашение в аккаунт',
    ...template,
  });
}

export type SendAppointmentNotificationEmailInput = {
  to: string;
  clientName: string;
  specialistName: string;
  scheduledAt: string;
};

export async function sendAppointmentNotificationEmail(input: SendAppointmentNotificationEmailInput): Promise<boolean> {
  const template = renderEmailTemplate({
    title: 'Напоминание о записи',
    body: `${input.clientName}, у вас запись к специалисту ${input.specialistName} на ${input.scheduledAt}.`,
  });

  return sendEmail({
    to: input.to,
    subject: 'Meetli — напоминание о записи',
    ...template,
  });
}
