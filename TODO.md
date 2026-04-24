# TODO

## Этап 1 — Bootstrap (выполнено)

- [x] Добавить `server/` как отдельный workspace.
- [x] Добавить `web/` как отдельный workspace.
- [x] Добавить root `package.json` с npm workspaces.

## Этап 2 — API MVP (выполнено)

- [x] Реализовать auth endpoints (register/login/refresh).
- [x] Реализовать settings API (system/user get/save).
- [x] Реализовать google connect API endpoint.
- [x] Разнести сервер по слоям (`routes/services/middlewares/config`).

## Этап 3 — Web MVP (выполнено)

- [x] Разбить UI на `components/containers/pages`.
- [x] Добавить роутинг (`react-router-dom`).
- [x] Перейти на MUI (`@mui/material`) и убрать кастомный CSS на старте.
- [x] Добавить страницы login/register/settings.

## Этап 4 — Ближайший план web/server

### 4.0 Текущий приоритет (этот шаг)

- [x] Сделать Appointments MVP Slice end-to-end: `list + create + edit` (server + web).
- [x] Ограничить первую версию полями: `scheduledAt`, `status`, `meetingLink`, `notes`.
- [x] Добавить только два action endpoint: `cancel`, `reschedule`.
- [x] Добавить 3 route-smoke-сценария server (mocked service layer): create, reschedule, cancel.
- [x] Добавить drag&drop перенос записи в календаре (web).
- [x] Доработать календарный UI до full time-grid вида (уровень Teams-like).

### 4.1 Data layer

- [x] Перенести in-memory storage в БД (включая login attempts, oauth state и settings).
- [x] Перенести web auth-сессии в БД (`web_user_sessions`, access + refresh токены).
- [ ] Добавить миграции и seed для локальной разработки.
- [x] Развести identity-модели: `users` (Telegram), `web_users` (web-auth), `user_identity_links` (1:1 связь в рамках account).
- [x] Сохранять Google OAuth ключ web-пользователя в `web_user_integrations.google_api_key` после успешного callback.
- [x] Добавить связь `specialists <-> web_users` через `specialists.user_id` для персонального календаря специалиста.
- [x] Добавить ролевую модель web-auth (`owner`/`admin`/`specialist`) и авто-создание default specialist для owner при регистрации.
- [x] Добавить endpoint для owner/admin: создание пользователя роли `specialist` и связанного `specialists` профиля.

### 4.2 Appointments (MVP)

- [x] Добавить сущность `appointment` в server + CRUD/list API.
- [x] Добавить поля `status`, `paymentStatus`, `scheduledAt`, `meetingLink`, `notes`.
- [x] Реализовать операции: подтверждение оплаты, отмена, перенос даты, ручное уведомление. *(cancel/reschedule/mark-paid/notify реализованы)*
- [x] Добавить в web страницу списка и карточку редактирования appointment.
- [x] Добавить выбор клиента в create/edit appointment + автопредзаполнение контактных полей.
- [x] Добавить server-валидацию создания appointment (`appointmentAt`, `appointmentEndAt`, `firstName`, `lastName`, `username|phone|email`).
- [x] При создании appointment автоматически создавать нового клиента, если не выбран существующий.

### 4.3 Meeting link strategy

- [ ] Добавить `defaultMeetingLink` в профиль пользователя/специалиста.
- [ ] При создании appointment копировать `defaultMeetingLink` в `appointment.meetingLink`.
- [ ] Разрешить ручное переопределение `meetingLink` для конкретной записи.

### 4.4 Security & auth hardening

- [x] Добавить logout endpoint и удаление текущей web-сессии из БД на backend.
- [ ] Добавить CSRF protection для refresh cookie flow.
- [x] Добавить полноценный Google OAuth 2.0 flow (web button -> backend start -> google callback).
- [x] Добавить Telegram BOT_TOKEN в user settings с сохранением в `web_users` и password-отображением в web.

### 4.5 Web UX & quality

- [x] Добавить поддержку разных языков (i18n, переводы по страницам).
- [x] Для неавторизованных пользователей показывать только `/login` и `/register` без меню/настроек; после регистрации делать redirect на `/login`.
- [x] Добавить в header профиль авторизованного пользователя (avatar/инициалы + dropdown с settings/logout) и mobile-friendly компоновку шапки.
- [x] Добавить route-smoke тесты (server, mocked service layer) и web smoke-проверки.
- [x] Перевести web-формы (auth/settings) на `react-hook-form` для централизованного контроля полей.
- [x] На `401 Unauthorized` в web-клиенте автоматически делать logout и redirect на `/login`.
- [x] Добавить preloader первой загрузки на странице appointments, чтобы исключить пустой экран до получения данных.
- [x] Исправить критический баг создания appointment: при клике по слоту календаря подставлять время выбранного слота в форму.
- [x] Доработать month-view appointments: сортированный список по дням, клик по дню открывает создание с дефолтным временем `09:00`.
- [x] Сделать прошедшие дни в `Day/Week/Month` приглушёнными (disabled-style), сохранив блокировку создания/переноса в прошлое.
- [x] Исправить week-view appointments: неделя всегда строится как `Monday → Sunday`, даже если текущий день не понедельник.

### 4.6 UI foundation (выполнено)

- [x] Добавить базовые wrapper-компоненты над MUI (`buttons/tabs/forms/inputs/page`).
- [x] Добавить базовый layout (`MainLayout`, `Header`, `LeftMenu`).
- [x] Добавить основу темизации (`light/dark`) и набор мягких palette-вариантов.
- [x] Вынести базовые UI-константы (цвета, размеры, радиусы, spacing).

### 4.7 Рекомендуемый следующий инкремент (web/server)

> Цель: закрыть базовый lifecycle appointment без переусложнения.

- [x] Добавить backend endpoint `POST /api/appointments/:id/mark-paid` (только смена `paymentStatus`, без внешних провайдеров оплаты).
- [x] Добавить backend endpoint `POST /api/appointments/:id/notify` (ручной триггер уведомления, пока только запись факта в БД/лог).
- [x] Добавить в web карточку appointment две кнопки действий: `Mark as paid` и `Notify client`.
- [x] Добавить минимальный audit trail для lifecycle действий (`cancel/reschedule/mark-paid/notify`) с простым списком событий.
- [x] Добавить route-smoke тесты server для `mark-paid/notify` и один web smoke-сценарий на новые действия.

### 4.8 Appointment form UX (выполнено)

- [x] Перестроить create/edit appointment dialog в двухколоночный layout на `sm+` экранах.
- [x] Перенести поля выбора времени (`Start date`, `Start time`, `End time`) выше контактных полей клиента.
- [x] Вывести `Start date`, `Start time`, `End time` в одну строку на `sm+` (3 адаптивные колонки).
- [x] Добавить переиспользуемый helper для responsive grid-групп полей, чтобы применить ту же схему к другим наборам полей.


### 4.9 Specialists management (выполнено)

- [x] Добавить server CRUD специалистов (`GET/POST/PATCH/DELETE /api/specialists`) с фильтрацией по `account_id`.
- [x] Добавить в settings компонент списка специалистов.
- [x] Добавить popup-компонент редактирования/добавления специалиста.
- [x] Добавить кнопки-иконки edit/delete в таблице специалистов.
- [x] Добавить unit/smoke тесты для нового specialists-модуля.
- [x] Вынести управление specialists из `Settings` в отдельный пункт меню `/specialists`.
- [x] Добавить создание специалиста через dropdown `web_users` (`account_id` + `role=specialist` + `is_active=true`) вместо ручного ввода.
- [x] Ограничить видимость меню `/specialists` и операции добавления ролями `owner/admin`.

### 4.10 Web интеграционные тесты с backend (следующий шаг, KISS)

- [ ] Добавить отдельный integration-suite для web против реального `server` в тестовом окружении.
- [ ] Покрыть Appointments: `list/create/edit/reschedule/cancel/mark-paid/notify`.
- [ ] Покрыть Specialists: `list/create/edit/delete` + проверку role-gates (`owner/admin`).
- [ ] Покрыть Settings: `GET/PUT user`, `GET/PUT system` + базовые ошибки валидации/доступа.
- [ ] Выделить прогон в отдельный CI job (smoke оставить быстрым baseline).
