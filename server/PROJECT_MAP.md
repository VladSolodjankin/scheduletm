# PROJECT_MAP: `server/`

## Назначение

`server/` — Node.js/Express API для web-приложения и интеграций.

## Структура

- `src/index.ts` — запуск HTTP-сервера.
- `src/app.ts` — сборка Express app, middleware, routes.
- `src/config/` — env-конфиг и валидация.
- `src/routes/` — HTTP endpoints.
- `src/middlewares/` — auth, rate-limit, guards.
- `src/services/` — доменная логика.
- `src/repositories/` — доступ к БД.
- `src/db/` — миграции/инициализация.
- `src/i18n/` — локализованные сообщения API (`ru/en`).
- `tests/` — smoke/integration tests.

## Основные доменные модули

1. **Auth** — register/login/refresh/logout, web sessions.
2. **Users & Specialists** — CRUD и role-based доступ.
3. **Settings** — system/user настройки.
4. **Appointments** — lifecycle операций записи.
5. **Integrations** — Google OAuth + user integrations.

## Ключевые правила

- Изоляция данных по `account_id`.
- Хранение времени — UTC; timezone хранится в IANA.
- Роли web: `owner`, `admin`, `specialist`.

## Документация модуля

- [`README.md`](./README.md)
