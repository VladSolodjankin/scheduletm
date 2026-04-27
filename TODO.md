# TODO (global)

Глобальный roadmap только для кросс-модульных задач.

## Приоритет P0

- [ ] Настроить единый CI pipeline для monorepo: install, lint/typecheck, test, build.
- [ ] Добавить интеграционные web↔server тесты (без API моков) в отдельный CI job.
- [ ] Зафиксировать политику миграций и backup/restore для production БД.

## Приоритет P1

- [x] Закрыть CSRF protection в refresh-cookie потоке (`server`).
- [ ] Добавить error tracking для `web` и `server`.
- [ ] Довести audit/events для appointments (фильтрация, retention, actor context).

## Приоритет P2

- [ ] Доработать meeting link strategy (`defaultMeetingLink` + per-appointment override).
- [ ] Добавить retry/backoff policy для внешних API и идемпотентность уведомлений.

## Модульные roadmap

- Bot: [`bot/TODO.md`](./bot/TODO.md)
- Web/Server детали: см. [`web/PROJECT_MAP.md`](./web/PROJECT_MAP.md) и [`server/PROJECT_MAP.md`](./server/PROJECT_MAP.md)
