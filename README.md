# Meetli (`scheduletm`) Monorepo

Единый репозиторий платформы управления расписанием:

- **`web/`** — React SPA для owner/admin/specialist.
- **`server/`** — Node.js/Express API для web-клиента и интеграций.
- **`bot/`** — Telegram-бот для записи клиентов.

---

## 1) Быстрый старт

### Требования

- Node.js 20+
- npm 10+
- PostgreSQL

### Установка

```bash
npm install
```

### Запуск по модулям

```bash
# API
npm run -w @scheduletm/server dev

# Web (включает ESLint + typecheck перед стартом)
npm run -w @scheduletm/web dev

# Bot
npm run -w bot dev
```

> Точные переменные окружения и команды для production — в README каждого модуля.

### Рекомендуемый setup для отдельного dev-домена

Если frontend доступен с `https://dev.meetli.cc`, а API с `https://apidev.meetli.cc`, держите переменные по средам раздельно:

- `web/.env.development`:
  - `VITE_API_URL=https://apidev.meetli.cc`
- `server/.env.development`:
  - `APP_URL=https://dev.meetli.cc`
  - `API_BASE_URL=https://apidev.meetli.cc`
  - `GOOGLE_OAUTH_REDIRECT_URI=https://apidev.meetli.cc/api/integrations/google/oauth/callback`
- OAuth-секреты (`GOOGLE_OAUTH_CLIENT_SECRET`) и другие секреты — только в server env, не в web.

Для локальной разработки оставляйте `localhost` значения в `.env.local`/`.env` и не смешивайте их с доменными dev-значениями.

### Линтинг web

```bash
npm run -w @scheduletm/web lint
```

### Одна команда для миграций + тестов по каждому модулю

```bash
# web (no-op миграции + тесты)
npm run qa:web

# server (migrate:latest + тесты)
npm run qa:server

# bot (no-op миграции + тесты)
npm run qa:bot
```

Для `qa:server` убедитесь, что в `server/.env` (или переменных окружения CI) заполнены `DATABASE_PUBLIC_URL` или `DATABASE_URL`.

---

## 2) Архитектура

```text
scheduletm/
├── README.md
├── PROJECT_MAP.md
├── TODO.md
├── PRODUCTION_READINESS_CHECKLIST.md
├── web/
│   ├── README.md
│   └── PROJECT_MAP.md
├── server/
│   ├── README.md
│   └── PROJECT_MAP.md
└── bot/
    ├── README.md
    └── PROJECT_MAP.md
```

- Глобальная карта: [`PROJECT_MAP.md`](./PROJECT_MAP.md)
- Карта web: [`web/PROJECT_MAP.md`](./web/PROJECT_MAP.md)
- Карта server: [`server/PROJECT_MAP.md`](./server/PROJECT_MAP.md)
- Права ролей (RBAC): [`server/docs/rbac.md`](./server/docs/rbac.md)
- Карта bot: [`bot/PROJECT_MAP.md`](./bot/PROJECT_MAP.md)

---

## 3) Что уже реализовано (MVP)

### Web + Server

- Auth: register/login/refresh/logout + 4-digit OTP email verification (with resend and auto-confirm UX) + invite onboarding page `/verify-email` for creating account from invitation.
- Роли: `owner` / `admin` / `specialist` / `client` (RBAC policy централизована в server).
- Settings: system + account + user settings, and a dedicated `Integrations` tab. Password change is moved to a dedicated `Password` tab (available for all roles), requires entering the current password for security, and uses OTP confirmation inline (without modal popup). In `User settings`, users can edit required `firstName`/`lastName`, optional `phone` and optional `telegramUsername`, along with timezone/locale. `telegramBotToken` and Google connect/disconnect actions are placed in `Integrations`. Timezone fields in Web use a fixed hardcoded IANA list (same list for appointments, account and user settings). `Default meeting duration` in system/account settings is selected from dropdown options 30–90 minutes (step 10).
<<<<<<< codex/create-interactive-map-component-with-pin
- Account settings include interactive business location setup fields: `businessAddress`, `businessLat`, `businessLng`, plus an interactive Mapbox map with crosshair picker, quick zoom-to-my-position icon, and save callback with reverse-geocoded full address in UI for updating account coordinates.
=======
- Account settings include interactive business location setup fields: `businessAddress`, `businessLat`, `businessLng`, plus an interactive Mapbox map with crosshair picker and save callback in UI for updating account coordinates.
>>>>>>> main
- Integrations: Google OAuth start/callback, Telegram bot token в user integrations. Google connect action in `Integrations` uses a branded Google button with G icon for clearer provider identification. When Telegram bot is already connected, the token input is hidden by default and can be expanded with an edit icon near the connection status. Telegram username and bot token fields in `User settings` explicitly disable browser credential autofill (`off` and `telegram-bot-token`) to avoid accidental login/password substitution when fields are empty. Integration buttons in `Integrations` are displayed vertically, and each provider action (Zoom/Google) has an adjacent info icon that opens a popover with integration purpose and usage details.
- Notifications: appointment notify flow with channel fallback (Telegram -> Email) + retry/backoff pipeline in scheduler (`pending/retry/processing/sent/failed`, `next_retry_at`, `max_attempts`, idempotent key per `appointment_id + type + channel`).
- Notification logs page (`/notification-logs`) with role-aware access (`owner/admin/specialist`), filters and human-readable fields (specialist/client names, message, Telegram, email), including manual resend for failed deliveries.
- Error tracking for `web` + `server` + `bot`: frontend runtime errors, backend `5xx` responses, and bot process/webhook errors are persisted in `error_logs`; UI page `/error-logs` is available only for `owner`; retention is 7 days; optional Telegram alerts can be sent via a dedicated bot token + chat id configured in `system_settings` (encrypted at rest, without email costs).
- Appointments lifecycle: list/create/edit/reschedule/cancel/mark-paid/notify. In `Create/Edit appointment`, empty `Client` defaults to `New client`, and client detail fields are explicitly prefixed (`Client first name`, `Client last name`, etc.) for clearer context.
- Appointments audit/events: `GET /api/appointments` возвращает `events[]` c actor context и поддерживает event-фильтры (`eventAction`, `eventActorWebUserId`, `eventFrom`, `eventTo`).
- Late cancellation UX (web + bot): before cancel confirmation the user sees refund/no-refund outcome according to specialist booking policy (`cancel_grace_period_hours`, `refund_on_late_cancel`), and after cancellation bot sends final refund status.
- Scheduler: auto-cancel unpaid appointments by specialist booking policy (`auto_cancel_unpaid_enabled`, `unpaid_auto_cancel_after_hours`) with audit reason `auto_cancel_unpaid`.
- Specialists и Users CRUD (с role-gates).
- Client web users:
  - owner/admin/specialist могут создавать пользователей с ролью `client`;
  - `client` может входить в web-приложение, редактировать собственный профиль и управлять только своими записями (создание/редактирование/перенос/отмена);
  - Google OAuth доступен для подключения календаря и синхронизации занятости.
- Базовая i18n поддержка (`ru/en`) в web + локализованные server messages.
- Email notifications via Brevo SMTP API (`no-reply@meetli.cc`) with hardcoded templates:
  - email verification;
  - registration success;
  - appointment reminder;
  - managed user invite-link onboarding (one-time invite link with 24h TTL, invited user stays inactive until verification/accept-invite, managers can resend invite link for unverified users).

### Bot

- Запись через Telegram webhook.
- State machine сценария в Postgres.
- Выбор услуги/специалиста/даты/времени.
- Перенос и отмена записи.
- Напоминания с retry-механизмом.
- Учет timezone через IANA, хранение времени в UTC.

---

## 4) Документация и статус

- Глобальный roadmap: [`TODO.md`](./TODO.md)
- План по Zoom/meeting providers: [`docs/meeting-platforms-zoom-plan.md`](./docs/meeting-platforms-zoom-plan.md)
- Глобальная production-ready проверка: [`PRODUCTION_READINESS_CHECKLIST.md`](./PRODUCTION_READINESS_CHECKLIST.md)
- Bot-специфика:
  - [`bot/TODO.md`](./bot/TODO.md)
  - [`bot/PRODUCTION_READINESS_CHECKLIST.md`](./bot/PRODUCTION_READINESS_CHECKLIST.md)
  - [`bot/MVP_NO_PAYMENT_PLAN.md`](./bot/MVP_NO_PAYMENT_PLAN.md)

---

## 5) Принципы разработки

- **KISS**: делаем простейшее рабочее решение.
- **DRY**: не дублируем доменную логику.
- **SOLID**: сохраняем четкие границы между слоями и модулями.
- **Не over-engineer**: никаких преждевременных абстракций.


Основываясь на README.md
Не забудь обновить документации
Не забывай использовать локали для текстов, если локаль не используется в текущем файле который ты редактируешь, то добавь


Идеи:

Настройки отмены записи реализованы на уровне `specialist_booking_policies`:
 - `cancel_grace_period_hours` — окно до начала записи;
 - `refund_on_late_cancel` — логика возврата при поздней отмене;
 - `auto_cancel_unpaid_enabled` + `unpaid_auto_cancel_after_hours` — авто-отмена неоплаченных записей.

UX-правило поздней отмены:
 - в web и bot перед подтверждением отмены показывается результат (`refund` / `no-refund`);
 - в bot после отмены приходит итоговое сообщение о результате по возврату.
Нужно сделать system_settings следующим образом
 - Будут доступны только для Owner
 - Будут ссылаться на таблицу system_settings
 - Будет возможность настроек системы на уровне Owner (REFRESH_TOKEN_TTL_DAYS, ACCESS_TOKEN_TTL_SECONDS, SESSION_COOKIE_NAME) и другие runtime-настройки без секретов (можешь что-то посоветовать, если есть идеи)
 - GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI храним только в `.env`

app_settings наверное лучше переименовать в user_settings (нужен совет как это лучше сделать, возможно надо часть настроек перенести в user_settings и сделать еще одну таблицу account_settings - могут редактировать Owner с сортировкой по account_id, админы аккаунта)
 - перенести всю логику из app_settings в user_settings
 - перенести часть полей из web_user в user_settings (google_api_key, google_calendar_id, timezone, locale, ui_theme_mode, ui_palette_variant_id, google_refresh_token, google_token_expires_at, telegram_bot_token)
 - Позже добавим другие настройки

нужно сделать notification_settings (нужен совет как лучше это реализовать)
 - не знаю как лучше это реализовать на уровне какого то конкретного юзера или на уровне системы или и там и там user_notification_settings и account_notification_settings
 - будет включать в себя настройки когда отправлять нужно ли оповещать о только что созданном апоинтменте, напоминание о апоинтменте, какие то информационные оповещения и т.д

---

## 6) Backlog: Public pages, account slug и кастомный лендинг

Детальная спецификация вынесена в отдельный документ: [`docs/public-pages-backlog.md`](./docs/public-pages-backlog.md).
