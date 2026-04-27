# PRODUCTION_READINESS_CHECKLIST (global)

Кросс-модульный чеклист готовности `web + server + bot`.

## Как читать

- **P0 (блокер релиза)** — без выполнения выход в production не рекомендуется.
- **P1 (до/сразу после запуска)** — высокий риск для стабильности/поддержки.
- **P2 (после стабилизации)** — важные улучшения, но не блокируют первый релиз.

## P0 — блокеры релиза

### 1) Security и auth-flow (`server` + `web`)

- [ ] Внедрить CSRF-защиту для refresh-cookie (`/api/auth/refresh`) и logout flow.
- [ ] Перевести секреты в Secret Manager (не хранить в репозитории/обычных env-файлах).
- [ ] Проверить cookie policy для production: `HttpOnly`, `Secure`, `SameSite`, домен, TTL.
- [ ] Ограничить CORS на production-домены (без широких fallback-origin).

### 2) Database readiness (`server` + `bot`)

- [ ] Утвердить migration policy: forward-only + documented rollback-plan.
- [ ] Подготовить backup + test restore (RPO/RTO, расписание, проверка восстановления).
- [ ] Проверить индексы и query-планы для hot-path таблиц (`appointments`, `notifications`, `web_user_sessions`, `telegram_user_sessions`).
- [ ] Разделить окружения БД (dev/stage/prod) и зафиксировать безопасные connection strings.

### 3) CI/CD и качество

- [ ] Единый CI pipeline монорепо: install -> typecheck -> test -> build.
- [ ] Отдельный job: миграции на чистой БД + smoke после миграций.
- [ ] Добавить web↔server интеграционные тесты (critical paths без API mocks).
- [ ] Убрать привязку тестов к внешней shared БД; тесты должны быть self-contained.

### 4) Наблюдаемость и инциденты

- [ ] Подключить error tracking для `web`, `server`, `bot`.
- [ ] Ввести метрики/алерты: 5xx, latency, рост failed/retry уведомлений, webhook degradation.
- [ ] Подготовить runbook: инциденты БД, webhook, OAuth, email/notification failures.

## P1 — сделать до или сразу после запуска

### Server/API

- [ ] Пройти security review env/runtime-настроек (в т.ч. OAuth redirect и token TTL).
- [ ] Проверить rate-limit стратегии для login/invite/notify endpoints.
- [ ] Утвердить политику логирования и маскирования PII (email/phone/telegram).

### Web

- [ ] Прогнать role-based smoke (owner/admin/specialist/client) на staging.
- [ ] Добавить UX-smoke на auth, invite onboarding, settings, notification logs.
- [ ] Подготовить мониторинг фронта (ошибки рендера, API error rate, release markers).

### Bot

- [ ] Гарантировать idempotency по `update_id` и защиту от гонок на пользователя.
- [ ] Проверить post-deploy smoke: `/health`, `getWebhookInfo`, отправка тестового reminder.

## P2 — после стабилизации

- [ ] Nightly прогоны критичных e2e/smoke сценариев.
- [ ] Стресс-тест scheduler и notification retry pipeline.
- [ ] Формализовать release checklist: миграции, pre/post-deploy smoke, rollback decision points.

## Модульные чеклисты

- Bot: [`bot/PRODUCTION_READINESS_CHECKLIST.md`](./bot/PRODUCTION_READINESS_CHECKLIST.md)
