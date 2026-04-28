# TODO (global)

Глобальный roadmap только для кросс-модульных задач.

## Приоритет P0

- [ ] Настроить единый CI pipeline для monorepo: install, lint/typecheck, test, build.
- [ ] Добавить интеграционные web↔server тесты (без API моков) в отдельный CI job.
- [x] Добавить базовый integration-набор ключевой бизнес-логики в `server/tests/business.integration.test.ts` (DB-backed, без моков доменных сервисов).
- [ ] Зафиксировать политику миграций и backup/restore для production БД.

### P0 — Next для автотестов web (UI e2e + интеграция с dev БД)

- [ ] Подготовить выделенный e2e-account seed для dev БД (owner/admin/specialist/client) и reset-скрипт тестовых данных между прогонами.
- [ ] Подключить запуск `web test:e2e:ui` в CI на nightly/scheduled pipeline c `E2E_BASE_URL` и роль-специфичными `E2E_*` credentials.
- [ ] Добавить UI e2e: appointments lifecycle для owner/admin/specialist/client (create/edit/reschedule/cancel).
- [ ] Добавить UI e2e: поздняя отмена appointment с проверкой grace period + refund/no-refund текстов подтверждения.
- [ ] Добавить UI e2e: users management (create/edit/deactivate + resend invite).
- [ ] Добавить UI e2e: role permissions matrix (Owner/Admin/Specialist/Client) по доступу к меню, страницам и критичным действиям.

## Приоритет P1

- [x] Закрыть CSRF protection в refresh-cookie потоке (`server`).
- [x] Добавить error tracking для `web` и `server`.
- [ ] Довести audit/events для appointments (фильтрация, retention, actor context).

### P1 — Next для стабилизации тестов

- [ ] Устранить flaky-risk в UI e2e: фиксировать timezone/locale, добавить deterministic test data naming и cleanup hooks.
- [ ] Добавить smoke-набор для notification logs и error logs с role-aware проверками видимости страниц.
- [ ] Добавить негативные UI e2e сценарии: 401/403, network-failure fallback, validation errors в ключевых формах.

## Приоритет P2

- [ ] Доработать meeting link strategy (`defaultMeetingLink` + per-appointment override).
- [ ] Добавить retry/backoff policy для внешних API и идемпотентность уведомлений.

## Модульные roadmap

- Bot: [`bot/TODO.md`](./bot/TODO.md)
- Web/Server детали: см. [`web/PROJECT_MAP.md`](./web/PROJECT_MAP.md) и [`server/PROJECT_MAP.md`](./server/PROJECT_MAP.md)
