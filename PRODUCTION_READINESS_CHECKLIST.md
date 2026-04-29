# PRODUCTION_READINESS_CHECKLIST (global)

Кросс-модульный чеклист готовности `web + server + bot`.

## Как читать

- **P0 (блокер релиза)** — без выполнения выход в production не рекомендуется.
- **P1 (до/сразу после запуска)** — высокий риск для стабильности/поддержки.
- **P2 (после стабилизации)** — важные улучшения, но не блокируют первый релиз.

## P0 — блокеры релиза

### 1) Security и auth-flow (`server` + `web`)

- [x] Внедрить CSRF-защиту для refresh-cookie (`/api/auth/refresh`) и logout flow.
- [ ] Перевести секреты в Secret Manager (не хранить в репозитории/обычных env-файлах).
- [x] Проверить cookie policy для production: `HttpOnly`, `Secure`, `SameSite`, домен, TTL.
- [x] Ограничить CORS на production-домены (без широких fallback-origin).

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

- [x] Подключить error tracking для `web`, `server`, `bot`.
- [ ] Ввести метрики/алерты: 5xx, latency, рост failed/retry уведомлений, webhook degradation.
  - Что сделать:
    - [ ] Добавить единый endpoint/формат scrape (Prometheus/OpenMetrics) для `server` и `bot`.
    - [ ] Зафиксировать SLI/SLO и пороги алертов:
      - [ ] `5xx` rate (server): warn/critical пороги по окнам 5m/15m.
      - [ ] p95 latency (server): warn/critical пороги по основным API.
      - [ ] failed/retry growth (notifications): дельта по `notifications.status in ('failed','retry')`.
      - [ ] webhook degradation (bot): рост 5xx и отсутствие incoming updates выше порога.
    - [ ] Подключить доставку алертов в on-call канал (Telegram) и проверить тестовым инцидентом.
- [ ] Подготовить runbook: инциденты БД, webhook, OAuth, email/notification failures.
  - Что сделать:
    - [ ] Описать для каждого инцидента: симптомы, проверки (SQL/логи/health), mitigation, rollback, критерий закрытия.
    - [ ] Добавить “первые 15 минут” (triage + эскалация) и “после инцидента” (RCA + action items).
    - [ ] Зафиксировать владельцев и контакты эскалации (owner/on-call/dev).

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
