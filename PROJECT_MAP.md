# PROJECT_MAP

Этот документ описывает фактическую структуру репозитория `scheduletm`, ключевые потоки и точки расширения (актуально по состоянию коду в `src/`).

## Что это за проект

`scheduletm` это backend-приложение, которое:

- поднимает Express-сервер,
- принимает Telegram updates через webhook,
- ведёт пользователя по сценарию бронирования как state machine,
- хранит данные в PostgreSQL через Knex,
- отправляет сообщения/редактирует сообщения через Telegram Bot API.

## Дерево проекта (главное)

- `src/app.ts` - bootstrap Express + регистрация роутов + `setWebhook()` на старте
- `src/config/env.ts` - чтение env-переменных
- `src/routes/telegramWebhook.ts` - единый webhook-роут и основная «оркестрация» диалога
- `src/bot/*` - обёртка над Telegram Bot API + генераторы клавиатур
- `src/i18n/*` - словари и `t()`
- `src/services/*` - бизнес-логика (выбор услуги/специалиста, слоты, запись, перенос, отмена)
- `src/repositories/*` - доступ к БД (CRUD/запросы)
- `src/db/*` - knex init, миграции и сиды
- `src/utils/timezone.ts` - timezone-утилиты (IANA): конвертация локального времени аккаунта <-> UTC ISO, диапазоны суток и «сегодня» в timezone аккаунта
- `src/jobs/reminder.job.ts` - воркер напоминаний: опрашивает `notifications`, отправляет и управляет ретраями
- `src/utils/BPMN/BPMN.ts` - экспериментальная BPMN-утилита (пока не интегрирована)

Сборка: `vite build` собирает SSR entry `src/app.ts` в `dist/app.js`, который запускается командой `npm run start`.

## Основные потоки

### Запуск приложения

1. `src/app.ts` создаёт Express-приложение, включает `express.json()`.
2. Регистрирует `GET /health`.
3. Регистрирует `telegramWebhookRouter`.
4. На `app.listen` вызывает `setWebhook()` и печатает `getWebhookInfo()`.

### Telegram webhook

Роут: `POST /telegram/webhook/:secret`

- `:secret` сравнивается с `env.webhookSecret`. Несовпадение -> `403`.
- Далее update обрабатывается как:
  - `callback_query` (inline-кнопки, `callback_data`)
  - `message` (текст, контакт)
- Состояние диалога хранится в `user_sessions`:
  - `state` (строка из `UserSessionState`)
  - `payload_json` (JSON с выбранными параметрами)

### State machine (сессия)

Состояния перечислены в [src/types/session.ts](./src/types/session.ts):

- `idle`
- `choosing_service`
- `choosing_specialist`
- `choosing_date`
- `choosing_time`
- `entering_name` (сейчас зарезервировано, но не используется в UI)
- `entering_phone`
- `entering_email`
- `confirming`

`payload_json` (тип `BookingPayload`) хранит выбранные `serviceId/specialistId/date/time` и введённые контакты.

## Контракт callback_data

Генерация клавиатур: [src/bot/keyboards.ts](./src/bot/keyboards.ts).

Webhook-роут ожидает следующие форматы:

- `service:<id>`
- `specialist:<id>`
- `back:services`
- `date:<YYYY-MM-DD>`
- `time_<HHMM>` (например `time_0930`)
- `time_change_date`
- `confirm:yes`
- `confirm:edit`
- `appointment:<id>`
- `appointment_edit:<id>`
- `appointment_cancel:<id>`

Также поддерживаются текстовые команды:

- `/start` - приветствие + сброс активной сессии в `idle`
- `/reset` - явный сброс активной сессии в `idle` без смены языка/профиля

## Схема БД (логическая)

Миграции: `src/db/migrations/*`.

- `users`
  - `telegram_id`, `username`, `first_name`, `phone`, `email`, `language_code`
- `services`
  - `code`, `name_ru`, `name_en`, `price`, `currency`, `duration_min`, `is_active`, ...
- `specialists`
  - `code`, `name`, `is_default`, `is_active`
- `user_sessions`
  - `user_id` (unique), `state`, `payload_json`
- `app_settings`
  - `timezone`, `work_start_hour`, `work_end_hour`, `work_days`, `slot_duration_min`
- `appointments`
  - `user_id`, `service_id`, `specialist_id`, `appointment_at` (timestamptz), `duration_min`, `status`, `price`, `currency`, ...
- `notifications`
  - очередь уведомлений по каналам (`telegram/email/sms`), статусам (`pending/retry/sent/failed/cancelled`), ретраям и данным получателя


### Уведомления

- При подтверждении записи создаются уведомления T-24h (по доступным каналам: Telegram, email, SMS).
- При переносе записи старые pending/retry уведомления отменяются и создаются заново на новую дату; при отмене записи pending/retry уведомления переводятся в `cancelled`.
- Фоновая джоба `startReminderJob()` раз в `NOTIFICATION_POLL_MS` выбирает due-сообщения из `notifications`.
- При ошибке отправки применяется exponential backoff (до `max_attempts`), после чего запись переходит в `failed`.

## Где менять поведение

### «Сценарий»

Сейчас сценарий «зашит» в [src/routes/telegramWebhook.ts](./src/routes/telegramWebhook.ts) и вызывает сервисы:

- `src/services/booking.service.ts`
- `src/services/slot.service.ts`
- `src/services/appointment.service.ts`
- `src/services/date.service.ts`

Если планируется несколько сценариев или расширение под других пользователей:

1. Вынести сценарий в `src/scenarios/<name>/*`.
2. Сделать диспетчер в webhook-роуте (по команде, по tenant, по настройке в БД).
3. Оставить репозитории и инфраструктуру (db/bot/i18n) общими.

### Данные (услуги/специалисты/расписание)

- Сиды по умолчанию: [src/db/seeds/booking.ts](./src/db/seeds/booking.ts).
- Рабочие часы и дни: `app_settings`.

## Известные ограничения (важные для расширения)

- Шаг сетки слотов пока фиксированный (`SLOT_STEP_MIN = 30`) в [src/services/slot.service.ts](./src/services/slot.service.ts), без настройки из `app_settings`.
- `vite build` не делает typecheck автоматически. Если включать BPMN-интеграцию, лучше добавить отдельный `typecheck` и зависимости.

## См. также

- [README.md](./README.md)
- [TODO.md](./TODO.md)
