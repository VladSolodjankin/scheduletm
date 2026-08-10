# Product scope and TODO

Канонический product backlog Meetli. Release/operational gates ведутся только в
[`PRODUCTION_READINESS_CHECKLIST.md`](./PRODUCTION_READINESS_CHECKLIST.md), а
Telegram-сервис использует собственный
[`bot/PRODUCTION_READINESS_CHECKLIST.md`](./bot/PRODUCTION_READINESS_CHECKLIST.md).

## Production MVP

Целевой пользователь — самостоятельный специалист или небольшая команда, которой
нужно опубликовать страницу услуг, принимать записи и управлять встречами без
ручного согласования каждого слота.

Основной успешный сценарий:

1. Владелец регистрируется и настраивает аккаунт, услугу, специалиста и расписание.
2. Владелец публикует Public Page.
3. Клиент выбирает услугу, специалиста и свободное время.
4. Клиент и специалист получают подтверждение и напоминания.
5. Клиент может безопасно посмотреть, отменить или перенести запись.

Встроенная оплата клиентом не блокирует первый production MVP. До отдельного
продуктового решения Meetli не должен показывать незавершённый payment flow.

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

- [ ] Закрыть все обязательные пункты канонического
  [`PRODUCTION_READINESS_CHECKLIST.md`](./PRODUCTION_READINESS_CHECKLIST.md).

## P0 — законченный бизнес-сценарий

- [ ] Проверить реализацию административного lifecycle услуг по
  [`docs/services-setup.md`](./docs/services-setup.md): create/edit/activate,
  назначения специалистам, price/duration overrides и обязательные edge cases.
- [ ] Добавить исключения расписания: выходной или отпуск на конкретную дату,
  разовые недоступные интервалы и перерывы без изменения регулярного графика.
- [ ] Добавить безопасную клиентскую ссылку для просмотра, отмены и переноса записи
  с применением cancellation policy и повторной отправкой подтверждения.
- [ ] Подтвердить реальную доставку минимального набора сообщений: новая запись,
  изменение, отмена, напоминание и ссылка/адрес встречи — клиенту и специалисту.
  Для MVP достаточно production email и Telegram; SMS/WhatsApp/Viber не обязательны.
- [ ] Добавить короткий onboarding владельца: account/timezone → specialist →
  schedule → service → meeting method → publish → test booking.
- [ ] Опубликовать Terms of Service рядом с Privacy Policy и Security Policy;
  согласовать support/legal contact и acceptance в registration/invite flows.

## P1 — коммерчески цельный MVP

- [ ] Добавить минимальные account-owned media: logo, specialist avatar и одна
  cover/hero image с безопасной заменой и удалением.
- [ ] Добавить простой owner dashboard: встречи сегодня/на неделю, новые клиенты,
  отмены/no-show, ближайшие встречи и загрузка специалистов.
- [ ] Зафиксировать коммерческую модель Meetli: trial, тариф, лимиты, состояния
  `active`/`past_due`/`suspended` и ручной или автоматический billing.
- [ ] Определить минимальный support flow: контакт из приложения, correlation/request
  id для обращения и доступная владельцу история критичных ошибок доставки.

## Проверка продукта

- [ ] Complete the canonical browser E2E backlog in
  [`web/tests/e2e/TODO.md`](./web/tests/e2e/TODO.md). Iteration 1 is additive
  admin coverage; multi-role and negative coverage remain iteration 2.

## Отложенный product backlog

- [ ] Online payment/deposit provider — только после отдельного продуктового решения.
- [ ] SMS, WhatsApp и Viber providers.
- [ ] Дополнительные meeting/calendar providers.
- [ ] Управление всей recurrence-серией, исключения серий и monthly rules.
- [ ] Старые-slug redirects и временное резервирование slug.
- [ ] Public Page analytics и conversions.
- [ ] Custom domains.
- [ ] Тарифная/конфигурируемая квота вместо фиксированного лимита страниц.
- [ ] Scheduled publish, A/B testing, saved themes и безопасные add-ons.

## Связанные документы

- Public Page Builder: [`docs/public-page-builder/README.md`](./docs/public-page-builder/README.md)
- Детальный Public Pages backlog: [`docs/public-page-builder/TODO.md`](./docs/public-page-builder/TODO.md)
- Каталог услуг: [`docs/services-setup.md`](./docs/services-setup.md)
- Meeting providers: [`docs/meeting-platforms-zoom-plan.md`](./docs/meeting-platforms-zoom-plan.md)
- Production checklist: [`PRODUCTION_READINESS_CHECKLIST.md`](./PRODUCTION_READINESS_CHECKLIST.md)
