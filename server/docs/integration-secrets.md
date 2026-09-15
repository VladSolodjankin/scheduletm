# Хранение секретов интеграций (Google/Zoom/Telegram)

## Где хранится ключ шифрования

Все OAuth-токены и bot-токены в таблице `web_user_integrations` (Google access/refresh token,
Zoom access/refresh token, Telegram bot token) шифруются на уровне приложения AES-256-GCM
(`server/src/utils/crypto.ts`) перед записью в БД — см. `server/src/repositories/integrationSecretCrypto.ts`.

Ключ шифрования — переменная окружения `APP_ENCRYPTION_KEY` (`server/src/config/env.ts`). Она задаётся
в secret-хранилище окружения деплоя (Railway/хостинг env vars), не коммитится в репозиторий
(`server/.env.example` содержит только плейсхолдер). Без этой переменной чтение/запись зашифрованных
секретов падает с explicit-ошибкой (`APP_ENCRYPTION_KEY is required to ... encrypted ...`) — silent fallback
на чтение как есть не предусмотрен.

Соответствующие plaintext-колонки (`google_api_key`, `google_refresh_token`, `telegram_bot_token`,
`zoom_access_token`, `zoom_refresh_token`) удалены из `web_user_integrations` миграциями
`20260915130000_backfill_encrypt_web_user_integration_secrets` (докодирует оставшиеся незашифрованные
значения перед удалением) и `20260915140000_drop_plaintext_web_user_integration_secrets`.

## Ротация ключа

Формальной автоматизированной процедуры ротации `APP_ENCRYPTION_KEY` пока нет. Ручная процедура:

1. Сгенерировать новый ключ.
2. Расшифровать все текущие значения `*_encrypted` колонок старым ключом, зашифровать новым — по аналогии
   со скриптом бэкфилла в `20260915130000_backfill_encrypt_web_user_integration_secrets.ts` (прочитать все
   строки `web_user_integrations`, перешифровать, записать).
3. Обновить `APP_ENCRYPTION_KEY` в окружении деплоя только после успешного прогона перешифровки —
   иначе действующие токены станут нечитаемыми (`Unable to decrypt encrypted ...`), и пользователям
   потребуется заново подключать интеграции.
4. Задокументировать факт ротации (дата, кто выполнял) в рамках инцидент-/security-процесса.

Следующий шаг для доведения до production-готовности — автоматизировать шаг 2 отдельным
maintenance-скриптом с поддержкой double-key (старый+новый) на время ротации, чтобы не требовать
простоя.

## Известный смежный технический долг

Отдельная (более старая) таблица `user_integrations` (`server/src/repositories/userIntegrationRepository.ts`,
используется в `settingsService.ts` как legacy-источник для чекбоксов `googleConnected`/`telegramBotConnected`)
всё ещё содержит plaintext-колонки `google_api_key`, `google_refresh_token`, `telegram_bot_token`. Код больше
не пишет туда секреты в открытом виде (см. комментарий в `updateUserTelegramIntegration`), но исторические
значения могли остаться. Эта таблица не входит в объём данной миграции — требует отдельного аудита/очистки.
