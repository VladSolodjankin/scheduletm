# Server (`@scheduletm/server`)

Node.js/Express API для web-клиента.

## Текущий MVP

- Auth: register/login/refresh.
- Settings: чтение/обновление настроек пользователя.
- Integrations: базовый endpoint для Google connect.
- Безопасность: zod-валидация, `helmet`, login lockout, refresh cookie.

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
