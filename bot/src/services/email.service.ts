import axios from 'axios';
import { env } from '../config/env';

const BREVO_SEND_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';

export class EmailNotConfiguredError extends Error {
  constructor() {
    super('Email provider not configured (BREVO_API_KEY missing)');
  }
}

export type SendEmailInput = {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
};

export async function sendBrevoEmail(input: SendEmailInput): Promise<void> {
  if (!env.brevoApiKey) {
    throw new EmailNotConfiguredError();
  }

  await axios.post(
    BREVO_SEND_EMAIL_URL,
    {
      sender: {
        email: env.emailFromAddress,
        name: env.emailFromName,
      },
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.htmlContent,
      textContent: input.textContent,
    },
    {
      headers: {
        'api-key': env.brevoApiKey,
        'content-type': 'application/json',
      },
      timeout: 10_000,
    },
  );
}
