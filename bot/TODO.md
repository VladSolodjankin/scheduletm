# TODO / Roadmap (`bot`)

## P0 — Надежность webhook и сценария

- [ ] Завершить идемпотентность обработки по `update_id` на всех ветках сценария.
- [ ] Добавить lock «один активный booking flow на пользователя».
- [ ] Добавить TTL/cleanup устаревших `telegram_user_sessions`.

## P1 — Уведомления и операционка

- [ ] Подключить реальные email/SMS провайдеры вместо stub.
- [ ] Зафиксировать retry/DLQ политику для `notifications`.
- [ ] Добавить nightly проверку консистентности очереди уведомлений.

## P1 — Расписание

- [ ] Вынести шаг слотов (`SLOT_STEP_MIN`) в `app_settings`.
- [ ] Добавить исключения расписания (праздники, перерывы, окна специалиста).

## P2 — Архитектурное развитие

- [ ] Вынести booking flow в `src/scenarios/booking/*`.
- [ ] Добавить dispatcher для нескольких сценариев.
- [ ] Подготовить BPMN runtime-интеграцию (без включения в основной flow до стабилизации).

## Связанные документы

- [`README.md`](./README.md)
- [`PROJECT_MAP.md`](./PROJECT_MAP.md)
- [`PRODUCTION_READINESS_CHECKLIST.md`](./PRODUCTION_READINESS_CHECKLIST.md)
- [`MVP_NO_PAYMENT_PLAN.md`](./MVP_NO_PAYMENT_PLAN.md)
