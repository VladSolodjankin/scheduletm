# MVP plan: запуск бота без оплаты

Цель: стабильно принимать и обрабатывать записи через Telegram без web-кабинета и онлайн-платежей.

## Уже сделано

- [x] Timezone-модель на IANA + UTC в БД.
- [x] Защита от двойного бронирования слотов (DB constraint).
- [x] Отмена/перенос записи пользователем.
- [x] Базовый сброс сессии (`/start`, `/reset`) и шаг «Назад».
- [x] Контур напоминаний (`notifications`, retry, статусы).

## Что нужно закрыть для go-live

1. **Надежность**
   - [ ] Полная идемпотентность webhook по `update_id`.
   - [ ] Guard на один активный booking-flow для пользователя.
2. **Операционка**
   - [ ] Structured logs + базовые алерты.
   - [ ] Backup/restore процесс для Postgres.
3. **Безопасность**
   - [ ] Rate-limit на webhook.
   - [ ] Маскирование персональных данных в логах.

## Что не блокирует MVP

- BPMN runtime.
- Полноценный web self-service кабинет.
- Реальные email/SMS провайдеры (пока допустим stub).

## См. также

- [`README.md`](./README.md)
- [`PROJECT_MAP.md`](./PROJECT_MAP.md)
- [`TODO.md`](./TODO.md)
- [`PRODUCTION_READINESS_CHECKLIST.md`](./PRODUCTION_READINESS_CHECKLIST.md)
