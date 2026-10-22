import { db } from '../db/knex.js';

export type PaymentProviderId = 'stripe' | 'yookassa' | 'bog';
export const PAYMENT_PROVIDER_IDS: readonly PaymentProviderId[] = ['stripe', 'yookassa', 'bog'];

export type AccountPaymentSettingsRecord = {
  account_id: number;
  active_provider: PaymentProviderId | null;
  bank_transfer_enabled: boolean;
  bank_transfer_text: string;
  custom_link_enabled: boolean;
  custom_link_title: string;
  custom_link_url: string;
  cash_enabled: boolean;
  cash_comment: string;
};

export type AccountPaymentProviderRecord = {
  id: number;
  account_id: number;
  provider: PaymentProviderId;
  config_json: Record<string, unknown>;
  secret_encrypted: string | null;
  webhook_token_hash: string | null;
  connected_at: Date;
};

export type ManualPaymentSettingsInput = {
  bankTransfer: { enabled: boolean; text: string };
  customLink: { enabled: boolean; title: string; url: string };
  cash: { enabled: boolean; comment: string };
};

export async function findAccountPaymentSettings(accountId: number): Promise<AccountPaymentSettingsRecord | null> {
  return (await db('account_payment_settings').where({ account_id: accountId }).first<AccountPaymentSettingsRecord>()) ?? null;
}

export async function upsertManualPaymentSettings(accountId: number, input: ManualPaymentSettingsInput): Promise<void> {
  const values = {
    bank_transfer_enabled: input.bankTransfer.enabled,
    bank_transfer_text: input.bankTransfer.text,
    custom_link_enabled: input.customLink.enabled,
    custom_link_title: input.customLink.title,
    custom_link_url: input.customLink.url,
    cash_enabled: input.cash.enabled,
    cash_comment: input.cash.comment,
    updated_at: db.fn.now(),
  };
  await db('account_payment_settings')
    .insert({ account_id: accountId, ...values })
    .onConflict('account_id')
    .merge(values);
}

export async function setActivePaymentProvider(accountId: number, provider: PaymentProviderId | null): Promise<void> {
  await db('account_payment_settings')
    .insert({ account_id: accountId, active_provider: provider })
    .onConflict('account_id')
    .merge({ active_provider: provider, updated_at: db.fn.now() });
}

/** Makes `provider` active only if the account has no active provider yet (atomic). */
export async function activatePaymentProviderIfNoneActive(accountId: number, provider: PaymentProviderId): Promise<void> {
  await db.raw(
    `INSERT INTO account_payment_settings (account_id, active_provider) VALUES (?, ?)
     ON CONFLICT (account_id) DO UPDATE SET active_provider = EXCLUDED.active_provider, updated_at = now()
     WHERE account_payment_settings.active_provider IS NULL`,
    [accountId, provider],
  );
}

export async function clearActiveProviderIf(accountId: number, provider: PaymentProviderId): Promise<void> {
  await db('account_payment_settings')
    .where({ account_id: accountId, active_provider: provider })
    .update({ active_provider: null, updated_at: db.fn.now() });
}

export async function listAccountPaymentProviders(accountId: number): Promise<AccountPaymentProviderRecord[]> {
  return db('account_payment_providers').where({ account_id: accountId }).select<AccountPaymentProviderRecord[]>('*');
}

export async function findAccountPaymentProvider(
  accountId: number,
  provider: PaymentProviderId,
): Promise<AccountPaymentProviderRecord | null> {
  return (await db('account_payment_providers')
    .where({ account_id: accountId, provider })
    .first<AccountPaymentProviderRecord>()) ?? null;
}

export async function findAccountPaymentProviderByWebhookTokenHash(
  provider: PaymentProviderId,
  tokenHash: string,
): Promise<AccountPaymentProviderRecord | null> {
  return (await db('account_payment_providers')
    .where({ provider, webhook_token_hash: tokenHash })
    .first<AccountPaymentProviderRecord>()) ?? null;
}

export async function upsertAccountPaymentProvider(input: {
  accountId: number;
  provider: PaymentProviderId;
  config: Record<string, unknown>;
  secretEncrypted: string | null;
  webhookTokenHash: string | null;
}): Promise<void> {
  const values = {
    config_json: JSON.stringify(input.config),
    secret_encrypted: input.secretEncrypted,
    webhook_token_hash: input.webhookTokenHash,
    connected_at: db.fn.now(),
    updated_at: db.fn.now(),
  };
  await db('account_payment_providers')
    .insert({ account_id: input.accountId, provider: input.provider, ...values })
    .onConflict(['account_id', 'provider'])
    .merge(values);
}

export async function deleteAccountPaymentProvider(accountId: number, provider: PaymentProviderId): Promise<void> {
  await db('account_payment_providers').where({ account_id: accountId, provider }).delete();
}

/** Account price snapshot source: specialist override wins over the catalog price. */
export async function findResolvedServicePrice(
  accountId: number,
  serviceId: number,
  specialistId: number,
): Promise<{ price: number; currency: string } | null> {
  const row = await db('services as sv')
    .leftJoin('specialist_services as ss', function joinAssignment() {
      this.on('ss.service_id', '=', 'sv.id')
        .andOn('ss.account_id', '=', 'sv.account_id')
        .andOn('ss.specialist_id', '=', db.raw('?', [specialistId]));
    })
    .where({ 'sv.account_id': accountId, 'sv.id': serviceId })
    .first<{ price: number; currency: string }>(db.raw('COALESCE(ss.price_override, sv.price) as price'), 'sv.currency');
  return row ?? null;
}
