# Web (`@scheduletm/web`)

React SPA для owner/admin/specialist/client.

## Что умеет

- Auth: `/login`, `/register`, `/invite/accept`, `/verify-email`.
- Основные разделы: `/appointments`, `/specialists`, `/users`, `/settings`, `/notification-logs`.
- Role-aware UI (owner/admin/specialist/client).
- i18n (`ru/en`), theme mode, palette variants.
- Calendar flow: create/edit/reschedule/cancel/mark-paid/notify.
- Client flow: клиент работает только со своим расписанием (без доступа к чужим записям).
- Notification logs (`/notification-logs`): таблица истории отправки с фильтрами (`accountId`, `specialistId`, `userId`) и колонками для читаемых данных (`specialistName`, `clientName`, `message`, `recipientTelegram`, `recipientEmail`) + retry action для статусов `failed/retry/cancelled`.

## Команды

```bash
npm run -w @scheduletm/web dev
npm run -w @scheduletm/web build
npm run -w @scheduletm/web test                 # быстрые e2e contract checks
npm run -w @scheduletm/web test:e2e:contracts   # contract-level checks (node:test)
npm run -w @scheduletm/web test:e2e:ui          # реальный UI e2e (Playwright, клики)
npm run -w @scheduletm/web test:e2e             # contracts + UI
npm run -w @scheduletm/web verify
```

## Переменные окружения

- `VITE_API_URL` — базовый URL API (build-time).

Пример:

```bash
VITE_API_URL=https://api.example.com
```

Для отдельного dev-домена:

```bash
VITE_API_URL=https://apidev.meetli.cc
```

## Документация

- Глобальный обзор: [`../README.md`](../README.md)
- Карта модуля: [`./PROJECT_MAP.md`](./PROJECT_MAP.md)


### Invite verify-email flow

Страница `/verify-email` поддерживает onboarding по приглашению:
- проверка токена приглашения (loading/invalid states);
- отображение email приглашения (readonly);
- создание аккаунта с полями: имя, фамилия, пароль, повтор пароля, Telegram;
- inline-ошибки (слабый пароль/несовпадение паролей) и fallback серверной ошибки;
- запрос нового приглашения для истекших ссылок.


## Покрытие e2e contract-тестами (быстрый слой)

`web/tests/e2e/*.test.mjs` проверяют web-контракты без браузерного раннера:
- жизненный цикл appointments: create/edit/cancel/reschedule;
- late-cancel UX по specialist booking policy (grace period + refund/no-refund тексты подтверждения/предупреждения);
- users CRUD: create/edit/delete;
- role-aware ограничения для owner/admin/specialist/client на уровне web-контейнеров и меню.


## UI e2e (Playwright) для dev-стенда

Тесты в `web/tests/e2e/ui/*.spec.mjs` — это **настоящие end-to-end UI-тесты**:
- открывают браузерный контекст;
- делают реальные клики/ввод в интерфейсе;
- проверяют поведение web-приложения при интеграции с backend/dev БД;
- покрывают owner-flow для `Users` (create/edit/deactivate), переход owner в `/error-logs`, logout из profile menu;
- проверяют role-aware доступность пунктов меню и доступность табов `System settings`/`Account settings` на странице настроек;
- проверяют доступ к страницам по прямому URL и access denied состояния (owner/admin/client) для `/specialists`, `/notification-logs`, `/error-logs`.

Структура UI e2e разнесена по файлам: `users.ui.e2e.spec.mjs`, `navigation.ui.e2e.spec.mjs`, `settings.ui.e2e.spec.mjs`, `session.ui.e2e.spec.mjs`, `access-control.ui.e2e.spec.mjs`; общие auth-хелперы вынесены в `ui/helpers/auth.mjs`.


> Для запуска используется `@playwright/test` (единый раннер/DSL), чтобы избежать конфликтов вида `test.describe() called here` при смешивании разных Playwright пакетов.

### Переменные окружения для UI e2e

- `E2E_BASE_URL` — URL web-приложения (например, `https://dev.meetli.cc` или локальный `http://127.0.0.1:5173`).
- `E2E_OWNER_EMAIL` / `E2E_OWNER_PASSWORD`
- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`
- `E2E_SPECIALIST_EMAIL` / `E2E_SPECIALIST_PASSWORD`
- `E2E_CLIENT_EMAIL` / `E2E_CLIENT_PASSWORD`

Если часть ролей не задана, соответствующие проверки будут пропущены (skip), чтобы можно было запускать suite постепенно.
