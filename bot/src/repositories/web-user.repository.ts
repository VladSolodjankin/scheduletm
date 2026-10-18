import { db } from '../db/knex';
import { decryptIntegrationSecret } from '../utils/integration-secrets';

export async function findActiveTelegramBotTokenByAccountId(accountId: number): Promise<string | null> {
  const row = await db('web_users as wu')
    .join('web_user_integrations as wui', function joinWebUserIntegrations() {
      this.on('wui.web_user_id', '=', 'wu.id').andOn('wui.account_id', '=', 'wu.account_id');
    })
    .where({ 'wu.account_id': accountId, 'wu.is_active': true })
    .whereNotNull('wui.telegram_bot_token_encrypted')
    .orderByRaw(
      "CASE wu.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'specialist' THEN 2 ELSE 3 END",
    )
    .orderBy('wui.updated_at', 'desc')
    .first<{ telegram_bot_token_encrypted: string | null }>(
      'wui.telegram_bot_token_encrypted as telegram_bot_token_encrypted',
    );

  if (!row) {
    return null;
  }

  return decryptIntegrationSecret(
    row.telegram_bot_token_encrypted,
    'Telegram bot token',
  );
}
