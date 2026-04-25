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
    console.info('[email:stub] provider-not-configured', payload);
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
    console.error('[email] delivery-failed', error);
    return false;
  }
}

function renderEmailTemplate(content: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaLink?: string;
  footer?: string;
}): { htmlContent: string; textContent: string } {
  const ctaHtml = content.ctaLabel && content.ctaLink
    ? `<p><a href="${content.ctaLink}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;">${content.ctaLabel}</a></p>`
    : '';

  const ctaText = content.ctaLabel && content.ctaLink
    ? `\n${content.ctaLabel}: ${content.ctaLink}\n`
    : '';

  return {
    htmlContent: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;max-width:560px;margin:0 auto;">
        <h2>${content.title}</h2>
        <p>${content.body}</p>
        ${ctaHtml}
        ${content.footer ? `<p style="color:#6b7280;font-size:12px;">${content.footer}</p>` : ''}
      </div>
    `.trim(),
    textContent: `${content.title}\n\n${content.body}${ctaText}${content.footer ? `\n${content.footer}` : ''}`,
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
    body: `Здравствуйте, ${greetingName}! Код подтверждения: ${input.verificationCode}`,
    footer: 'Если это были не вы — просто проигнорируйте письмо.',
  });

  return sendEmail({
    to: input.to,
    subject: 'Meetli — подтверждение email',
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
