# PROJECT_MAP: server

Express/PostgreSQL API для web и интеграций.

- `src/app.ts` — Express app, middleware и routes.
- `src/index.ts` — startup, jobs и graceful shutdown.
- `src/config/` — env и Zod contracts.
- `src/routes/` → `src/services/` → `src/repositories/` → Knex/PostgreSQL.
- `src/policies/` — RBAC.
- `src/jobs/` — notifications, deletion, unpaid appointments и audit retention.
- `src/db/migrations/` — forward-only schema changes.
- `tests/` — unit, route smoke и DB-backed integration tests.

Домены:

1. Auth и sessions.
2. Users, specialists и tenant RBAC.
3. Settings и integrations.
4. Appointments, recurrence и audit events.
5. Public Pages, public booking и public appointment status.
6. Notifications, retry lease и logs.
7. Error tracking, health/readiness и shutdown.

Правила:

- tenant data всегда ограничиваются `account_id`;
- `product_owner` — единственная глобальная роль;
- время хранится в UTC, пользовательские timezone — IANA;
- access/refresh отклоняются для inactive/deleted user и inactive account.

Подробности: [`README.md`](./README.md), [`docs/rbac.md`](./docs/rbac.md).
