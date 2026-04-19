# ScheduleTM Monorepo

Репозиторий разделен на изолированные приложения:

- `bot` — Telegram-бот (legacy).
- `server` — Node.js API слой для web-клиента и интеграций.
- `web` — React SPA для пользователя.

## Структура

```text
scheduletm/
├─ bot/
├─ server/
└─ web/
```

## MVP сейчас

### Web

- Страницы: `/login`, `/register`, `/settings` через `react-router-dom`.
- UI на `@mui/material` (без кастомного CSS на старте).
- Разделение на `components`, `containers`, `pages`, `app`, `shared`.
- Кнопка `Подключить Google` на странице настроек.

### Server

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/settings`
- `PUT /api/settings`
- `POST /api/integrations/google/connect`

Сервер разнесен по слоям:

- `config` — env + схемы валидации.
- `routes` — HTTP-маршруты.
- `middlewares` — auth/rate-limit middleware.
- `services` — бизнес-логика auth/settings.
- `repositories` — in-memory store (MVP).
- `utils` — утилиты (crypto/cookies).

## Безопасность (MVP)

- `helmet`.
- CORS ограничен `APP_URL`.
- Валидация входа через `zod`.
- Salted PBKDF2 hash для паролей.
- Защита логина от brute-force (lockout).
- Refresh-сессия через `HttpOnly` cookie.

> Пока используется in-memory storage. Для production нужно перенести users/sessions/settings в БД.

## Команды

```bash
npm install
npm run typecheck
npm run build
```

Локально:

```bash
npm run -w @scheduletm/server dev
npm run -w @scheduletm/web dev
```
