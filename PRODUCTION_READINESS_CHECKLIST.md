# Production readiness: web + server

Это канонический release checklist для `web` и `server`. Наличие кода или CI-конфигурации
не подтверждает внешнюю инфраструктуру: Railway, production secrets, backup/restore,
staging и observability требуют отдельного operational evidence. Для Telegram-сервиса
используется отдельный [`bot/PRODUCTION_READINESS_CHECKLIST.md`](./bot/PRODUCTION_READINESS_CHECKLIST.md).

## Реализовано в репозитории

- [x] Tenant RBAC и отдельный глобальный `product_owner`.
- [x] Active/deleted user и inactive account session enforcement.
- [x] CSRF для refresh/logout, production cookie policy и CORS validation.
- [x] Request/login/public-status rate limits, безопасные JSON errors и payload limits.
- [x] `/health`, DB-backed `/ready`, graceful/fatal shutdown.
- [x] Notification retry/backoff, idempotency, token-fenced lease и heartbeat.
- [x] Error tracking и автоматическая retention для error/audit records.
- [x] Public Pages, public booking/status, recurrence и specialist meeting settings.
- [x] Новые integration credentials записываются в encrypted columns; временный
  plaintext read fallback сохранён только для контролируемого backfill.
- [x] Web verification запускает только web-owned unit/contracts/build checks.
- [x] GitHub CI поднимает изолированную PostgreSQL, применяет server migrations и затем
  запускает root `lint`, `typecheck`, `test`, `build` без non-blocking gate.

## Secrets и данные интеграций

- [ ] Provision production `APP_ENCRYPTION_KEY` как отдельный сильный секрет в
  Railway/Secret Manager; не хранить ключ в репозитории, БД, логах или build artifacts.
- [ ] Перед включением обязательного encrypted-write режима выполнить backup,
  dry-run/inventory plaintext credentials и backfill существующих Google/Zoom/Telegram
  credentials; зафиксировать counts до/после и отсутствие plaintext.
- [ ] Проверить чтение backfilled credentials и удалить временный compatibility path
  только после подтверждённого deploy.
- [ ] Описать и отрепетировать rotation: новый key/version, повторное шифрование,
  проверка decrypt, rollback window и отзыв старого ключа.

## CI, migrations и release validation

- [ ] Получить успешный GitHub CI run на release commit и включить workflow как
  required branch-protection check.
- [ ] Подтвердить, что migrations применяются с нуля на чистой PostgreSQL, а
  DB-backed server business integration проходит в том же CI run.
- [ ] Просмотреть forward-only migrations и применить их на staging, затем на
  production по [`server/docs/db-readiness.md`](./server/docs/db-readiness.md).
- [ ] Выполнить staging smoke:
  - [ ] `/health` и `/ready`;
  - [ ] register/verify/login/refresh/logout;
  - [ ] tenant RBAC и `product_owner`;
  - [ ] users/specialists/settings и integration credential reconnect;
  - [ ] appointment create/edit/recurrence;
  - [ ] Public Page create/save/publish/view/archive/delete;
  - [ ] public booking и appointment status.
- [ ] Выполнить browser smoke на поддерживаемых desktop/mobile viewport и закрыть
  backlog из [`web/tests/e2e/TODO.md`](./web/tests/e2e/TODO.md).
- [ ] Повторить `npm audit --omit=dev` после совместимых dependency updates; не
  использовать `--force` без review.

## Backup, restore и эксплуатация

- [ ] Утвердить RPO и RTO в operations runbook.
- [ ] Создать production-like backup, восстановить его в отдельную БД, выполнить
  migrations и smoke; сохранить дату, длительность, data-gap и ответственного как evidence.
- [ ] Настроить и проверить метрики для API/DB/notification scheduler, включая latency,
  5xx, failed/retry queue, stale leases и `/ready`.
- [ ] Настроить alerts с проверенными thresholds/escalation routes и тестовым срабатыванием.
- [ ] Подготовить versioned runbooks: deploy/rollback, migration failure, key rotation,
  backup/restore, notification backlog, database unavailable и incident response.
- [ ] Зафиксировать post-deploy smoke и monitoring window с ответственным.

## Осознанно отложено

- Расширенный media pipeline; минимальные logo/avatar/cover входят в следующий
  коммерческий этап, но не блокируют первый production release.
- Дополнительные meeting providers.
- Advanced recurrence series editing/exceptions/monthly.
- Public Page analytics, custom domains и scheduled publishing.
