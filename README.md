# ScheduleTM Monorepo

Репозиторий переведен на монорепо-структуру и теперь разделен на изолированные приложения:

- `bot` — текущий Telegram-бот (legacy и рабочий контур).
- `server` — новый Node.js API слой для web-клиента и интеграций.
- `web` — новый frontend (React + MobX + MUI CSS + Axios).

## Текущая структура

```text
scheduletm/
├─ bot/
├─ server/
└─ web/
```

## Базовый стек

### Web

- React
- MobX
- MUI CSS (`muicss`)
- Axios
- Firebase (SSO)
- Google Calendar API client (`gapi-script`)

### Server

- Node.js + Express
- Google APIs (Calendar)
- Firebase Admin (проверка SSO токенов)
- Axios

## Workspace команды

Из корня:

```bash
npm install
npm run typecheck
npm run build
npm run test
```

## Важно

На данном этапе сделан только bootstrap и конфигурация модулей `web` и `server`.
Бизнес-логика и прикладной код в новые модули пока не добавлялись.

Старый контур `bot` остается доступным и не удаляется до завершения миграции.
