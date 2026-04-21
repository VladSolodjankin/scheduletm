# Server (`@scheduletm/server`)

Node.js/Express API для web-клиента.

## Текущий MVP

- Auth: register/login/refresh.
- Settings: чтение/обновление настроек пользователя.
- Integrations: полноценный Google OAuth 2.0 flow (start + callback + token exchange).
- Безопасность: zod-валидация, `helmet`, login lockout, refresh cookie.

## Связь Telegram users и Web users (рекомендуемая модель)

Так как в базе уже есть `telegram_users` (Telegram-пользователи), для web-auth лучше не перегружать эту же таблицу.

Минимальная рабочая схема:

- `telegram_users` — Telegram-профиль (chat context, username, phone, язык и т.д.).
- `web_users` — web-учетка (email, password hash/salt, role, login lifecycle).
- `specialists.user_id` — явная 1:1 связь специалиста с web-учеткой внутри одного `account_id`.

Преимущества:

- KISS: роли таблиц очевидны, без nullable-полей «на все случаи».
- DRY: нет дублирования auth-данных в Telegram-таблице.
- SOLID: auth/web и telegram-домены развиваются независимо, но связываются через отдельный слой.

В проект добавлены миграции `20260420133000_add_web_users_and_identity_links.ts` и
`20260420170000_add_web_user_roles_and_specialist_link.ts`; при этом таблица identity-links позже была убрана как избыточная (`20260421130000_drop_unused_identity_links.ts`).

Текущая реализация `server/src/services/authService.ts` использует `web_users` для register/login,
создает роль `owner` при регистрации, а owner/admin могут создавать пользователя с ролью `specialist`; также автоматически добавляется default specialist для owner.

## Ближайший roadmap

1. Перенос хранилища в БД (`telegram_users`, `sessions`, `settings`).
2. Добавление модуля appointments (CRUD + lifecycle actions).
3. Meeting links: `user.defaultMeetingLink` + `appointment.meetingLink`.
4. Logout/revoke + CSRF для refresh-cookie потока.
5. Интеграционные тесты критических сценариев.

## Предлагаемый минимальный API для appointments

- `GET /api/appointments`
- `POST /api/appointments`
- `GET /api/appointments/:id`
- `PATCH /api/appointments/:id`
- `POST /api/appointments/:id/cancel`
- `POST /api/appointments/:id/reschedule`
- `POST /api/appointments/:id/mark-paid`
- `POST /api/appointments/:id/notify`

## Переменные окружения (Google OAuth)

Смотри `server/.env.example`:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_OAUTH_SCOPES` (опционально)


## Дополнительно по ролям и специалистам

- `POST /api/auth/specialists` — создание web-пользователя роли `specialist` + связанного `specialists`-профиля.
- Доступ: только роли `owner` и `admin`.
