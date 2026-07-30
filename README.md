# Meetli / scheduletm

TypeScript npm-workspaces monorepo:

- `server/` — Express/PostgreSQL API;
- `web/` — React SPA;
- `bot/` — Telegram service, не входит в текущий web/server этап.

## Текущая web/server модель

- Роли: глобальный `product_owner`, tenant `owner`, `admin`, `specialist`, `client`.
- Self-registration создаёт новый account и tenant `owner`.
- Users/specialists/settings/appointments изолированы по `account_id`.
- Locale/timezone являются пользовательскими настройками.
- Appointments поддерживают audit events и атомарную recurrence `daily`/`weekly`.
- Audit events автоматически очищаются через 365 дней.
- Specialist settings содержат `defaultMeetingLink`.
- Notifications используют retry/backoff, idempotency и token-fenced processing lease.
- Public Page Builder хранит draft/published snapshots на server и использует revision concurrency.
- Опубликованный Public Page slug является каноническим публичным идентификатором.
- Public booking и appointment status работают без административной сессии.
- `/health` проверяет процесс, `/ready` — PostgreSQL.

## Запуск

Установить зависимости:

```bash
npm install
```

Проверки:

```bash
npm run -w @scheduletm/server typecheck
npm run -w @scheduletm/server test
npm run -w @scheduletm/server build

npm run -w @scheduletm/web typecheck
npm run -w @scheduletm/web lint
npm run -w @scheduletm/web test:unit
npm run -w @scheduletm/web test:e2e:contracts
npm run -w @scheduletm/web build
```

Локальная разработка:

```bash
npm run -w @scheduletm/server dev
npm run -w @scheduletm/web dev
```

Перед запуском нужны локальные env-файлы по примерам `server/.env.example` и `web/.env.example`, а также доступная PostgreSQL.

Миграции:

```bash
npm run -w @scheduletm/server migrate:latest
```

Команда изменяет настроенную БД; применяйте её через обычную процедуру deployment/backup.

## Документация

- Общий backlog: [`TODO.md`](./TODO.md)
- Production checklist: [`PRODUCTION_READINESS_CHECKLIST.md`](./PRODUCTION_READINESS_CHECKLIST.md)
- Server: [`server/README.md`](./server/README.md), [`server/docs/rbac.md`](./server/docs/rbac.md)
- Web: [`web/README.md`](./web/README.md)
- Browser E2E status: [`web/tests/e2e/TODO.md`](./web/tests/e2e/TODO.md)
- Public Page Builder: [`docs/public-page-builder/README.md`](./docs/public-page-builder/README.md), [`docs/public-page-builder/TODO.md`](./docs/public-page-builder/TODO.md)

## Осознанно отложено

- media upload/storage;
- дополнительные meeting providers;
- advanced recurrence series editing;
- remaining browser E2E iteration-2 scope;
- Public Page analytics/custom domains/scheduled publishing.

Фактическая release readiness подтверждается только после migrations, production builds и runtime smoke из checklist.
