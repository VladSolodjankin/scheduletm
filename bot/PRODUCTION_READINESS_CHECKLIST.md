# Production readiness checklist (`bot`)

Чеклист вывода Telegram-бота в production (без онлайн-оплаты).

## Webhook и state machine

- [ ] Идемпотентность по `update_id` (без повторного бизнес-эффекта).
- [ ] Защита от гонок callback/query для одного пользователя.
- [ ] Recovery состояния после рестартов (session restore + TTL).

## Наблюдаемость

- [ ] Structured logs: `request_id`, `update_id`, `account_id`, `user_id`.
- [ ] Метрики latency/error/notification-failed.
- [ ] Алерты: 5xx, нет входящих updates, рост failed уведомлений.

## Безопасность

- [ ] Надежный `WEBHOOK_SECRET` + ротация.
- [ ] Rate-limit и anti-spam на webhook.
- [ ] Маскирование PII (phone/email) в логах.

## База данных

- [ ] Регламент миграций (forward-only + rollback-plan).
- [ ] Индексы для `appointments`, `notifications`, `telegram_user_sessions`.
- [ ] Backup + регулярный test restore.

## Тестирование

- [ ] E2E smoke: happy path, duplicate update, race on slot, cancel/reschedule.
- [ ] CI: `typecheck`, `test`, миграции на чистой БД.

## Railway

- [ ] Проверить `APP_URL`, `, `WEBHOOK_SECRET`, `DATABASE_URL`.
- [ ] Post-deploy smoke: `/health` + `getWebhookInfo`.
- [ ] Разнести `app` и `worker` при росте нагрузки.
