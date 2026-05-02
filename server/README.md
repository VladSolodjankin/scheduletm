# Server (`@scheduletm/server`)

Node.js/Express API для web-клиента и интеграций.

## Что умеет

- Auth: register/login/refresh/logout + verify-email.
  При self-registration пользователю создаётся отдельный `account_id`, присваивается роль `admin`,
  и отправляется письмо с 4-значным OTP-кодом подтверждения email.
  Для `POST /api/auth/register` обязательны `firstName`, `lastName`, `email`, `phone`, `password`,
  опционален `telegramUsername`.
  Для приглашённых пользователей поддерживается flow принятия приглашения `POST /api/auth/accept-invite`
  (одноразовый invite-токен в ссылке, срок жизни 24 часа, пароль задаёт сам пользователь).
  Поддерживаются `POST /api/auth/verify-email` и `POST /api/auth/resend-verification-code`.
  Для `POST /api/auth/refresh` и `POST /api/auth/logout` включена CSRF-защита:
  требуется заголовок `x-csrf-token`, который должен совпадать со значением cookie `<SESSION_COOKIE_NAME>_csrf`
  (по умолчанию `scheduletm_refresh_csrf`).
  Cookie policy для refresh/csrf: `Secure` в production, `SameSite=lax/strict`, `path=/api/auth`,
  `maxAge` от `REFRESH_TOKEN_TTL_DAYS`, а домен задаётся через `SESSION_COOKIE_DOMAIN`
  (например, `.meetli.cc` для production и пустое значение для локальной разработки).
- Web roles: owner/admin/specialist/client.
- RBAC policy (централизованные проверки прав) в `src/policies/rolePermissions.ts`.
- Settings API: system (owner), account (owner/admin), user (all users), account notification defaults (owner/admin).
  - `GET /api/settings/user` возвращает статусы интеграций `googleConnected` и `zoomConnected` для текущего пользователя.
- CRUD: users, specialists.
  - При создании пользователей owner/admin отправляется invite-link вместо временного пароля.
  - Приглашённый пользователь создаётся неактивным и активируется только после verify-email / accept-invite.
- Appointments lifecycle: list/create/edit/reschedule/cancel/mark-paid/notify.
  - В `GET /api/appointments` поддерживаются фильтры для audit events:
    - `eventAction` (`cancel|reschedule|mark-paid|notify`, можно CSV),
    - `eventActorWebUserId`,
    - `eventFrom`,
    - `eventTo`.
  - В `appointments[].events[]` возвращается actor context:
    - `actor.id`,
    - `actor.role`,
    - `actor.displayName`,
    - `actor.email`.
- Client self-service:
  - owner/admin/specialist могут создавать web users с ролью `client`;
  - `client` видит и управляет только собственными записями (edit/reschedule/cancel);
  - `client` может создавать appointment только для себя;
  - `client` не может отмечать оплату и отправлять уведомления.
- Google OAuth (`start` + `callback`).
- Zoom OAuth 2.0 (per-user) with `start` + `callback` + `disconnect` and meeting creation endpoint `POST /api/integrations/zoom/meetings`.
- Email delivery через Brevo SMTP API.
- Оповещения о записи с fallback-цепочкой: Telegram -> Email.
- Notification defaults backend foundation: `account_notification_defaults`, `specialist_notification_settings`, `client_notification_settings` + scheduler job для автосоздания дефолтов на аккаунт.
- Notification delivery job (MVP): отправка `appointment_reminder` / `payment_reminder` по effective channel order:
  - `telegram` (если у клиента есть `telegram_id` + `username` и в аккаунте подключён `telegram_bot_token`);
  - fallback на `email`;
  - дедупликация через таблицу `notifications` по ключу `appointment_id + type + channel`;
  - retry/backoff и управление состояниями отправки: `pending -> processing -> sent` или `retry/failed` с `next_retry_at`, `attempts`, `max_attempts`.
  - ошибки фоновых job пишутся в `error_logs` (`source=server`, `method=JOB`) и не падают в `unhandledRejection`, чтобы не останавливать процесс API при временных проблемах сети/БД.
  - process-level ошибки (`unhandledRejection`, `uncaughtException`, `listen error`) также трекаются в `error_logs` (`method=PROCESS`) best-effort.
  - при `SIGTERM`/`SIGINT` сервер выполняет graceful shutdown: останавливает job-таймеры и закрывает HTTP listener.
- Локализованные API-сообщения (`ru/en`).
- Error tracking (`web` + `server`) с хранением в `error_logs` и optional Telegram alerts через отдельного бота (без email); bot token/chat id хранятся в `system_settings` в зашифрованном виде.

## Команды

```bash
npm run -w @scheduletm/server dev
npm run -w @scheduletm/server build
npm run -w @scheduletm/server test
npm run -w @scheduletm/server verify
# только интеграционные бизнес-кейсы
npm run -w @scheduletm/server test -- business.integration.test.ts
```

Интеграционный набор `server/tests/business.integration.test.ts` покрывает ключевые кросс-слойные сценарии:
- создание `client` через user management (web_user + clients link + invite trigger);
- ролевую видимость users для `specialist`;
- каскад настроек уведомлений `account -> specialist -> client deny`.

## Переменные окружения

Смотри `server/.env.example`.

Минимум для новой БД:

- `DATABASE_PUBLIC_URL` (или `DATABASE_URL`)
- затем `npm run -w @scheduletm/server verify` для последовательного запуска миграций и тестов.

Критичные для OAuth:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_OAUTH_SCOPES` (optional)
- `ZOOM_OAUTH_CLIENT_ID`
- `ZOOM_OAUTH_CLIENT_SECRET`
- `ZOOM_OAUTH_REDIRECT_URI`
- `ZOOM_OAUTH_SCOPES` (optional)

Для dev-домена рекомендуется:

- `APP_URL=https://dev.meetli.cc`
- `API_BASE_URL=https://apidev.meetli.cc`
- `GOOGLE_OAUTH_REDIRECT_URI=https://apidev.meetli.cc/api/integrations/google/oauth/callback`

Для CORS и cookie в локальной разработке + production:

- `CORS_ALLOWED_ORIGINS=http://localhost:5173,https://meetli.cc,https://www.meetli.cc,https://dev.meetli.cc,https://apidev.meetli.cc`
- `SESSION_COOKIE_DOMAIN=.meetli.cc` (production), пустое значение в локальной разработке.

Критичные для email:

- `BREVO_API_KEY`
- `EMAIL_FROM_ADDRESS` (default: `no-reply@meetli.cc`)
- `EMAIL_FROM_NAME`
- `EMAIL_VERIFY_BASE_URL` (ссылка для frontend-экрана подтверждения email)

Опционально для Telegram-алертов по ошибкам:

- `APP_ENCRYPTION_KEY` (обязателен для шифрования/дешифрования чувствительных значений в БД)

Настройка Telegram-алертов делается через `PUT /api/settings/system` (owner only):

- `errorAlertsTelegramBotToken` — токен отдельного бота для ошибок;
- `errorAlertsTelegramChatId` — chat id (личный/групповой);
- в `GET /api/settings/system` возвращается только флаг `errorAlertsTelegramEnabled`, сами секреты не отдаются.


## FAQ: почему разлогинивает после рестарта локального фронта/бэка

Коротко: web-сессии **не хранятся в памяти процесса** и не должны теряться из-за restart самого Node.js.

Сроки жизни по умолчанию:
- `ACCESS_TOKEN_TTL_SECONDS=900` (15 минут).
- `REFRESH_TOKEN_TTL_DAYS=30` (30 дней).

- Refresh/access токены сохраняются в таблице `web_user_sessions` (PostgreSQL).
- В браузере хранится только refresh cookie (`SESSION_COOKIE_NAME`) и csrf cookie (`<SESSION_COOKIE_NAME>_csrf`).

Если после локального рестарта вылетает логин, обычно причина в окружении/cookie:

1. Меняется `SESSION_COOKIE_NAME` между запусками (или между `.env` файлами).
2. Неверный `SESSION_COOKIE_DOMAIN` для локалки (должен быть пустой).
3. Фронт и API ходят на другой origin, который не входит в `CORS_ALLOWED_ORIGINS`.
4. В dev фронт не отправляет credentials (cookie не прикладываются к `/api/auth/refresh`).
5. Вы пересоздали БД/применили миграции в другую БД, и `web_user_sessions` пустая.


Важно по безопасности (OAuth 2.0 / BCP):
- Текущий web-auth flow — это cookie + session-tokens backend-а (не сторонний OAuth authorization server).
- Silent refresh на 401 допустим, если сохраняются CSRF-проверка и rotation refresh-токена (у нас refresh одноразовый: старый сразу revoke).
- Для production рекомендуется минимизировать хранение access token в `localStorage` (предпочтительнее in-memory), чтобы снизить риск при XSS.

Практичный чек для локалки:

- `SESSION_COOKIE_DOMAIN=` (пусто)
- одинаковый `SESSION_COOKIE_NAME` во всех локальных env
- `CORS_ALLOWED_ORIGINS` содержит origin фронта (например, `http://localhost:5173`)
- в браузере у запроса `POST /api/auth/refresh` реально уходит cookie + `x-csrf-token`

## Документация

- Глобальный обзор: [`../README.md`](../README.md)
- Карта модуля: [`./PROJECT_MAP.md`](./PROJECT_MAP.md)
- Роли и права (RBAC): [`./docs/rbac.md`](./docs/rbac.md)
- Database readiness: [`./docs/db-readiness.md`](./docs/db-readiness.md)


### Notification defaults endpoint

- `GET /api/settings/account-notification-defaults`
  - доступ: `owner`, `admin`;
  - гарантирует наличие базовых дефолтов по типам (`appointment_created`, `appointment_reminder`, `payment_reminder`) и возвращает их.


### Notification logs API

- `GET /api/notifications`
  - доступ: `owner`, `admin`, `specialist`;
  - scope: `owner` видит все аккаунты (опциональный фильтр `accountId`), `admin` только свой `account_id`, `specialist` только уведомления своих клиентов;
  - фильтры: `accountId`, `specialistId`, `userId`;
  - ключевые поля в `items[]`:
    - `specialistName` — имя специалиста (если найден);
    - `clientName` — отображаемое имя клиента (ФИО, fallback на контакт);
    - `message` — текст сообщения из `payload_json.message` (fallback: `payload_json.timing`);
    - `recipientTelegram` — telegram username клиента;
    - `recipientEmail` — email получателя уведомления.
- `POST /api/notifications/:id/resend`
  - повторно ставит в очередь только недоставленные уведомления (`failed`, `retry`, `cancelled`) в рамках доступного scope.

### Notification delivery (MVP now)

- Каналы доставки в scheduler:
  - `telegram` (через bot token аккаунта + `clients.telegram_id`);
  - fallback `email`.
- Ручной `POST /api/appointments/:id/notify` использует общий dispatch-сервис (форсированная отправка: сначала `telegram`, затем `email` при доступности контактов).
- Scheduler уважает effective settings (`account -> specialist -> client deny`) и применяет fallback по доступным каналам.

### Telegram клиент и `web_users`: рекомендуемый flow

- В Telegram webhook сначала создаём/обновляем запись в `clients` по `(account_id, telegram_id)`.
- В процессе бронирования из Telegram email клиента обязателен.
- После ввода email бот автоматически:
  - создаёт (или обновляет) `web_user` с ролью `client`,
  - связывает его с `clients.id` через `web_users.client_id`,
  - отправляет invite-link (24h TTL) на `accept-invite`.
- Это позволяет создавать appointment даже для неавторизованного и неактивного `web_user`, а завершение регистрации пользователь делает позже по invite-link.
