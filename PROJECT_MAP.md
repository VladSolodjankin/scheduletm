# PROJECT_MAP

## Назначение модулей

- `bot/` — существующее backend-приложение Telegram-бота.
- `server/` — API для web-приложения:
  - `server/src/index.ts` — bootstrap.
  - `server/src/app.ts` — инициализация Express middleware/роутов.
  - `server/src/config/*` — env + схемы валидации.
  - `server/src/routes/*` — auth/settings/integrations/health endpoints.
  - `server/src/services/*` — бизнес-логика auth/settings.
  - `server/src/middlewares/*` — auth + login lock middleware.
  - `server/src/repositories/inMemoryStore.ts` — in-memory состояние (MVP).

## Data map (server)

- `users` — Telegram users.
- `web_users` — web auth users (email/password hash/salt).
- `user_identity_links` — 1:1 bridge между `users` и `web_users` внутри `account_id`.
- Миграция: `server/src/db/migrations/20260420133000_add_web_users_and_identity_links.ts`.
- Реализация: `server/src/services/authService.ts` + `bot/src/services/user.service.ts` используют эту схему для auth и auto-link по email.
- `web/` — SPA:
  - `web/src/app/*` — root app + router.
  - `web/src/pages/*` — страницы.
  - `web/src/containers/*` — контейнеры с запросами и состоянием.
  - `web/src/components/*` — UI-компоненты и layout (`MainLayout`, `Header`, `LeftMenu`).
  - `web/src/shared/ui/*` — базовые MUI-wrapper компоненты (`AppButton`, `AppTabs`, `AppForm`, `AppTextField`, `AppPage`, `AppIcons`).
  - `web/src/shared/theme/*` — константы дизайна + фабрика темы + light/dark + palette variants.
  - `web/src/shared/*` — API client, типы, auth context и переиспользуемая инфраструктура.
  - `web/src/shared/i18n/*` — словари переводов (`ru/en`) и i18n-контекст приложения.
  - До логина показываются только auth-страницы (`/login`, `/register`) без header/left menu; после регистрации маршрут ведёт на `/login`.

## API карта (MVP)

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/settings`
- `PUT /api/settings`
- `POST /api/integrations/google/oauth/start`
- `GET /api/integrations/google/oauth/callback`

## API карта (следующий инкремент — appointments)

- `GET /api/appointments` — список записей с фильтрами.
- `POST /api/appointments` — создать запись.
- `GET /api/appointments/:id` — получить запись.
- `PATCH /api/appointments/:id` — обновить запись (в т.ч. `meetingLink`).
- `POST /api/appointments/:id/cancel` — отменить запись.
- `POST /api/appointments/:id/reschedule` — перенести запись.
- `POST /api/appointments/:id/mark-paid` — подтвердить оплату.
- `POST /api/appointments/:id/notify` — ручное уведомление.

## Стратегия meeting link

- Источник по умолчанию: `user.defaultMeetingLink`.
- Фактическое значение встречи: `appointment.meetingLink`.
- На создание appointment сервер подставляет default ссылку автоматически, но позволяет override.

Это сохраняет простую модель и покрывает реальные кейсы (одна ссылка на пользователя + исключения на конкретные встречи).

## Google OAuth переменные

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_OAUTH_SCOPES` (опционально, space-separated)
