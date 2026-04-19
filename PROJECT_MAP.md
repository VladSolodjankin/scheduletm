# PROJECT_MAP

## Назначение модулей

- `bot/` — существующее backend-приложение Telegram-бота.
- `server/` — заготовка под API для web-приложения:
  - `server/package.json` — зависимости и скрипты сервера.
  - `server/tsconfig.json` — TypeScript-конфигурация сборки в `dist`.
  - `server/src/` — директория под исходники API.
- `web/` — заготовка под SPA:
  - `web/package.json` — зависимости React/MobX/MUI/Firebase/Axios.
  - `web/tsconfig.json` — TypeScript-конфигурация фронтенда.
  - `web/vite.config.ts` — Vite + React plugin.
  - `web/src/` — директория под исходники UI.

## Root-level orchestration

- `package.json` в корне определяет npm workspaces (`bot`, `server`, `web`).
- Команды `typecheck/build/test` запускаются по всем пакетам через `npm run -ws ...`.
