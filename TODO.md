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

## Этап 4 — Ближайший план web/server

### 4.1 Data layer

- [ ] Перенести in-memory storage в БД (минимум users/sessions/settings).
- [ ] Добавить миграции и seed для локальной разработки.
- [x] Развести identity-модели: `users` (Telegram), `web_users` (web-auth), `user_identity_links` (1:1 связь в рамках account).

### 4.2 Appointments (MVP)

- [ ] Добавить сущность `appointment` в server + CRUD/list API.
- [ ] Добавить поля `status`, `paymentStatus`, `scheduledAt`, `meetingLink`, `notes`.
- [ ] Реализовать операции: подтверждение оплаты, отмена, перенос даты, ручное уведомление.
- [ ] Добавить в web страницу списка и карточку редактирования appointment.

### 4.3 Meeting link strategy

- [ ] Добавить `defaultMeetingLink` в профиль пользователя/специалиста.
- [ ] При создании appointment копировать `defaultMeetingLink` в `appointment.meetingLink`.
- [ ] Разрешить ручное переопределение `meetingLink` для конкретной записи.

### 4.4 Security & auth hardening

- [ ] Добавить logout endpoint и отзыв refresh-сессий на backend.
- [ ] Добавить CSRF protection для refresh cookie flow.
- [ ] Добавить полноценный Google OAuth 2.0 flow.

### 4.5 Web UX & quality

- [x] Добавить поддержку разных языков (i18n, переводы по страницам).
- [ ] Добавить интеграционные тесты (server) и e2e smoke (web).

### 4.6 UI foundation (выполнено)

- [x] Добавить базовые wrapper-компоненты над MUI (`buttons/tabs/forms/inputs/page`).
- [x] Добавить базовый layout (`MainLayout`, `Header`, `LeftMenu`).
- [x] Добавить основу темизации (`light/dark`) и набор мягких palette-вариантов.
- [x] Вынести базовые UI-константы (цвета, размеры, радиусы, spacing).
