# PROJECT_MAP

## Назначение модулей

- `bot/` — существующее backend-приложение Telegram-бота.
- `server/` — API для web-приложения:
  - `server/src/index.ts` — bootstrap.
  - `server/src/app.ts` — инициализация Express middleware/роутов.
  - `server/src/i18n/*` — server-side словари (`ru/en`) и helper локализации сообщений API.
  - `server/src/config/*` — env + схемы валидации.
  - `server/src/routes/*` — auth/settings/integrations/appointments/specialists/users/health endpoints.
  - `server/src/services/*` — бизнес-логика auth/settings/appointments.
  - `server/src/repositories/appointmentRepository.ts` — доступ к appointments для web-сценариев.
  - `server/src/middlewares/*` — auth + login lock middleware.
  - `server/src/repositories/appSettingsRepository.ts` + `webUserRepository.ts` + `loginAttemptRepository.ts` + `googleOAuthStateRepository.ts` — хранение state/settings в БД.

## Data map (server)

- `telegram_users` — Telegram users.
- `web_users` — web auth users (email/password hash/salt + first_name/last_name/phone/telegram_username).
- `web_users.role` — роль web-пользователя (`owner`/`admin`/`specialist`).
- `web_user_integrations.google_api_key` — Google OAuth `access_token`, сохраняемый после web-коннекта Google.
- `web_user_integrations.telegram_bot_token` — персональный Telegram BOT_TOKEN из user settings.
- `web_user_integrations.telegram_bot_username` / `web_user_integrations.telegram_bot_name` — метаданные бота из `getMe` для отображения статуса интеграции.
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
  - Управление специалистами вынесено в отдельную страницу `web/src/pages/SpecialistsPage.tsx` и контейнер `web/src/containers/SpecialistsContainer.tsx` (раздел `/specialists` в левом меню только для `owner/admin`).
  - Добавление специалиста выполняется через dropdown пользователей из `web_users` текущего `account_id` с фильтрацией `role = specialist` и `is_active = true`.
  - Страница `web/src/pages/UsersPage.tsx` использует i18n-словарь для таблицы/формы и переиспользуемый `AppRhfPhoneField` для ввода телефона пользователя.
  - `web/src/shared/theme/*` — константы дизайна + фабрика темы + light/dark + palette variants.
  - `web/src/shared/*` — API client, типы, auth context и переиспользуемая инфраструктура.
  - `web/src/shared/api/client.ts` — глобальный `401` handler: при `Unauthorized` очищает auth-state и переводит пользователя на `/login`.
  - `web/src/shared/api/error.ts` — единый parser API-ошибок: вытаскивает backend `message`/`errors` и подставляет user-friendly fallback для сетевых сбоев.
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
- `GET /api/specialists`
- `POST /api/specialists`
- `PATCH /api/specialists/:id`
- `DELETE /api/specialists/:id` (soft deactivate via `is_active=false`)
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id` (soft deactivate via `is_active=false`)
- `GET /api/integrations/google/oauth/callback`
- `GET /api/appointments`
- `POST /api/appointments`
- `PATCH /api/appointments/:id`
- `POST /api/appointments/:id/cancel`
- `POST /api/appointments/:id/reschedule`
- `POST /api/appointments/:id/mark-paid`
- `POST /api/appointments/:id/notify`

Разделение ответственности настроек:
- `system settings` — только операционные параметры аккаунта (`slot duration`, `daily digest`, `week starts`).
- `user settings` — персональные параметры пользователя (`timezone`, `locale`, UI, интеграции).

### Appointments response (текущее расширение)

- `GET /api/appointments` возвращает:
  - `appointments[]` (UTC timestamps),
  - `specialists[]` с `timezone`,
  - `clients[]` (клиенты текущего `account_id` для выбора в web-форме appointment),
  - `busySlots[]` из внешнего календаря (Google) в заданном диапазоне `from/to`.

### Appointments create validation (текущее расширение)

- `POST /api/appointments` требует:
  - `appointmentAt`,
  - `appointmentEndAt`,
  - `firstName`,
  - `lastName`,
  - хотя бы одно поле контакта: `username` или `phone` или `email`.

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
  - web календарь переведен на time-grid (`Day/Week`) с отображением appointments прямо в слотах по времени; в режиме недели первый день всегда понедельник (Monday → Sunday), текущий день подсвечивается в шапке; добавлен `Month` режим со списком appointments по каждой дате.
  - в `Month` режиме клик по дню открывает popup создания appointment с дефолтным временем `09:00`.
  - во всех календарных режимах (`Day/Week/Month`) прошедшие дни отображаются приглушенно (серый disabled-style).
  - при клике по слоту календаря форма создания appointment предзаполняется временем выбранного слота.
  - web поддерживает drag&drop перенос appointments между слотами (используется backend `reschedule` endpoint).
  - для прошлых слотов в календаре используется error toast при попытке клика/переноса записи, вместо постоянного hover-сообщения.
  - диалог create/edit appointment использует responsive grid-группы полей: блоки specialist/client и контактные данные — в 2 колонки на `sm+`, а `Start date` + `Start time` + `End time` — в одной строке (3 колонки) перед контактным блоком.
- Откладываем на следующий шаг:
  - расширенные фильтры и углубленный аудит-лог (поиск/фильтрация по актору и периоду).

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

## Telegram Bot token (текущее разделение)

- `PUT /api/settings/user` принимает `telegramBotToken` (password-поле на фронте).
- Server пытается провалидировать токен через Telegram `getMe`; если запрос неуспешен, токен сохраняется как fallback.
- `bot` использует токен из `web_user_integrations.telegram_bot_token` для вызовов Telegram API.

## Google credentials (текущее разделение)

- `web_user_integrations.google_api_key` — ключ, полученный через OAuth в web (под будущие роли и self-service логин специалистов).
- `specialists.user_id` — связь владельца credentials с конкретным специалистом.
- `specialists` не хранит Google credentials; bot/web должны использовать `web_user_integrations.google_api_key/google_calendar_id` через связь `specialists.user_id`.

## Тестовая карта (smoke + integration)

- `server/tests/appointments.routes.smoke.test.ts` — route-smoke для API сценариев `create`, `reschedule`, `cancel` через Express app + `vitest` + встроенный `fetch` Node.js (service-слой замокан).
- `web/tests/e2e/smoke.e2e.test.mjs` — web smoke для сценариев `auth/settings/appointments` (проверка маршрутов и API-контрактов на уровне SPA-кода).
- Рекомендуемый следующий слой: web integration-тесты против поднятого `server` (без API-моков) для модулей:
  - `appointments`: ключевой lifecycle (`list/create/edit/reschedule/cancel/mark-paid/notify`),
  - `specialists`: CRUD + role-gates,
  - `settings`: user/system read-write + проверки `401/403/422`.
- Практичный объём для MVP: 8–12 критических сценариев в отдельном CI job (PR + nightly).

## Что делать следующим шагом (после 4.7)

- `server/src/routes/appointmentRoutes.ts` + `server/src/services/appointmentService.ts`:
  - добавить query-параметры для фильтрации событий аудита (по actor/action/периоду);
  - добавить endpoint получения audit-ленты по записи с пагинацией.
- `web/src/components/appointments/AppointmentFormDialog.tsx` + `web/src/containers/AppointmentsContainer.tsx`:
  - добавить фильтры и компактный просмотр полной истории действий по выбранной записи.
- `web/src/containers/AppointmentsContainer.tsx`:
  - добавить расширенные фильтры календаря (status/paymentStatus/specialist/period) без дублирования бизнес-логики.
- Тесты:
  - расширить `server/tests/appointments.routes.smoke.test.ts` сценариями фильтрации и чтения audit-ленты;
  - дополнить `web/tests/e2e/smoke.e2e.test.mjs` проверкой UI-фильтров и отображения истории.
