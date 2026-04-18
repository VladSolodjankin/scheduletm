# scheduletm

Telegram-бот для записи на услуги (сейчас: сценарий записи к психологу) через webhook. Приложение поднимает HTTP-сервер на Express, принимает обновления Telegram, ведет диалог как state machine и сохраняет данные в PostgreSQL через Knex.

## Стек

- Node.js (таргет сборки: Node 20)
- TypeScript
- Express (HTTP сервер)
- Vite (SSR build для упаковки `src/app.ts` в `dist/app.js`)
- PostgreSQL + Knex (миграции/сидирование)
- Telegram Bot API через `axios`

## Эндпоинты

- `GET /health` -> `{ ok: true }`
- `POST /telegram/webhook/:secret` -> обработка Telegram updates (секрет сравнивается с `WEBHOOK_SECRET`)

## Переменные окружения

Обязательные для приложения:

- `BOT_TOKEN` - токен Telegram бота
- `WEBHOOK_SECRET` - секрет в URL вебхука (должен быть длинным и непредсказуемым)
- `APP_URL` - публичный базовый URL приложения (используется для `setWebhook`)
- `PORT` - порт (опционально, по умолчанию `3000`)

Обязательные для базы (Knex):

- `DATABASE_PUBLIC_URL` - строка подключения к Postgres для `development`
- `DATABASE_URL` - строка подключения к Postgres для `production`

Пример `.env`:

```bash
PORT=3000
APP_URL=https://example.com
WEBHOOK_SECRET=change_me_to_a_long_random_value
BOT_TOKEN=123456:telegram-bot-token

DATABASE_PUBLIC_URL=postgres://user:pass@localhost:5432/scheduletm
DATABASE_URL=postgres://user:pass@localhost:5432/scheduletm
```

## Быстрый старт (локально)

1. Установить зависимости:

```bash
npm install
```

2. Применить миграции и наполнить базу сидом (создает базовые услуги/специалиста/настройки):

```bash
npm run migrate:latest
npm run seed:run
```

3. Собрать и запустить:

```bash
npm run build
npm run start
```

На старте приложение вызывает `setWebhook()` и печатает `getWebhookInfo()` в лог.

## Режим разработки

Сейчас `npm run dev` делает только `vite build --watch` (пересобирает `dist/app.js` при изменениях). Для удобной разработки обычно запускают в двух терминалах:

```bash
# терминал 1
npm run dev

# терминал 2
npm run start
```

Важно: webhook Telegram должен указывать на публичный HTTPS URL. Для локальной разработки обычно используют туннелирование (ngrok и аналоги) и подставляют его в `APP_URL`.

## Скрипты

- `npm run build` - сборка в `dist/`
- `npm run dev` - сборка в watch-режиме
- `npm run start` - запуск `node dist/app.js`
- `npm run migrate:latest` / `migrate:rollback` / `migrate:make` - миграции Knex
- `npm run seed:run` / `seed:make` - сиды Knex

## Примечания

- Слоты времени сейчас рассчитываются в логике приложения с фиксированными границами 09:00-20:00 и временем Москвы (UTC+3). Таблица `app_settings` уже существует и может стать источником этих настроек.
- Если русские строки в интерфейсе бота отображаются некорректно, проверьте, что файлы в `src/i18n` и `src/bot` сохранены в UTF-8.

