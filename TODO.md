# TODO

Актуальный backlog для `web` и `server`. `bot` и инфраструктура Railway не входят в текущий этап.

## Реализовано

- [x] Tenant RBAC: `owner` управляет только своим пространством, `admin` является делегированным администратором аккаунта.
- [x] Глобальная роль `product_owner` с доступом ко всем аккаунтам; роль нельзя назначить через обычный Users API/UI.
- [x] Регистрация создаёт владельца пространства с ролью `owner`.
- [x] Создание, редактирование, деактивация, удаление пользователей и повторная отправка invite.
- [x] Корректное сохранение и предзаполнение `first_name`/`last_name` в registration/invite flow.
- [x] Locale и timezone редактируются только в User settings.
- [x] Client notification settings доступны самому клиенту без произвольного `clientId`.
- [x] Public Page Builder использует server API, draft/publish snapshots, optimistic concurrency и глобально уникальный slug.
- [x] Текущий slug опубликованной Public Page является каноническим публичным идентификатором; отдельный account slug не создаётся.
- [x] Публичное бронирование по slug с выбором специалиста и услуги, query preselection и автоматическим выбором единственного варианта.
- [x] Browser timezone передаётся автоматически; backend применяет timezone специалиста как fallback.
- [x] Публичное бронирование проверяет рабочие дни/часы, шаг слота, прошедшее время, внешний календарь и DB overlap.
- [x] Публичный статус встречи защищён фамилией специалиста, rate limit и одинаковым `404`; персональные данные клиента не возвращаются.
- [x] Простая recurrence `daily`/`weekly`, 2–52 встречи, атомарное создание через `appointment_groups`.
- [x] `defaultMeetingLink` специалиста и приоритет explicit link → Zoom → default link → offline address.
- [x] Appointment audit поддерживает actor context, action/actor/date filters и bounded event limit.
- [x] Appointment audit events хранятся 365 дней и автоматически очищаются раз в сутки.
- [x] Notification retry/backoff, idempotency, token-fenced lease и heartbeat.
- [x] `/health` liveness, `/ready` database readiness, graceful shutdown и безопасные JSON error responses.
- [x] Простые server unit/smoke тесты и runtime unit-тесты Public Page normalize/migrate/undo-redo.

## Перед выпуском текущих изменений

- [ ] Применить новые forward-only migrations на целевой PostgreSQL через `npm run -w @scheduletm/server migrate:latest`.
- [ ] Проверить migrations и Public Page repository на чистой/тестовой PostgreSQL.
- [ ] Выполнить локальный или staging runtime smoke: auth, RBAC, users, settings, appointments, public publish, booking и status.
- [ ] Выполнить финальные `server`/`web` typecheck, tests и production builds.
- [ ] Устранить или документировать оставшиеся production dependency advisories после совместимого обновления lock-файла.

## Следующий этап

- [ ] Complete the canonical browser E2E backlog in
  [`web/tests/e2e/TODO.md`](./web/tests/e2e/TODO.md). Iteration 1 is additive
  admin coverage; multi-role and negative coverage remain iteration 2.
- [ ] Media upload/storage pipeline для Public Pages.
- [ ] Дополнительные meeting/calendar providers — только после отдельного продуктового выбора.
- [ ] Управление всей recurrence-серией, исключения и monthly rules.

## Отложенный product backlog

- [ ] Старые-slug redirects и временное резервирование slug.
- [ ] Public Page analytics и conversions.
- [ ] Custom domains.
- [ ] Тарифная/конфигурируемая квота вместо фиксированного лимита страниц.
- [ ] Scheduled publish, A/B testing, saved themes и безопасные add-ons.

## Связанные документы

- Public Page Builder: [`docs/public-page-builder/README.md`](./docs/public-page-builder/README.md)
- Детальный Public Pages backlog: [`docs/public-page-builder/TODO.md`](./docs/public-page-builder/TODO.md)
- Production checklist: [`PRODUCTION_READINESS_CHECKLIST.md`](./PRODUCTION_READINESS_CHECKLIST.md)
