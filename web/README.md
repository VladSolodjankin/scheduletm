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
npm run -w @scheduletm/web test
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
