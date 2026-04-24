# Server (`@scheduletm/server`)

Node.js/Express API для web-клиента и интеграций.

## Что умеет

- Auth: register/login/refresh/logout.
- Settings API: user/system.
- CRUD: users, specialists.
- Appointments lifecycle: list/create/edit/reschedule/cancel/mark-paid/notify.
- Google OAuth (`start` + `callback`).
- Локализованные API-сообщения (`ru/en`).

## Команды

```bash
npm run -w @scheduletm/server dev
npm run -w @scheduletm/server build
npm run -w @scheduletm/server test
```

## Переменные окружения

Смотри `server/.env.example`.

Критичные для OAuth:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_OAUTH_SCOPES` (optional)

## Документация

- Глобальный обзор: [`../README.md`](../README.md)
- Карта модуля: [`./PROJECT_MAP.md`](./PROJECT_MAP.md)
