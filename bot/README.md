# Bot (`bot`)

Telegram-бот для записи клиентов (webhook + PostgreSQL + Knex).

## Что умеет

- Прием webhook: `POST /telegram/webhook/:secret`.
- Один общий бот для всех аккаунтов: вход только по ссылке `t.me/<bot>?start=<bot_slug>`.
  `/start <slug>` привязывает `telegram_id` к аккаунту (`telegram_account_bindings`) и создаёт клиента в нём;
  дальнейшие сообщения идут в привязанный аккаунт. Без привязки или с неизвестным slug бот отвечает
  подсказкой со ссылкой на сайт (`APP_URL`) и ничего не создаёт.
- Настройки аккаунта (страница «Telegram-бот» в вебе): `bot_slug`, `telegram_bot_enabled`, `bot_welcome_message`.
  Выключенный бот не принимает новые записи, но существующие записи, напоминания, перенос и отмена работают.
  Своё приветствие заменяет стандартное; если оно пустое, используется локализованный текст.
- State machine сценария записи (service -> specialist -> date/time -> контакты -> confirm).
- Перенос и отмена записи.
- Поздняя отмена: перед подтверждением бот показывает итог по возврату (refund/no-refund) по политике специалиста.
- При первом `/start` бот предлагает регистрацию в web-приложении (ссылка из `APP_URL`).
- В процессе записи email клиента обязателен: бот автоматически создаёт/связывает `web_user` (role=`client`) и отправляет invite-link для завершения регистрации.
- Учет timezone через IANA (хранение времени в UTC).
- Напоминания через `notifications` (Telegram/email/SMS, где email/SMS сейчас stub).
- Webhook использует reclaimable DB lease по `update_id` и отдельный per-user lease:
  дубли не повторяют side effects, а параллельный flow получает retryable response.

## Команды

```bash
npm run -w bot dev
npm run -w bot build
npm run -w bot start
npm run -w bot test
npm run -w bot verify
```

## Переменные окружения

Смотри [`./.env.example`](./.env.example).

Основные:

- `WEBHOOK_SECRET`
- `APP_URL`
- `DATABASE_URL` / `DATABASE_PUBLIC_URL`
- `TELEGRAM_BOT_TOKEN` (токен общего бота из BotFather; shared-переменная вместе с server)

## Документация

- Карта модуля: [`./PROJECT_MAP.md`](./PROJECT_MAP.md)
- Bot roadmap: [`./TODO.md`](./TODO.md)
- Bot production checklist: [`./PRODUCTION_READINESS_CHECKLIST.md`](./PRODUCTION_READINESS_CHECKLIST.md)
- Общий Production MVP и product backlog: [`../TODO.md`](../TODO.md)
- Глобальный обзор репозитория: [`../README.md`](../README.md)
