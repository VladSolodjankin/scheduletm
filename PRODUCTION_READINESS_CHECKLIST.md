# PRODUCTION_READINESS_CHECKLIST (global)

Кросс-модульный чеклист готовности `web + server + bot`.

## Platform

- [ ] Зафиксировать версии Node.js и npm для всех workspace.
- [ ] Подготовить reproducible installs и lockfile policy.
- [ ] Убедиться, что CI воспроизводит локальные команды сборки/тестов.

## Security

- [ ] CSRF protection для refresh-cookie (`server`).
- [ ] Централизованное хранение секретов (secret manager).
- [ ] Политика маскирования PII в логах.

## Reliability

- [ ] Backup + проверяемый restore-процесс для production БД.
- [ ] Error tracking (web/server/bot).
- [ ] Алерты на 5xx, рост failed-уведомлений, деградацию webhook.

## Quality

- [ ] Web↔Server integration suite (critical flows).
- [ ] E2E smoke для bot webhook сценариев.
- [ ] PR + nightly прогоны критичных тестов.

## Operations

- [ ] Runbook: инциденты по БД, webhook, уведомлениям.
- [ ] Release checklist (миграции, smoke, post-release monitoring).

## Модульные чеклисты

- Bot: [`bot/PRODUCTION_READINESS_CHECKLIST.md`](./bot/PRODUCTION_READINESS_CHECKLIST.md)
