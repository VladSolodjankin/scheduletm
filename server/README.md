# Server (`@scheduletm/server`)

Express/PostgreSQL API для Meetli web.

## Возможности

- Auth: register, 4-digit email OTP, invite accept/resend, login, refresh и logout.
- Self-registration создаёт отдельный account и пользователя `owner`.
- Session resolution отклоняет inactive/deleted users и inactive accounts.
- Роли: `product_owner`, `owner`, `admin`, `specialist`, `client`; матрица — [`docs/rbac.md`](./docs/rbac.md).
- Users/specialists CRUD с tenant isolation.
- System/account/user settings, integrations и notification settings.
- Appointments lifecycle, audit filters, recurrence и specialist booking policy.
- `defaultMeetingLink` хранится в specialist settings.
- Public Pages draft/publish/archive API и public lookup по slug.
- Public booking:
  - `GET /api/public-pages/by-slug/:slug/booking-options`;
  - `POST /api/public-pages/by-slug/:slug/appointments`.
- Public status:
  - `GET /api/public-pages/by-slug/:slug/appointments/:appointmentId/status?specialistLastName=...`.
- Notification delivery/retry lease, logs и manual resend.
- `/health` — liveness; `/ready` — database readiness.

Public booking проверяет active account/entities, рабочие дни/часы, slot step, прошедшее время, внешний календарь и PostgreSQL overlap. Timezone запроса опциональна; fallback — timezone специалиста.

Appointment audit events автоматически удаляются через 365 дней. Job запускается при старте и далее раз в 24 часа.

## Команды

```bash
npm run -w @scheduletm/server typecheck
npm run -w @scheduletm/server test
npm run -w @scheduletm/server build
npm run -w @scheduletm/server migrate:latest
npm run -w @scheduletm/server dev
```

`migrate:latest` изменяет настроенную PostgreSQL — не запускайте против production без обычной процедуры deployment/backup.

## Конфигурация

Актуальный список переменных находится в [`server/.env.example`](./.env.example). Secrets и environment values не должны попадать в git.

## Документация

- [`PROJECT_MAP.md`](./PROJECT_MAP.md)
- [`docs/rbac.md`](./docs/rbac.md)
- [`docs/db-readiness.md`](./docs/db-readiness.md)
- [`../PRODUCTION_READINESS_CHECKLIST.md`](../PRODUCTION_READINESS_CHECKLIST.md)
