import axios from 'axios';
import crypto from 'node:crypto';
import { db } from '../db/knex';
import { env } from '../config/env';

const BREVO_SEND_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';

function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');
}

async function sendManagedUserInviteEmail(input: {
  to: string;
  firstName: string;
  inviteLink: string;
}): Promise<boolean> {
  if (!env.brevoApiKey) {
    return false;
  }

  try {
    await axios.post(
      BREVO_SEND_EMAIL_URL,
      {
        sender: {
          email: env.emailFromAddress,
          name: env.emailFromName,
        },
        to: [{ email: input.to }],
        subject: 'Meetli — приглашение в аккаунт',
        htmlContent: `
          <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;max-width:560px;margin:0 auto;">
            <h2>Приглашение в Meetli</h2>
            <p>Здравствуйте, ${input.firstName}! Для завершения регистрации перейдите по ссылке и задайте пароль.</p>
            <p><a href="${input.inviteLink}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;">Принять приглашение</a></p>
            <p style="color:#6b7280;font-size:12px;">Ссылка действует 24 часа и может быть использована только один раз.</p>
          </div>
        `.trim(),
        textContent: `Приглашение в Meetli\n\nЗдравствуйте, ${input.firstName}! Для завершения регистрации перейдите по ссылке и задайте пароль.\n\nПринять приглашение: ${input.inviteLink}\n\nСсылка действует 24 часа и может быть использована только один раз.`,
      },
      {
        headers: {
          'api-key': env.brevoApiKey,
          'content-type': 'application/json',
        },
        timeout: 10_000,
      },
    );

    return true;
  } catch (error) {
    console.error('[bot:web-user-onboarding] invite-email-failed', error);
    return false;
  }
}

type EnsureClientWebUserInput = {
  accountId: number;
  clientId: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  telegramUsername?: string | null;
  timezone?: string | null;
};

export async function ensureClientWebUserInvite(input: EnsureClientWebUserInput): Promise<{
  invited: boolean;
  skipped: boolean;
}> {
  const email = sanitizeEmail(input.email);
  type WebUserCandidate = {
    id: number;
    role: string;
    first_name: string | null;
    email_verified_at: Date | null;
    password_salt: string;
    client_id: number | null;
  };

  const existingByClient = await db('web_users')
    .where({ account_id: input.accountId, client_id: input.clientId })
    .first<WebUserCandidate>();

  const existingByEmail = await db('web_users')
    .where({ account_id: input.accountId, email })
    .first<WebUserCandidate>();

  if (existingByEmail && existingByEmail.role !== 'client') {
    return { invited: false, skipped: true };
  }

  const target = existingByClient ?? existingByEmail ?? null;
  const firstName = (input.firstName?.trim() || target?.first_name || 'пользователь');

  if (target) {
    if (target.email_verified_at) {
      if (!target.client_id) {
        await db('web_users')
          .where({ id: target.id, account_id: input.accountId })
          .update({ client_id: input.clientId, updated_at: db.fn.now() });
      }
      return { invited: false, skipped: true };
    }

    const inviteToken = createToken();
    const inviteHash = hashPassword(inviteToken, target.password_salt);
    await db('web_users')
      .where({ id: target.id, account_id: input.accountId })
      .update({
        email,
        client_id: input.clientId,
        telegram_username: input.telegramUsername?.trim() ?? null,
        first_name: input.firstName?.trim() || null,
        last_name: input.lastName?.trim() || null,
        email_verification_code: inviteHash,
        email_verification_sent_at: new Date(),
        is_active: false,
        updated_at: db.fn.now(),
      });

    const inviteLink = `${env.emailVerifyBaseUrl.replace(/\/+$/, '')}/invite/accept?email=${encodeURIComponent(email)}&token=${encodeURIComponent(inviteToken)}`;
    const invited = await sendManagedUserInviteEmail({ to: email, firstName, inviteLink });
    return { invited, skipped: false };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const inviteToken = createToken();
  const inviteHash = hashPassword(inviteToken, salt);
  const randomPasswordHash = hashPassword(createToken(), salt);

  await db('web_users')
    .insert({
      account_id: input.accountId,
      email,
      role: 'client',
      first_name: input.firstName?.trim() || null,
      last_name: input.lastName?.trim() || null,
      phone: null,
      telegram_username: input.telegramUsername?.trim() ?? null,
      client_id: input.clientId,
      password_hash: randomPasswordHash,
      password_salt: salt,
      timezone: input.timezone?.trim() || 'UTC',
      email_verification_code: inviteHash,
      email_verification_sent_at: new Date(),
      email_verified_at: null,
      is_active: false,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
      last_login_at: null,
      phone_verified_at: null,
    });

  const inviteLink = `${env.emailVerifyBaseUrl.replace(/\/+$/, '')}/invite/accept?email=${encodeURIComponent(email)}&token=${encodeURIComponent(inviteToken)}`;
  const invited = await sendManagedUserInviteEmail({ to: email, firstName, inviteLink });

  return { invited, skipped: false };
}
