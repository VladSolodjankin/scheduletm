# PROJECT_MAP

## Назначение модулей

- `bot/` — существующее backend-приложение Telegram-бота.
- `server/` — API для web-приложения:
  - `server/src/index.ts` — bootstrap.
  - `server/src/app.ts` — инициализация Express middleware/роутов.
  - `server/src/config/*` — env + схемы валидации.
  - `server/src/routes/*` — auth/settings/integrations/appointments/health endpoints.
  - `server/src/services/*` — бизнес-логика auth/settings/appointments.
  - `server/src/repositories/appointmentRepository.ts` — доступ к appointments для web-сценариев.
  - `server/src/middlewares/*` — auth + login lock middleware.
  - `server/src/repositories/appSettingsRepository.ts` + `webUserRepository.ts` + `loginAttemptRepository.ts` + `googleOAuthStateRepository.ts` — хранение state/settings в БД.

## Data map (server)

- `telegram_users` — Telegram users.
- `web_users` — web auth users (email/password hash/salt).
- `web_users.role` — роль web-пользователя (`owner`/`admin`/`specialist`).
- `web_users.google_api_key` — Google OAuth `access_token`, сохраняемый после web-коннекта Google.
- `user_identity_links` — 1:1 bridge между `telegram_users` и `web_users` внутри `account_id`.
- `specialists.user_id` — 1:1 bridge между `specialists` и `web_users` внутри `account_id`.
- `web_user_sessions` — web auth-сессии (`access`/`refresh`) с `expires_at`/`revoked_at`, источник истины для проверки токенов и refresh-rotation.
- Миграция: `server/src/db/migrations/20260420133000_add_web_users_and_identity_links.ts`.
- Реализация: `server/src/services/authService.ts` + `bot/src/services/user.service.ts` используют эту схему для auth и auto-link по email.
- `web/` — SPA:
  - `web/src/app/*` — root app + router.
  - `web/src/pages/*` — страницы.
  - `web/src/containers/*` — контейнеры с запросами и состоянием.
  - `web/src/components/*` — UI-компоненты и layout (`MainLayout`, `Header`, `LeftMenu`).
  - `web/src/components/layout/UserMenu.tsx` — профиль в header (avatar/инициалы, меню settings/logout).
  - `web/src/shared/ui/*` — базовые MUI-wrapper компоненты (`AppButton`, `AppTabs`, `AppForm`, `AppTextField`, `AppPage`, `AppIcons`).
  - Формы страниц `login/register/settings` управляются через `react-hook-form` (`Controller` + `useForm`).
  - `web/src/shared/theme/*` — константы дизайна + фабрика темы + light/dark + palette variants.
  - `web/src/shared/*` — API client, типы, auth context и переиспользуемая инфраструктура.
  - `web/src/shared/api/client.ts` — глобальный `401` handler: при `Unauthorized` очищает auth-state и переводит пользователя на `/login`.
  - `web/src/shared/i18n/*` — словари переводов (`ru/en`) и i18n-контекст приложения.
  - До логина показываются только auth-страницы (`/login`, `/register`) без header/left menu; после регистрации маршрут ведёт на `/login`.
  - Добавлена страница `web/src/pages/AppointmentsPage.tsx` и контейнер `web/src/containers/AppointmentsContainer.tsx` для календаря appointments.
  - Для первой загрузки appointments контейнер показывает skeleton-preloader вместо пустого состояния страницы.

## API карта (MVP)

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/specialists`
- `GET /api/settings/system` (owner/admin)
- `PUT /api/settings/system` (owner/admin)
- `GET /api/settings/user`
- `PUT /api/settings/user`
- `POST /api/integrations/google/oauth/start`
- `GET /api/integrations/google/oauth/callback`
- `GET /api/appointments`
- `POST /api/appointments`
- `PATCH /api/appointments/:id`
- `POST /api/appointments/:id/cancel`
- `POST /api/appointments/:id/reschedule`

### Appointments response (текущее расширение)

- `GET /api/appointments` возвращает:
  - `appointments[]` (UTC timestamps),
  - `specialists[]` с `timezone`,
  - `busySlots[]` из внешнего календаря (Google) в заданном диапазоне `from/to`.

### Timezone policy

- Источник истины для хранения времени — UTC в БД/API.
- Источник timezone отображения в web-календаре — локальная timezone браузера пользователя.
- Web выполняет двустороннюю конвертацию `datetime-local <-> UTC` на клиенте.
- `web_users.timezone` и `clients.timezone` хранятся в IANA-формате (DST-safe), чтобы корректно строить сообщения и напоминания по локальному времени пользователя.

## API карта (следующий инкремент — appointments)

- `GET /api/appointments` — список записей с фильтрами.
- `POST /api/appointments` — создать запись.
- `GET /api/appointments/:id` — получить запись.
- `PATCH /api/appointments/:id` — обновить запись (в т.ч. `meetingLink`).
- `POST /api/appointments/:id/cancel` — отменить запись.
- `POST /api/appointments/:id/reschedule` — перенести запись.
- `POST /api/appointments/:id/mark-paid` — подтвердить оплату.
- `POST /api/appointments/:id/notify` — ручное уведомление.

### Текущий MVP scope (статус)

- Реализовано в первом слайсе:
  - `GET /api/appointments`
  - `POST /api/appointments`
  - `PATCH /api/appointments/:id`
  - `POST /api/appointments/:id/cancel`
  - `POST /api/appointments/:id/reschedule`
  - web календарь переведен на time-grid (`Day/Week`) с отображением appointments прямо в слотах по времени.
  - web поддерживает drag&drop перенос appointments между слотами (используется backend `reschedule` endpoint).
  - для прошлых слотов в календаре используется error toast при попытке клика/переноса записи, вместо постоянного hover-сообщения.
- Откладываем на следующий шаг:
  - `mark-paid`
  - `notify`
  - расширенные фильтры и аудит-лог.

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

## Google credentials (текущее разделение)

- `web_users.google_api_key` — ключ, полученный через OAuth в web (под будущие роли и self-service логин специалистов).
- `specialists.user_id` — связь владельца credentials с конкретным специалистом.
- `specialists` не хранит Google credentials; bot/web должны использовать `web_users.google_api_key/google_calendar_id` через связь `specialists.user_id`.

## Тестовая карта (smoke)

- `server/tests/appointments.routes.smoke.test.ts` — route-smoke для API сценариев `create`, `reschedule`, `cancel` через Express app + `vitest` + встроенный `fetch` Node.js (service-слой замокан).
- `web/tests/e2e/smoke.e2e.test.mjs` — web smoke для сценариев `auth/settings/appointments` (проверка маршрутов и API-контрактов на уровне SPA-кода).
