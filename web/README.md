# Web (`@scheduletm/web`)

React SPA для owner/admin/specialist/client.

## Что умеет

- Settings page UI decomposition: each settings tab is implemented as a separate UI component under `src/components/settings-tabs/` to keep `SettingsCard.tsx` lightweight.
- Locale fields in `Settings -> Account` and `Settings -> User` are dropdowns (`ru-RU`/`en-US`) via reusable `LocaleSelect` component.
- Settings tabs support deeplinks via route segment: `/settings/:tab` (for example `/settings/integrations`, `/settings/password`).
- Auth: `/login`, `/register`, `/invite/accept`, `/verify-email`.
  - `register`: required fields `firstName`, `lastName`, `email`, `phone`, optional `telegramUsername`.
  - `verify-email`: 4-digit OTP with auto-confirm when all digits are entered, auto-focus between inputs, full-code paste support, and resend cooldown timer.
  - after successful email verification on registration, user is redirected to `/login` with a success message.
- Основные разделы: `/appointments`, `/specialists`, `/users`, `/settings`, `/notification-logs`.
- Role-aware UI (owner/admin/specialist/client).
- i18n (`ru/en`), theme mode, palette variants.
- Phone fields with country selector auto-detect default country from browser locale and can still be changed manually.
- `AppRhfPasswordField` is used for real password inputs with native browser autofill hints (`current-password`, `new-password`), while secrets/tokens use dedicated `AppRhfSecretKeyField` with manual show/hide toggle and custom masking in `type="text"` mode.
- Calendar flow: create/edit/reschedule/cancel/mark-paid/notify.
- In appointment dialog, `Meeting provider` and `Meeting link` are placed together; link can be generated directly from the form (`Zoom` via API integration, `Manual` via generated unique URL).
- Appointments page includes role-based top filters:
  - owner: `Account`, `Specialist`, `Client`, `Service`, `Status`, `From/To` dates;
  - admin: `Specialist`, `Client`, `Service`, `Status`, `From/To` dates;
  - specialist: `Client`, `Service`, `Status`, `From/To` dates;
  - client: `Specialist`, `Service`, `Status`, `From/To` dates.
- Appointments page subtitle is role-aware (`All appointments`, `Appointments in your account`, `Appointments with you`, `My appointments`).
- Main menu item for `/appointments` uses the same role-aware labels as the Appointments page subtitle.
- Client flow: клиент работает только со своим расписанием (без доступа к чужим записям).
- Notification logs (`/notification-logs`): таблица истории отправки с фильтрами (`accountId`, `specialistId`, `userId`) и колонками для читаемых данных (`specialistName`, `clientName`, `message`, `recipientTelegram`, `recipientEmail`) + retry action для статусов `failed/retry/cancelled`.

## Команды

```bash
npm run -w @scheduletm/web lint                 # ESLint (best practices + i18n markup rules)
npm run -w @scheduletm/web dev                  # lint + typecheck + vite
npm run -w @scheduletm/web build                # lint + tsc + vite build
npm run -w @scheduletm/web test                 # быстрые e2e contract checks
npm run -w @scheduletm/web test:e2e:contracts   # contract-level checks (node:test)
npm run -w @scheduletm/web test:e2e:ui          # реальный UI e2e (Playwright, клики)
npm run -w @scheduletm/web test:e2e             # contracts + UI
npm run -w @scheduletm/web verify
```


## Линтинг

В `web` подключен ESLint и он запускается автоматически в `dev` и `build`.

Правила включают:
- базовые recommended + TypeScript checks;
- best practices (`curly`, `eqeqeq`, `no-var`, `prefer-const`);
- `i18next/no-literal-string` в режиме `jsx-only` с исключениями для `className`, `data-testid`, `aria-*` атрибутов;
- для test/spec файлов правило `i18next/no-literal-string` отключено;
- строки логирования через `console.*` исключены из этого правила.

## Переменные окружения

- `VITE_API_URL` — базовый URL API (build-time).
- `VITE_MAPBOX_PUBLIC_TOKEN` — публичный токен Mapbox для предпросмотра карты в `Settings -> Account settings`.
- Компонент карты использует npm-пакет `mapbox-gl` (без runtime-подгрузки script/style с CDN).

Пример:

```bash
VITE_API_URL=https://api.example.com
VITE_MAPBOX_PUBLIC_TOKEN=pk.xxxxx
```

Для отдельного dev-домена:

```bash
VITE_API_URL=https://apidev.meetli.cc
```


Для локального UI e2e (`localhost`) используйте локальный API, например:

```bash
VITE_API_URL=http://localhost:3003
VITE_MAPBOX_PUBLIC_TOKEN=pk.xxxxx
```

Если `VITE_MAPBOX_PUBLIC_TOKEN` задан, предпросмотр карты в `Account settings` сначала берет `Business lat/lng`, а если они пустые — пытается использовать текущие координаты браузера (через `navigator.geolocation`, с разрешением пользователя).

Если `VITE_MAPBOX_PUBLIC_TOKEN` не задан, в `Account settings` вместо карты показывается явная подсказка, а кнопка `Open in Mapbox search` продолжает работать по `Business address`.

Если оставить удалённый `VITE_API_URL` (например `https://apidev.meetli.cc`) при локальном запуске, на странице `/login` может появляться `Network connection issue`, и login-шаг UI e2e не пройдет.


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
- проверяют role-aware доступность пунктов меню и видимость табов `System settings`/`Account settings` на странице настроек;
- проверяют доступ к страницам по прямому URL и access denied состояния (owner/admin/client) для `/specialists`, `/notification-logs`, `/error-logs`.
- покрывают публичные auth-экраны: переключение `/login` ↔ `/register`, а также invalid-состояния `/invite/accept` и `/verify-email` без token/email.
- отдельно нужно расширить покрытие **негативных UI-сценариев**: невалидные формы, серверные ошибки, access denied действия, просроченные/некорректные токены, пустые и error состояния страниц.

Структура UI e2e разнесена по файлам: `auth.ui.e2e.spec.mjs`, `users.ui.e2e.spec.mjs`, `navigation.ui.e2e.spec.mjs`, `settings.ui.e2e.spec.mjs`, `session.ui.e2e.spec.mjs`, `access-control.ui.e2e.spec.mjs`; общие auth-хелперы вынесены в `ui/helpers/auth.mjs`.


> Для запуска используется `@playwright/test` (единый раннер/DSL), чтобы избежать конфликтов вида `test.describe() called here` при смешивании разных Playwright пакетов.

### Переменные окружения для UI e2e

- `E2E_BASE_URL` — URL web-приложения (например, `https://dev.meetli.cc` или локальный `http://127.0.0.1:5173`).
- `E2E_API_URL` — URL API для e2e auth-хелпера (по умолчанию: `VITE_API_URL`, затем origin web).
- `E2E_OWNER_EMAIL` / `E2E_OWNER_PASSWORD`
- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`
- `E2E_SPECIALIST_EMAIL` / `E2E_SPECIALIST_PASSWORD`
- `E2E_CLIENT_EMAIL` / `E2E_CLIENT_PASSWORD`

Если часть ролей не задана, соответствующие проверки будут пропущены (skip), чтобы можно было запускать suite постепенно.
Если `E2E_*` креды указывают на пользователя с другой ролью (например, `E2E_ADMIN_*` фактически логинит owner), такие role-specific проверки также будут пропущены с аннотацией в отчете Playwright.

`ui/helpers/auth.mjs` выполняет login через API и кладет auth-сессию в `localStorage`,
поэтому UI e2e меньше зависят от CORS-ограничений браузера на странице `/login`.
Важно, чтобы `E2E_API_URL` (или `VITE_API_URL`) был достижим из окружения, где запускается Playwright.
