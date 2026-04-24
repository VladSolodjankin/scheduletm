# PROJECT_MAP (root)

Корневая карта репозитория. Детальная структура вынесена в модульные карты:

- [`web/PROJECT_MAP.md`](./web/PROJECT_MAP.md)
- [`server/PROJECT_MAP.md`](./server/PROJECT_MAP.md)
- [`bot/PROJECT_MAP.md`](./bot/PROJECT_MAP.md)

## Состав монорепозитория

- `web/` — SPA интерфейс.
- `server/` — API и бизнес-логика для web.
- `bot/` — Telegram-бот и webhook-сценарии.

## Кросс-модульные правила

1. Источник истины по web-аутентификации — `web_users`.
2. Временные значения в БД/API хранятся в UTC.
3. Отображение времени — в timezone пользователя/клиента (IANA).
4. Доступ к данным всегда ограничивается `account_id`.

## Навигация по документации

- Глобальный обзор: [`README.md`](./README.md)
- Глобальные задачи: [`TODO.md`](./TODO.md)
- Глобальный readiness-чеклист: [`PRODUCTION_READINESS_CHECKLIST.md`](./PRODUCTION_READINESS_CHECKLIST.md)
