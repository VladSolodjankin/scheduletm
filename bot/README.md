# scheduletm

Backend Telegram-бот для записи на услуги через webhook (Express + PostgreSQL + Knex). Сейчас реализован базовый сценарий бронирования: услуга -> специалист -> дата -> время -> контакты -> подтверждение.

Текущая схема подготовлена к multi-account модели: один backend обслуживает несколько кабинетов, а изоляция данных выполняется через таблицу `accounts` и поле `account_id` в бизнес-таблицах.

## Возможности

- Telegram webhook endpoint: `POST /telegram/webhook/:secret` (проверка `WEBHOOK_SECRET`).
- Состояние диалога как state machine в Postgres (`telegram_user_sessions.state` + `payload_json`).
- Справочники услуг/специалистов в БД (`services`, `specialists`) и выдача inline-кнопок.
- Поддержка пакетных услуг: `services.sessions_count` позволяет записывать клиента сразу на несколько сессий с отдельным выбором даты/времени для каждой сессии.
- Для пакетов после выбора первого слота можно выбрать режим: автоматически поставить остальные сессии в то же время (еженедельно) или выбрать дату/время для каждой сессии вручную.
- Подбор свободных слотов по рабочим часам и занятости (`appointments`) с шагом 30 минут.
- Подбор свободных слотов по рабочим часам и занятости с двойной проверкой: локальные записи в `appointments` + занятые интервалы из Google Calendar специалиста (ключ берется из связанного `web_users` через `specialists.user_id`, без fallback в `specialists`).
- Расчет стоимости в бронировании от базовых ставок специалиста (`specialists.base_session_price` / `specialists.base_hour_price`) с учетом длительности и количества сессий услуги.
- После подтверждения записи бот отправляет запрос на создание события в Google Calendar конкретного специалиста (если интеграция включена у специалиста).
- Учет timezone аккаунта (`app_settings.timezone`, IANA): слоты, детали записи и конвертация времени в БД работают не только для Москвы.
- Защита от двойного бронирования на уровне БД (исключающее ограничение на пересечение интервалов по `account_id + specialist_id`, кроме `cancelled`).
- Просмотр записей, перенос (если до записи больше 24 часов) и отмена записи пользователем.
- Сброс сценария командами `/start` и `/reset` (очистка сессии пользователя).
- Кнопка «Назад» в шаге выбора специалиста (возврат к услугам).
- i18n (RU/EN) в `src/i18n`.
- Контур напоминаний с настройкой в `app_settings`: можно задавать несколько оффсетов отправки (например 24 часа, 1 час, 30 минут), а персональный комментарий для клиента (например ссылка на встречу) хранится в `clients.reminder_comment`; обработка идёт через `notifications` и фоновую джобу с ретраями/каналами Telegram/email/SMS (email/SMS пока stub-провайдеры); при переносе записи напоминания пересоздаются, при отмене переводятся в `cancelled`.

## Стек

- Node.js 20+
- TypeScript
- Express 5
- Vite SSR build (сборка `src/app.ts` в `dist/app.js`)
- PostgreSQL + Knex
- Telegram Bot API через `axios`

## Эндпоинты

- `GET /health` -> `{ ok: true }`
- `POST /telegram/webhook/:secret` -> обработка Telegram updates

## Переменные окружения

Смотри `.env` или шаблон [.env.example](./.env.example).

- `BOT_TOKEN` - токен Telegram бота
- `WEBHOOK_SECRET` - секрет в URL вебхука
- `APP_URL` - публичный базовый URL приложения (нужен для `setWebhook`)
- `PORT` - порт (по умолчанию `3000`)
- `DATABASE_PUBLIC_URL` - строка подключения к Postgres для `development`
- `DATABASE_URL` - строка подключения к Postgres для `production`
- `NOTIFICATION_POLL_MS` - интервал фоновой обработки уведомлений в миллисекундах (по умолчанию `60000`)
- `AUTO_SET_WEBHOOK` - авто-вызов `setWebhook()` только в `production` (`1/true` для включения)
- `ALERT_POLL_MS` - интервал проверки алертов (по умолчанию `60000`)
- `ALERT_NO_UPDATES_THRESHOLD_MS` - порог алерта по отсутствию входящих updates (по умолчанию `900000`)
- `ALERT_FAILED_GROWTH_THRESHOLD` - порог роста `notifications.failed` для алерта (по умолчанию `5`)

## Быстрый старт (локально)

1. Установить зависимости:

```bash
npm install
```

2. Поднять Postgres и прописать `DATABASE_PUBLIC_URL` в `.env`.

3. Применить миграции и сиды:

```bash
npm run migrate:latest
npm run seed:run
```

4. Собрать и запустить:

```bash
npm run build
npm run start
```

При старте приложение вызывает `setWebhook()` и печатает `getWebhookInfo()` в лог **только если** одновременно:

- `NODE_ENV=production`
- `AUTO_SET_WEBHOOK=1` (или `true`)

Во всех остальных окружениях авто-установка webhook пропускается.

Важно: Telegram webhook должен указывать на публичный HTTPS URL. Для локальной разработки обычно используют ngrok/аналог и подставляют его в `APP_URL`.

## Разработка

Сейчас `npm run dev` делает только `vite build --watch` (пересобирает `dist/app.js`). Обычно запускают в двух терминалах:

```bash
# терминал 1
npm run dev

# терминал 2
npm run start
```

Тесты:

```bash
npm test
```

## Настройка «под свою базу»

Данные для сценария лежат в БД:

- `accounts` - кабинет/рабочее пространство верхнего уровня
- `services` - услуги (в т.ч. `duration_min`, `price`, `currency`, `is_active`)
- `specialists` - специалисты (в т.ч. `is_default`, `is_active`, `base_session_price`, `base_hour_price`)
- Для интеграции календаря у специалиста используется связка:
  - `specialists.user_id` (какой `web_user` владеет интеграцией специалиста)
  - `web_users.google_api_key` / `web_users.google_calendar_id`
  - `specialists` не хранит Google ключи; источник истины — `web_users`
- `app_settings` - рабочие часы/дни и timezone (IANA), в которой показываются слоты/записи
- `appointment_groups` - группы пакетных записей (общая стоимость/статус оплаты пакета), связанные с `appointments.group_id`

Все основные сущности привязаны к `account_id`. Сейчас Telegram-бот работает через `default account`, пока отдельный веб-кабинет и маршрутизация по аккаунтам не вынесены в HTTP API/UI.

Самый простой путь кастомизации:

1. Изменить сид [src/db/seeds/booking.ts](./src/db/seeds/booking.ts) под свои услуги/специалистов.
2. Применить сид `npm run seed:run` (он чистит таблицы `services/specialists/telegram_user_sessions/app_settings`).

## Расширяемость (куда встраивать новые сценарии)

- Точка входа HTTP: [src/app.ts](./src/app.ts).
- Роут и «оркестрация диалога»: [src/routes/telegramWebhook.ts](./src/routes/telegramWebhook.ts).
- Состояния и payload сессии: [src/types/session.ts](./src/types/session.ts) + [src/repositories/user-session.repository.ts](./src/repositories/user-session.repository.ts).
- Бизнес-логика сценария: `src/services/*`.
- Доступ к БД: `src/repositories/*`.

Если целевая модель такая: бот и код остаются у владельца системы, а пользователи регистрируются в веб-кабинете и сами настраивают услуги, специалистов, цены и сценарии, то следующий практичный шаг: вынести текущий сценарий бронирования в отдельный модуль (например, `src/scenarios/booking/*`), добавить аккаунты/рабочие пространства с изоляцией данных и вынести управление настройками в отдельный HTTP API + веб-интерфейс.

## BPMN (задел)

В проекте есть экспериментальный парсер BPMN: [src/utils/BPMN/BPMN.ts](./src/utils/BPMN/BPMN.ts). Он пока не подключен к боту и требует установки дополнительных зависимостей перед использованием (см. `TODO.md`).

Диапазон выбора дат в боте расширен через пагинацию inline-календаря (вперед/назад) без ограничения только 7 ближайшими днями.

## Production readiness

- [Production readiness checklist (no payment flow, Railway)](./PRODUCTION_READINESS_CHECKLIST.md)
