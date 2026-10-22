import crypto from 'node:crypto';
import { env } from '../config/env.js';
import {
  activatePaymentProviderIfNoneActive,
  clearActiveProviderIf,
  deleteAccountPaymentProvider,
  findAccountPaymentProvider,
  findAccountPaymentSettings,
  listAccountPaymentProviders,
  setActivePaymentProvider,
  upsertAccountPaymentProvider,
  upsertManualPaymentSettings,
  type AccountPaymentProviderRecord,
  type AccountPaymentSettingsRecord,
  type ManualPaymentSettingsInput,
  type PaymentProviderId,
} from '../repositories/accountPaymentRepository.js';
import { decryptIntegrationSecret, encryptIntegrationSecret } from '../repositories/integrationSecretCrypto.js';
import { hashToken } from '../repositories/paymentTokenRepository.js';
import { deauthorizeStripeAccount } from './payments/stripeAdapter.js';
import { getPaymentAdapter } from './payments/registry.js';
import type { ProviderCredentials } from './payments/types.js';

export class ProviderNotConnectedError extends Error {
  constructor() {
    super('PROVIDER_NOT_CONNECTED');
  }
}

export class MissingProviderSecretError extends Error {
  constructor() {
    super('MISSING_PROVIDER_SECRET');
  }
}

export type PaymentSettingsDto = {
  activeProvider: PaymentProviderId | null;
  providers: {
    stripe: { connected: boolean; accountId?: string; connectedAt?: string };
    yookassa: { connected: boolean; shopId?: string; hasSecret: boolean; webhookUrl: string };
    bog: { connected: boolean; clientId?: string; hasSecret: boolean; callbackUrl: string };
  };
  manual: {
    bankTransfer: { enabled: boolean; text: string };
    customLink: { enabled: boolean; title: string; url: string };
    cash: { enabled: boolean; comment: string };
  };
  hasAnyMethod: boolean;
};

/**
 * Per-account opaque URL token for YooKassa/BOG notifications. It is derived (HMAC of the account id with
 * APP_ENCRYPTION_KEY) so the URL can be shown again at any time; only its SHA-256 is stored, for lookup.
 */
export function deriveWebhookToken(provider: PaymentProviderId, accountId: number): string | null {
  if (!env.APP_ENCRYPTION_KEY) {
    return null;
  }
  return crypto.createHmac('sha256', env.APP_ENCRYPTION_KEY).update(`payment-webhook:${provider}:${accountId}`).digest('base64url');
}

export function buildProviderCallbackUrl(provider: 'yookassa' | 'bog', accountId: number): string {
  const token = deriveWebhookToken(provider, accountId);
  if (!token) {
    return '';
  }
  const path = provider === 'yookassa' ? 'yookassa/webhook' : 'bog/callback';
  return `${env.API_BASE_URL.replace(/\/+$/, '')}/api/integrations/${path}/${token}`;
}

export function toProviderCredentials(record: AccountPaymentProviderRecord): ProviderCredentials {
  return {
    accountId: record.account_id,
    config: record.config_json ?? {},
    secret: decryptIntegrationSecret(record.secret_encrypted, `${record.provider} payment secret`),
  };
}

export type ManualMethods = {
  bankTransfer: { text: string } | null;
  customLink: { title: string; url: string } | null;
  cash: { comment: string } | null;
};

export function resolveManualMethods(settings: AccountPaymentSettingsRecord | null): ManualMethods {
  return {
    bankTransfer: settings?.bank_transfer_enabled && settings.bank_transfer_text.trim()
      ? { text: settings.bank_transfer_text.trim() }
      : null,
    customLink: settings?.custom_link_enabled && settings.custom_link_url.trim() && settings.custom_link_title.trim()
      ? { title: settings.custom_link_title.trim(), url: settings.custom_link_url.trim() }
      : null,
    cash: settings?.cash_enabled ? { comment: settings.cash_comment.trim() } : null,
  };
}

export function hasAnyManualMethod(manual: ManualMethods): boolean {
  return Boolean(manual.bankTransfer || manual.customLink || manual.cash);
}

export type AccountPaymentMethods = {
  /** The active provider, only when it is actually connected. */
  onlineProvider: PaymentProviderId | null;
  manual: ManualMethods;
};

export async function loadAccountPaymentMethods(accountId: number): Promise<AccountPaymentMethods> {
  const settings = await findAccountPaymentSettings(accountId);
  let onlineProvider: PaymentProviderId | null = null;
  if (settings?.active_provider) {
    const provider = await findAccountPaymentProvider(accountId, settings.active_provider);
    onlineProvider = provider ? settings.active_provider : null;
  }
  return { onlineProvider, manual: resolveManualMethods(settings) };
}

export async function getPaymentSettings(accountId: number): Promise<PaymentSettingsDto> {
  const [settings, providerRows] = await Promise.all([
    findAccountPaymentSettings(accountId),
    listAccountPaymentProviders(accountId),
  ]);
  const byProvider = new Map(providerRows.map((row) => [row.provider, row]));
  const stripe = byProvider.get('stripe');
  const yookassa = byProvider.get('yookassa');
  const bog = byProvider.get('bog');

  const activeProvider = settings?.active_provider && byProvider.has(settings.active_provider)
    ? settings.active_provider
    : null;
  const manual = resolveManualMethods(settings);

  return {
    activeProvider,
    providers: {
      stripe: {
        connected: Boolean(stripe),
        ...(stripe ? {
          accountId: String(stripe.config_json?.accountId ?? ''),
          connectedAt: new Date(stripe.connected_at).toISOString(),
        } : {}),
      },
      yookassa: {
        connected: Boolean(yookassa),
        ...(yookassa ? { shopId: String(yookassa.config_json?.shopId ?? '') } : {}),
        hasSecret: Boolean(yookassa?.secret_encrypted),
        webhookUrl: buildProviderCallbackUrl('yookassa', accountId),
      },
      bog: {
        connected: Boolean(bog),
        ...(bog ? { clientId: String(bog.config_json?.clientId ?? '') } : {}),
        hasSecret: Boolean(bog?.secret_encrypted),
        callbackUrl: buildProviderCallbackUrl('bog', accountId),
      },
    },
    manual: {
      bankTransfer: {
        enabled: Boolean(settings?.bank_transfer_enabled),
        text: settings?.bank_transfer_text ?? '',
      },
      customLink: {
        enabled: Boolean(settings?.custom_link_enabled),
        title: settings?.custom_link_title ?? '',
        url: settings?.custom_link_url ?? '',
      },
      cash: {
        enabled: Boolean(settings?.cash_enabled),
        comment: settings?.cash_comment ?? '',
      },
    },
    hasAnyMethod: Boolean(activeProvider) || hasAnyManualMethod(manual),
  };
}

export async function updateManualPaymentSettings(
  accountId: number,
  input: ManualPaymentSettingsInput,
): Promise<PaymentSettingsDto> {
  await upsertManualPaymentSettings(accountId, input);
  return getPaymentSettings(accountId);
}

/** Connects YooKassa/BOG: validates the credentials against the provider, then stores the secret encrypted. */
export async function connectKeyedProvider(
  accountId: number,
  provider: 'yookassa' | 'bog',
  fields: { id: string; secret?: string },
): Promise<PaymentSettingsDto> {
  const existing = await findAccountPaymentProvider(accountId, provider);
  const secret = fields.secret?.trim()
    || (existing?.secret_encrypted ? decryptIntegrationSecret(existing.secret_encrypted, `${provider} payment secret`) : null);
  if (!secret) {
    throw new MissingProviderSecretError();
  }

  const adapter = getPaymentAdapter(provider);
  const connected = await adapter.connect(
    provider === 'yookassa'
      ? { shopId: fields.id, secretKey: secret }
      : { clientId: fields.id, clientSecret: secret },
  );

  const token = deriveWebhookToken(provider, accountId);
  await upsertAccountPaymentProvider({
    accountId,
    provider,
    config: connected.config,
    secretEncrypted: encryptIntegrationSecret(connected.secret, `${provider} payment secret`),
    webhookTokenHash: token ? hashToken(token) : null,
  });
  await activatePaymentProviderIfNoneActive(accountId, provider);
  return getPaymentSettings(accountId);
}

/** Stores a Stripe connected account after a successful OAuth exchange (see stripeOAuthService). */
export async function saveStripeConnection(accountId: number, stripeAccountId: string): Promise<void> {
  await upsertAccountPaymentProvider({
    accountId,
    provider: 'stripe',
    config: { accountId: stripeAccountId },
    secretEncrypted: null,
    webhookTokenHash: null,
  });
  await activatePaymentProviderIfNoneActive(accountId, 'stripe');
}

export async function disconnectProvider(accountId: number, provider: PaymentProviderId): Promise<PaymentSettingsDto> {
  const existing = await findAccountPaymentProvider(accountId, provider);
  if (existing && provider === 'stripe' && typeof existing.config_json?.accountId === 'string') {
    await deauthorizeStripeAccount(existing.config_json.accountId);
  }
  await deleteAccountPaymentProvider(accountId, provider);
  await clearActiveProviderIf(accountId, provider);
  return getPaymentSettings(accountId);
}

export async function changeActiveProvider(
  accountId: number,
  provider: PaymentProviderId | null,
): Promise<PaymentSettingsDto> {
  if (provider !== null) {
    const existing = await findAccountPaymentProvider(accountId, provider);
    if (!existing) {
      throw new ProviderNotConnectedError();
    }
  }
  await setActivePaymentProvider(accountId, provider);
  return getPaymentSettings(accountId);
}
