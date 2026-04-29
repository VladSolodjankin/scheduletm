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

- [x] Утвердить migration policy: forward-only + documented rollback-plan (см. `server/docs/db-readiness.md`).
- [x] Подготовить backup + test restore (RPO/RTO): реализовано в Railway, пока в ручном режиме (см. `server/docs/db-readiness.md`).
- [x] Проверить индексы и query-планы для hot-path таблиц (`appointments`, `notifications`, `web_user_sessions`, `telegram_user_sessions`): добавлен регламент и SQL-checklist (см. `server/docs/db-readiness.md`).
- [x] Разделить окружения БД (dev/stage/prod) и зафиксировать безопасные connection strings: политика и шаги зафиксированы (см. `server/docs/db-readiness.md`).

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

- [x] Пройти security review **runtime**-настроек (без блока secret storage):
  - [x] OAuth redirect: callback дополнительно валидируется по origin/path на сервере.
  - [x] Token TTL: значения централизованы в runtime config (`ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`) и применяются при issue/refresh cookie+session.
- [x] Проверить rate-limit стратегии для login/invite/notify endpoints:
  - [x] Добавлены runtime limiter-ы: login (IP), resend-invite (user/ip), appointment notify (user/ip).
  - [x] 429 + `Retry-After` возвращаются middleware-ограничителем.
- [x] Утвердить политику логирования и маскирования PII (email/phone/telegram):
  - [x] HTTP access-лог переведен на безопасный формат без query-string (`req.path`), чтобы не логировать OAuth `code`/PII из URL.
  - [ ] Маскирование PII в application/error/webhook логах и проверка выборкой реальных записей.

### Web

- [ ] Прогнать role-based smoke (owner/admin/specialist/client) на staging:
  - [ ] Для каждой роли проверить доступ к разрешенным страницам/действиям.
  - [ ] Для запрещенных действий убедиться в корректных 403/guard redirect.
- [ ] Добавить UX-smoke на auth, invite onboarding, settings, notification logs:
  - [ ] Проверить happy-path + невалидные сценарии (валидация, пустые состояния, recover после refresh/back).
  - [ ] Проверить ключевые потоки в мобильном viewport.
- [ ] Подготовить мониторинг фронта:
  - [ ] Runtime JS errors + unhandled rejections.
  - [ ] API error rate + release markers (версия/commit) для корреляции инцидентов.

### Bot

- [ ] Гарантировать idempotency по `update_id` и защиту от гонок на пользователя:
  - [ ] Dedup по `update_id` с TTL и без повторного бизнес-эффекта.
  - [ ] Последовательная обработка/локи для одного пользователя при конкурентных callback/update.
- [ ] Проверить post-deploy smoke:
  - [ ] `/health` (приложение + зависимости).
  - [ ] `getWebhookInfo` (валидный webhook URL, без `last_error_message`, контролируемый `pending_update_count`).
  - [ ] Отправка тестового reminder и контроль отсутствия дублей.

## P2 — после стабилизации

- [ ] Nightly прогоны критичных e2e/smoke сценариев.
- [ ] Стресс-тест scheduler и notification retry pipeline.
- [ ] Формализовать release checklist: миграции, pre/post-deploy smoke, rollback decision points.

## Модульные чеклисты

- Bot: [`bot/PRODUCTION_READINESS_CHECKLIST.md`](./bot/PRODUCTION_READINESS_CHECKLIST.md)
