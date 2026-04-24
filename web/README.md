# Web (`@scheduletm/web`)

React SPA для owner/admin/specialist/client.

## Что умеет

- Auth: `/login`, `/register`.
- Основные разделы: `/appointments`, `/specialists`, `/users`, `/settings`.
- Role-aware UI (owner/admin/specialist/client).
- i18n (`ru/en`), theme mode, palette variants.
- Calendar flow: create/edit/reschedule/cancel/mark-paid/notify.
- Client flow: клиент работает только со своим расписанием (без доступа к чужим записям).

## Команды

```bash
npm run -w @scheduletm/web dev
npm run -w @scheduletm/web build
npm run -w @scheduletm/web test
```

## Переменные окружения

- `VITE_API_URL` — базовый URL API (build-time).

Пример:

```bash
VITE_API_URL=https://api.example.com
```

## Документация

- Глобальный обзор: [`../README.md`](../README.md)
- Карта модуля: [`./PROJECT_MAP.md`](./PROJECT_MAP.md)
