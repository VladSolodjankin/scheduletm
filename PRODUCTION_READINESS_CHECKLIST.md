# Production readiness: web + server

Инфраструктура Railway и env-конфигурация управляются вне этого репозитория и подтверждены владельцем проекта. Bot не входит в текущий checklist.

## Реализовано в коде

- [x] Tenant RBAC и отдельный глобальный `product_owner`.
- [x] Active/deleted user и inactive account session enforcement.
- [x] CSRF для refresh/logout, production cookie policy и CORS validation.
- [x] Request/login/public-status rate limits.
- [x] Безопасные JSON errors и payload limits.
- [x] `/health`, `/ready`, graceful/fatal shutdown.
- [x] Notification retry/backoff, idempotency, token lease и heartbeat.
- [x] Error tracking и 7-day error retention.
- [x] Appointment audit actor context/filters/limit и 365-day automatic retention.
- [x] Public Pages storage, publish snapshots, revision conflicts и public slug.
- [x] Public booking с schedule/calendar/overlap validation.
- [x] Public appointment status без client PII.
- [x] Atomic daily/weekly recurrence.
- [x] Specialist default meeting link.
- [x] Server unit/smoke coverage и web runtime/source-contract coverage.

## Обязательно перед deployment

- [ ] Просмотреть migrations и применить их на тестовой/целевой PostgreSQL.
- [ ] Проверить migrations на чистой PostgreSQL и выполнить DB-backed smoke.
- [ ] Выполнить server typecheck/tests/build.
- [ ] Выполнить web unit/contracts/typecheck/lint/production build.
- [ ] Выполнить runtime smoke локально или на staging:
  - [ ] `/health` и `/ready`;
  - [ ] register/verify/login/refresh/logout;
  - [ ] tenant RBAC и `product_owner`;
  - [ ] users/specialists/settings;
  - [ ] appointment create/edit/recurrence;
  - [ ] Public Page create/save/publish/view/archive/delete;
  - [ ] public booking и appointment status.
- [ ] Повторить `npm audit --omit=dev` после совместимых dependency updates; не использовать `--force` без review.

## Следующий этап тестирования

- [ ] Complete the canonical browser E2E backlog in
  [`web/tests/e2e/TODO.md`](./web/tests/e2e/TODO.md); iteration-1 admin coverage
  is implemented but has not yet been run against staging.
- [ ] Load test notification scheduler и audit-retention job.

## Осознанно отложено

- Media upload/storage pipeline.
- Дополнительные meeting providers.
- Advanced recurrence series editing/exceptions/monthly.
- Public Page analytics, custom domains и scheduled publishing.
