# Server (`@scheduletm/server`)

Node.js/Express API для web-клиента и интеграций.

## Что умеет

- Auth: register/login/refresh/logout + verify-email.
  При self-registration пользователю создаётся отдельный `account_id`, присваивается роль `admin`,
  и отправляется письмо с OTP-кодом подтверждения email.
  Для приглашённых пользователей поддерживается flow принятия приглашения `POST /api/auth/accept-invite`
  (одноразовый invite-токен в ссылке, срок жизни 24 часа, пароль задаёт сам пользователь).
  Поддерживаются `POST /api/auth/verify-email` и `POST /api/auth/resend-verification-code`.
- Web roles: owner/admin/specialist/client.
- RBAC policy (централизованные проверки прав) в `src/policies/rolePermissions.ts`.
- Settings API: user/system.
- CRUD: users, specialists.
  - При создании пользователей owner/admin отправляется invite-link вместо временного пароля.
- Appointments lifecycle: list/create/edit/reschedule/cancel/mark-paid/notify.
- Client self-service:
  - owner/admin/specialist могут создавать web users с ролью `client`;
  - `client` видит и управляет только собственными записями (edit/reschedule/cancel);
  - `client` может создавать appointment только для себя;
  - `client` не может отмечать оплату и отправлять уведомления.
- Google OAuth (`start` + `callback`).
- Email delivery через Brevo SMTP API.
- Оповещения о записи с fallback-цепочкой: Telegram -> Email.
- Локализованные API-сообщения (`ru/en`).

## Команды

```bash
npm run -w @scheduletm/server dev
npm run -w @scheduletm/server build
npm run -w @scheduletm/server test
```

## Переменные окружения

Смотри `server/.env.example`.

Критичные для OAuth:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_OAUTH_SCOPES` (optional)

Критичные для email:

- `BREVO_API_KEY`
- `EMAIL_FROM_ADDRESS` (default: `no-reply@meetli.cc`)
- `EMAIL_FROM_NAME`
- `EMAIL_VERIFY_BASE_URL` (ссылка для frontend-экрана подтверждения email)

## Документация

- Глобальный обзор: [`../README.md`](../README.md)
- Карта модуля: [`./PROJECT_MAP.md`](./PROJECT_MAP.md)
- Роли и права (RBAC): [`./docs/rbac.md`](./docs/rbac.md)
