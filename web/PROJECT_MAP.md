# PROJECT_MAP: `web/`

## Назначение

`web/` — React SPA для управления расписанием, пользователями, специалистами и настройками.

## Структура

- `src/app/` — bootstrap приложения, роутинг, провайдеры.
- `src/pages/` — страницы (`/login`, `/register`, `/appointments`, `/specialists`, `/users`, `/settings`).
- `src/containers/` — контейнеры с загрузкой данных и orchestration UI.
- `src/components/` — презентационные компоненты и layout.
- `src/shared/` — api-client, i18n, theme, ui-kit, типы, utils.
- `tests/` — smoke/e2e проверки.

## Ключевые потоки

1. **Auth flow**: login/register -> auth-state -> защищенные страницы.
2. **Appointments flow**: list/create/edit/reschedule/cancel/mark-paid/notify.
3. **Settings flow**: user/system settings + integrations status.
4. **Role-aware UI**: owner/admin/specialist видят разный набор действий.

## Зависимости от backend

Основной API-контракт обслуживает `server/`:

- `/api/auth/*`
- `/api/settings/*`
- `/api/specialists/*`
- `/api/users/*`
- `/api/appointments/*`
- `/api/integrations/google/oauth/*`

## Документация модуля

- [`README.md`](./README.md)
