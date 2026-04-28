# TODO (global)

Глобальный roadmap только для кросс-модульных задач.

## Приоритет P0

- [ ] Настроить единый CI pipeline для monorepo: install, lint/typecheck, test, build.
- [ ] Добавить интеграционные web↔server тесты (без API моков) в отдельный CI job.
- [x] Добавить базовый integration-набор ключевой бизнес-логики в `server/tests/business.integration.test.ts` (DB-backed, без моков доменных сервисов).
- [ ] Зафиксировать политику миграций и backup/restore для production БД.

### P0 — Next для автотестов web (UI e2e + интеграция с dev БД)

- [ ] Подготовить выделенный e2e-account seed для dev БД (owner/admin/specialist/client) и reset-скрипт тестовых данных между прогонами.
- [ ] Подключить запуск `web test:e2e:ui` в CI на nightly/scheduled pipeline c `E2E_BASE_URL` и роль-специфичными `E2E_*` credentials.
- [ ] Добавить UI e2e: appointments lifecycle для owner/admin/specialist/client (create/edit/reschedule/cancel).
- [ ] Добавить UI e2e: поздняя отмена appointment с проверкой grace period + refund/no-refund текстов подтверждения.
- [ ] Добавить UI e2e: users management (create/edit/deactivate + resend invite).
- [ ] Добавить UI e2e: role permissions matrix (Owner/Admin/Specialist/Client) по доступу к меню, страницам и критичным действиям.

## Приоритет P1

- [x] Закрыть CSRF protection в refresh-cookie потоке (`server`).
- [x] Добавить error tracking для `web` и `server`.
- [ ] Довести audit/events для appointments (фильтрация, retention, actor context).

### P1 — Новые задачи продукта (из заметок Vladislav, 2026-04-27 — 2026-04-28)

- [ ] Интеграции встреч: добавить Google/Outlook/iCal календари, Zoom, Телемост и другие meeting providers.
- [ ] Регистрация: улучшить страницу регистрации и добавить дополнительные поля профиля.
- [ ] OTP flow: отправлять 4-значный код подтверждения; после полного ввода OTP автоматически запускать `confirm` и валидацию токена.
- [ ] RBAC/UI cleanup: для ролей без доступа полностью скрывать недоступные секции (не `disable`), в том числе `System settings` для `admin`; провести аудит остальных экранов.
- [ ] Настройки локали/таймзоны: убрать дублирование между `Account settings` и `User settings`, оставить только в `User settings`.
- [ ] Owner user management: дать owner возможность создавать пользователей в других `account_id`; добавить dropdown `account_id — account_name — company_name`.
- [ ] Users list: починить удаление пользователя по иконке delete (запись должна исчезать из списка и в БД).
- [ ] Verify email/create account: корректно подтягивать и предзаполнять `first_name`/`last_name`; не подставлять Telegram/email в неверные поля.
- [ ] User settings: убрать поле `telegram bot token`, заменить на `telegram username`.
- [ ] Client notifications: добавить отдельную страницу настроек уведомлений для клиента (вкл/выкл и каналы доставки).
- [ ] Public appointment status: добавить страницу проверки статуса appointment для незарегистрированного пользователя по `appointment_id + specialist_last_name`.
- [ ] Public booking by account slug: добавить страницу создания appointment без регистрации по ссылке вида `/[account_company_id]/login`.
- [ ] Account slug management: добавить для admin/owner настройку `account_company_name` и уникального `account_company_id`; по умолчанию генерировать доступный slug.
- [ ] Appointments recurrence: добавить `frequency` при создании appointment.
- [ ] Account settings (admin): добавить поле имени компании.
- [ ] Вынести настройку публичного URL/slug страницы в отдельный setup окружения.

### P1 — Next для стабилизации тестов

- [ ] Устранить flaky-risk в UI e2e: фиксировать timezone/locale, добавить deterministic test data naming и cleanup hooks.
- [ ] Добавить smoke-набор для notification logs и error logs с role-aware проверками видимости страниц.
- [ ] Добавить негативные UI e2e сценарии: 401/403, network-failure fallback, validation errors в ключевых формах.

## Приоритет P2

- [ ] Доработать meeting link strategy (`defaultMeetingLink` + per-appointment override).
- [ ] Добавить retry/backoff policy для внешних API и идемпотентность уведомлений.

## Модульные roadmap

- Bot: [`bot/TODO.md`](./bot/TODO.md)
- Web/Server детали: см. [`web/PROJECT_MAP.md`](./web/PROJECT_MAP.md) и [`server/PROJECT_MAP.md`](./server/PROJECT_MAP.md)
