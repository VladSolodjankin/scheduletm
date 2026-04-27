# Bot (`bot`)

Telegram-бот для записи клиентов (webhook + PostgreSQL + Knex).

## Что умеет

- Прием webhook: `POST /telegram/webhook/:secret`.
- State machine сценария записи (service -> specialist -> date/time -> контакты -> confirm).
- Перенос и отмена записи.
- При первом `/start` бот предлагает регистрацию в web-приложении (ссылка из `APP_URL`).
- В процессе записи email клиента обязателен: бот автоматически создаёт/связывает `web_user` (role=`client`) и отправляет invite-link для завершения регистрации.
- Учет timezone через IANA (хранение времени в UTC).
- Напоминания через `notifications` (Telegram/email/SMS, где email/SMS сейчас stub).

## Команды

```bash
npm run -w bot dev
npm run -w bot build
npm run -w bot start
npm run -w bot test
```

## Переменные окружения

Смотри [`./.env.example`](./.env.example).

Основные:

- `BOT_TOKEN`
- `WEBHOOK_SECRET`
- `APP_URL`
- `DATABASE_URL` / `DATABASE_PUBLIC_URL`
- `AUTO_SET_WEBHOOK`

## Документация

- Карта модуля: [`./PROJECT_MAP.md`](./PROJECT_MAP.md)
- Bot roadmap: [`./TODO.md`](./TODO.md)
- Bot production checklist: [`./PRODUCTION_READINESS_CHECKLIST.md`](./PRODUCTION_READINESS_CHECKLIST.md)
- MVP без оплаты: [`./MVP_NO_PAYMENT_PLAN.md`](./MVP_NO_PAYMENT_PLAN.md)
- Глобальный обзор репозитория: [`../README.md`](../README.md)
