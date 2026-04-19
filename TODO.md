# TODO

## Этап 1 — Bootstrap (выполнено)

- [x] Добавить `server/` как отдельный workspace.
- [x] Добавить `web/` как отдельный workspace.
- [x] Добавить root `package.json` с npm workspaces.
- [x] Подключить базовые зависимости для React/MobX/MUI/Axios/Firebase/Google API.
- [x] Подключить базовые зависимости для Node API (Express/Google APIs/Firebase Admin).

## Этап 2 — Минимальный каркас API

- [ ] Добавить `server/src/index.ts` с health endpoint и базовым bootstrap Express.
- [ ] Добавить env-конфиг для server (`.env.example` + валидация).
- [ ] Определить API-модули: auth, calendar, scheduling.

## Этап 3 — Минимальный каркас Web

- [ ] Добавить entrypoint для React приложения.
- [ ] Добавить базовые слои: `app`, `shared`, `entities`, `features`, `pages`.
- [ ] Добавить инициализацию MobX store и Axios client.
- [ ] Добавить SSO flow через Firebase.
- [ ] Добавить интеграционный слой для Google Calendar.

## Этап 4 — Миграция

- [ ] Зафиксировать план постепенного переноса функциональности из `bot` в `server/web`.
- [ ] Определить дедлайн, после которого `bot` будет переведен в maintenance-only режим.
