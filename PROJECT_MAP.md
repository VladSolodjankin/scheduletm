# PROJECT_MAP

Документ описывает структуру проекта, архитектуру, основные потоки и назначение файлов (на основе текущего состояния репозитория).

## Что это за проект

`scheduletm` это backend-приложение, которое:

- поднимает Express-сервер,
- принимает Telegram updates через webhook,
- ведет пользователя по сценарию бронирования (выбор услуги -> специалиста -> даты -> времени -> контактов -> подтверждение),
- читает/пишет данные в PostgreSQL,
- формирует ссылки (Google Calendar, заглушка оплаты) и отправляет сообщения через Telegram Bot API.

## Архитектура (слои)

- `routes/` - HTTP слой: валидация секрета вебхука, разбор Telegram update, маршрутизация по callback/text.
- `services/` - бизнес-логика сценария (старт бронирования, выбор услуги/специалиста, создание записи, вычисление доступных слотов, уведомления).
- `repositories/` - доступ к БД через Knex (CRUD/запросы).
- `db/` - инициализация Knex, миграции и сиды.
- `i18n/` - словари и функция `t()` для локализации.
- `bot/` - thin-wrapper над Telegram Bot API + генераторы клавиатур.

Сборка: Vite собирает SSR entry `src/app.ts` в `dist/app.js`, который запускается `node dist/app.js`.

## Основные потоки

### Запуск приложения

1. `src/app.ts` поднимает Express и регистрирует JSON body parser.
2. Регистрируется router `telegramWebhookRouter`.
3. При старте сервер вызывает `setWebhook()` (Telegram начинает слать updates на `APP_URL/telegram/webhook/WEBHOOK_SECRET`) и затем `getWebhookInfo()` (вывод информации в лог).

### Вебхук Telegram

Роут: `POST /telegram/webhook/:secret`

- Секрет из пути сравнивается с `env.webhookSecret`. Несовпадение -> `403 Forbidden`.
- Update обрабатывается как `callback_query` (нажатия inline-кнопок, `callback_data`) или как `message` (текст / контакт).
- Состояние диалога хранится в таблице `user_sessions`:
  - `state` (строка)
  - `payload_json` (JSON с выбранными параметрами)

Форматы `callback_data`, которые используются в UI:

- `service:<id>`
- `specialist:<id>`
- `date:<YYYY-MM-DD>`
- `time_<HHMM>` (например `time_0930`)
- `confirm:yes`, `confirm:edit`

### Вычисление слотов

`getAvailableSlots()`:

- берет `duration_min` услуги (fallback 90),
- строит сетку слотов с 09:00 до 20:00,
- исключает занятые слоты по данным `appointments` (времена считаются в Москве, хранение в UTC ISO).

## Модель данных (PostgreSQL)

Миграции создают/изменяют таблицы:

- `users`
  - Telegram-профиль и контакты (`telegram_id`, `username`, `first_name`, `phone`, `email`, `language_code`)
- `services`
  - каталог услуг (`code`, `name_ru`, `name_en`, `price`, `currency`, `duration_min`, `sessions_count`, `is_first_free`, `is_active`)
- `specialists`
  - специалисты (`code`, `name`, `is_active`, `is_default`)
- `user_sessions`
  - state machine диалога (`user_id` уникальный, `state`, `payload_json`)
- `appointments`
  - записи (`user_id`, `service_id`, `specialist_id`, `appointment_at` timestamptz, `duration_min`, `status`, `price`, `currency`, ...)
- `notifications`
  - очередь/история уведомлений (сейчас таблица есть, job-процессинг пока placeholder)
- `app_settings`
  - настройки расписания/таймзоны (в текущей логике частично используется только `timezone`)

## Карта файлов

Ниже перечислены файлы проекта (без содержимого `node_modules/`, `.git/`, `.idea/`).

### Корень репозитория

| Путь | Назначение |
| --- | --- |
| `.env` | Локальные переменные окружения (не коммитится). |
| `.gitignore` | Игнорируемые каталоги/файлы (включая `dist`, `node_modules`, `.env`). |
| `knexfile.ts` | Конфигурация Knex для `development` и `production` (разные переменные подключения и разные директории миграций/сидов: `src/` vs `dist/`). |
| `package.json` | Скрипты сборки/старта, зависимости (Express/Knex/pg/axios), конфигурация ESM (`"type": "module"`). |
| `package-lock.json` | Lockfile npm. |
| `tsconfig.json` | TS настройки (strict, ESNext modules, `noEmit: true`; сборка делается Vite). |
| `vite.config.ts` | SSR build: entry `src/app.ts` -> `dist/app.js`, `target: node20`, sourcemap. |
| `dist/app.js` | Результат сборки (генерируется). |
| `dist/app.js.map` | Sourcemap сборки (генерируется). |

### `src/` (исходники)

| Путь | Назначение |
| --- | --- |
| `src/app.ts` | Точка входа: Express app, `/health`, подключение роутов, запуск сервера, установка Telegram webhook. |
| `src/config/env.ts` | Чтение env vars через `dotenv`, валидация обязательных переменных (`BOT_TOKEN`, `WEBHOOK_SECRET`, `APP_URL`). |
| `src/routes/telegramWebhook.ts` | Основной обработчик Telegram updates: проверка секрета, state machine, inline callbacks, ввод контактов, подтверждение записи, генерация ссылок. |
| `src/types/session.ts` | Enum `UserSessionState` и тип `BookingPayload` для `user_sessions.payload_json`. |
| `src/bot/bot.ts` | Обертка над Telegram Bot API (send/edit/answerCallbackQuery, setWebhook, getWebhookInfo) через `axios`. |
| `src/bot/keyboards.ts` | Генераторы reply/inline клавиатур для разных экранов (меню, выбор языка, услуги/специалисты/даты/слоты, запрос контакта, подтверждение). |
| `src/i18n/index.ts` | `t()` с параметрами (`{{key}}`) и `normalizeLanguageCode()` (поддержка `ru`/`en`). |
| `src/i18n/dictionaries.ts` | Словари переводов для `ru` и `en`. |
| `src/db/knex.ts` | Инициализация Knex клиента `db` на базе `knexfile.ts` и `NODE_ENV`. |
| `src/db/migrations/20260418125450_init_schema.ts` | Базовые таблицы (users/services/app_settings/appointments/notifications). |
| `src/db/migrations/20260418132149_booking_foundation.ts` | Расширение схемы под бронирование: `language_code`, `specialists`, `user_sessions`, `specialist_id` в appointments. |
| `src/db/migrations/20260418134116_booking_foundation_1.ts` | Нормализация `services` под `code`, `name_ru`, `name_en` (миграция данных из старого `name`). |
| `src/db/migrations/20260418150000_insert_default_app_settings.ts` | Вставка дефолтной строки в `app_settings`, если таблица существует и пуста. |
| `src/db/seeds/booking.ts` | Seed: очищает базовые таблицы и вставляет дефолтные `services`, `specialists`, `app_settings`. |
| `src/services/booking.service.ts` | Оркестрация шагов бронирования: старт, выбор услуги, выбор специалиста, переходы state и формирование доступных дат. |
| `src/services/slot.service.ts` | Расчет доступных слотов на дату с учетом длительности услуги и занятости по appointments. |
| `src/services/appointment.service.ts` | Создание записи: перевод даты/времени из Москвы в UTC ISO и вставка в `appointments`. |
| `src/services/notification.service.ts` | Заглушка уведомлений: отправляет в Telegram текст о том, что “мы напомним” по телефону/email (если указаны). |
| `src/services/date.service.ts` | Генерация ближайших рабочих дат (по умолчанию 7) для выбора пользователем. |
| `src/services/user.service.ts` | Создание/обновление пользователя по Telegram профилю + обеспечение наличия `user_sessions`. |
| `src/repositories/user.repository.ts` | Доступ к `users`: поиск по `telegram_id`, создание, patch-update. |
| `src/repositories/user-session.repository.ts` | Доступ к `user_sessions`: get-or-create, update state, merge payload, чтение payload. |
| `src/repositories/service.repository.ts` | Доступ к `services`: активные, по id. |
| `src/repositories/specialist.repository.ts` | Доступ к `specialists`: активные, по id, логика “единственного дефолтного специалиста” для пропуска шага выбора. |
| `src/repositories/appointment.repository.ts` | Доступ к `appointments`: создание, получение занятых времен на дату (UTC range по Москве) для конкретного специалиста. |
| `src/repositories/app-settings.repository.ts` | Чтение дефолтной таймзоны (`app_settings.timezone`) для формирования calendar link. |
| `src/utils/timezone.ts` | Утилиты конвертации “дата/время в Москве” <-> UTC ISO и вычисление UTC range для московской даты. |
| `src/utils/time.ts` | Пустой placeholder (зарезервировано под будущие time helpers). |
| `src/jobs/reminder.job.ts` | Пустой placeholder (зарезервировано под будущие напоминания/cron/queue). |

## Быстрые точки входа для чтения кода

- “Как запускается сервер”: `src/app.ts`
- “Весь сценарий диалога”: `src/routes/telegramWebhook.ts`
- “Состояние и payload”: `src/types/session.ts` + `src/repositories/user-session.repository.ts`
- “Схема базы”: `src/db/migrations/*`
