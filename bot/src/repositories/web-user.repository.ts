import { db } from '../db/knex';
import { decryptIntegrationSecret } from '../utils/integration-secrets';

export async function findActiveTelegramBotTokenByAccountId(accountId: number): Promise<string | null> {
  const row = await db('web_users as wu')
    .join('web_user_integrations as wui', function joinWebUserIntegrations() {
      this.on('wui.web_user_id', '=', 'wu.id').andOn('wui.account_id', '=', 'wu.account_id');
    })
    .where({ 'wu.account_id': accountId, 'wu.is_active': true })
    .where(function findConfiguredTelegramToken() {
      this.whereNotNull('wui.telegram_bot_token_encrypted').orWhereNotNull('wui.telegram_bot_token');
    })
    .orderByRaw(
      "CASE wu.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'specialist' THEN 2 ELSE 3 END",
    )
    .orderBy('wui.updated_at', 'desc')
    .first<{
      telegram_bot_token_encrypted: string | null;
      telegram_bot_token: string | null;
    }>(
      'wui.telegram_bot_token_encrypted as telegram_bot_token_encrypted',
      'wui.telegram_bot_token as telegram_bot_token',
    );

  if (!row) {
    return null;
  }

  return decryptIntegrationSecret(
    row.telegram_bot_token_encrypted,
    row.telegram_bot_token,
    'Telegram bot token',
  );
}
