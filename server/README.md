# Server (`@scheduletm/server`)

Node.js/Express API для web-клиента.

## Текущий MVP

- Auth: register/login/refresh.
- Settings: чтение/обновление настроек пользователя.
- Integrations: базовый endpoint для Google connect.
- Безопасность: zod-валидация, `helmet`, login lockout, refresh cookie.

## Связь Telegram users и Web users (рекомендуемая модель)

Так как в базе уже есть `users` (Telegram-пользователи), для web-auth лучше не перегружать эту же таблицу.

Минимальная рабочая схема:

- `users` — Telegram-профиль (chat context, username, phone, язык и т.д.).
- `web_users` — web-учетка (email, password hash/salt, login lifecycle).
- `user_identity_links` — явная 1:1 связь между `users` и `web_users` внутри одного `account_id`.

Преимущества:

- KISS: роли таблиц очевидны, без nullable-полей «на все случаи».
- DRY: нет дублирования auth-данных в Telegram-таблице.
- SOLID: auth/web и telegram-домены развиваются независимо, но связываются через отдельный слой.

В проект добавлена миграция `20260420133000_add_web_users_and_identity_links.ts` с этими таблицами.

Текущая реализация `server/src/services/authService.ts` уже использует `web_users` для register/login и
пытается автоматически создать запись в `user_identity_links`, если найден Telegram user с тем же email.

## Ближайший roadmap

1. Перенос хранилища в БД (`users`, `sessions`, `settings`).
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
