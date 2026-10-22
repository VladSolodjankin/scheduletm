import { randomBytes } from 'node:crypto';
import { consumeStripeOAuthState, createStripeOAuthState } from '../repositories/paymentTokenRepository.js';
import { saveStripeConnection } from './paymentSettingsService.js';
import { buildStripeAuthorizeUrl, isStripeConfigured, stripeAdapter } from './payments/stripeAdapter.js';

export async function createStripeOAuthUrl(userId: string, accountId: number) {
  if (!isStripeConfigured()) {
    return null;
  }

  const webUserId = Number(userId);
  if (!Number.isInteger(webUserId)) {
    return null;
  }

  const state = randomBytes(32).toString('hex');
  await createStripeOAuthState({
    accountId,
    webUserId,
    stateToken: state,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  return { url: buildStripeAuthorizeUrl(state), state };
}

export async function completeStripeOAuth(state: string, code: string) {
  if (!isStripeConfigured()) {
    return { ok: false as const, reason: 'stripe_oauth_not_configured' };
  }

  const pending = await consumeStripeOAuthState(state);
  if (!pending) {
    return { ok: false as const, reason: 'invalid_state' };
  }

  try {
    const connected = await stripeAdapter.connect({ code });
    await saveStripeConnection(pending.account_id, String(connected.config.accountId));
    return { ok: true as const };
  } catch (error) {
    console.error('[payments:stripe] oauth-exchange-failed', error instanceof Error ? error.message : 'unknown');
    return { ok: false as const, reason: 'token_exchange_failed' };
  }
}
