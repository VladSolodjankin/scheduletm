export type SendWelcomePasswordEmailInput = {
  to: string;
  firstName: string;
  temporaryPassword: string;
};

export async function sendWelcomePasswordEmail(input: SendWelcomePasswordEmailInput): Promise<void> {
  // Integration with real email provider will be added later.
  console.info('[email:stub] welcome-password', {
    to: input.to,
    firstName: input.firstName,
    temporaryPassword: input.temporaryPassword,
  });
}
