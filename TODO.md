# TODO

## Этап 1 — Bootstrap (выполнено)

- [x] Добавить `server/` как отдельный workspace.
- [x] Добавить `web/` как отдельный workspace.
- [x] Добавить root `package.json` с npm workspaces.

## Этап 2 — API MVP (выполнено)

- [x] Реализовать auth endpoints (register/login/refresh).
- [x] Реализовать settings API (get/save).
- [x] Реализовать google connect API endpoint.
- [x] Разнести сервер по слоям (`routes/services/middlewares/config`).

## Этап 3 — Web MVP (выполнено)

- [x] Разбить UI на `components/containers/pages`.
- [x] Добавить роутинг (`react-router-dom`).
- [x] Перейти на MUI (`@mui/material`) и убрать кастомный CSS на старте.
- [x] Добавить страницы login/register/settings.

## Этап 4 — Следующий шаг

- [ ] Перенести in-memory storage в БД.
- [ ] Добавить полноценный Google OAuth 2.0 flow.
- [ ] Добавить logout endpoint и отзыв refresh-сессий на backend.
- [ ] Добавить CSRF protection для refresh cookie flow.
- [ ] Добавить интеграционные и e2e тесты.
