import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosPostMock = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: {
    post: axiosPostMock,
    isAxiosError: (error: unknown) => Boolean(
      error && typeof error === 'object' && 'isAxiosError' in error,
    ),
  },
}));

vi.mock('../src/config/env.js', () => ({
  env: {
    BREVO_API_KEY: 'configured',
    EMAIL_FROM_ADDRESS: 'sender@example.com',
    EMAIL_FROM_NAME: 'Meetli',
  },
}));

const { sendPasswordResetEmail } = await import('../src/services/emailDeliveryService.js');

describe('password reset email delivery logging', () => {
  beforeEach(() => {
    axiosPostMock.mockReset();
    vi.restoreAllMocks();
  });

  it('does not log Axios request data containing the OTP', async () => {
    axiosPostMock.mockRejectedValue({
      isAxiosError: true,
      code: 'ERR_BAD_RESPONSE',
      response: { status: 502 },
      config: { data: '{"to":"owner@example.com","textContent":"OTP 1234"}' },
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(sendPasswordResetEmail({
      to: 'owner@example.com',
      resetCode: '1234',
      locale: 'en',
    })).resolves.toBe(false);

    expect(consoleError).toHaveBeenCalledWith('[email] delivery-failed', {
      status: 502,
      code: 'ERR_BAD_RESPONSE',
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('1234');
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('owner@example.com');
  });
});
