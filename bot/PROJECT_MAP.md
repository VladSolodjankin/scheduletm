# PROJECT_MAP: `bot/`

## Назначение

`bot/` — Telegram webhook backend для записи клиентов на услуги.

## Структура

- `src/app.ts` — bootstrap Express + health + webhook + optional setWebhook.
- `src/routes/telegramWebhook.ts` — оркестрация state machine.
- `src/services/` — бизнес-логика booking/slots/appointments/notifications.
- `src/repositories/` — доступ к Postgres.
- `src/bot/` — Telegram API client + keyboards.
- `src/i18n/` — словари и helper переводов.
- `src/jobs/` — reminder/alerts background jobs.
- `src/db/` — knex config, migrations, seeds.

## Основные потоки

1. Получение Telegram update через `POST /telegram/webhook/:secret`.
   Аккаунт определяется в `services/bot-access.service.ts`: `/start <slug>` -> `telegram_account_bindings`.
2. Чтение/обновление сессии пользователя в `telegram_user_sessions`.
3. Подбор слотов и создание/обновление `appointments`.
4. Планирование и отправка `notifications`.

## Важные сущности БД

- `clients`
- `services`
- `specialists`
- `appointments`
- `appointment_groups`
- `telegram_user_sessions`
- `notifications`
- `app_settings`
- `account_settings` (`bot_slug`, `telegram_bot_enabled`, `bot_welcome_message`)
- `telegram_account_bindings`

## Интеграции

- Telegram Bot API (webhook + send/edit message).
- Google Calendar (busy slots + синхронизация событий).

## Документация модуля

- [`README.md`](./README.md)
- [`TODO.md`](./TODO.md)
- [`PRODUCTION_READINESS_CHECKLIST.md`](./PRODUCTION_READINESS_CHECKLIST.md)
