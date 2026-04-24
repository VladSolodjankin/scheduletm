# PRODUCTION_READINESS_CHECKLIST

Чеклист для `server + web`.

## 1. Platform & runtime

- [ ] Зафиксировать Node.js LTS версию для всех workspace.
- [ ] Настроить CI команды: install, typecheck, test, build.
- [ ] Добавить lockfile-политику и reproducible installs.

## 2. Security

- [x] Валидация payload через `zod`.
- [x] `helmet` для базовых security headers.
- [x] Salted PBKDF2 hashing для паролей.
- [x] Brute-force lockout на login endpoint.
- [x] Refresh session через `HttpOnly` cookie.
- [x] Logout endpoint удаляет текущие web auth-сессии из БД и очищает refresh cookie.
- [ ] Добавить CSRF protection для refresh cookie flow.
- [ ] Перенести секреты в secret manager (production).

## 3. API architecture

- [x] Разделить server-код по слоям (`routes/services/middlewares/config/repositories`).
- [x] Перенести in-memory store в persistent storage (settings/login attempts/oauth state + sessions).
- [x] Вынести web auth-сессии в persistent storage (`web_user_sessions`, access + refresh, revoke + expires_at).
- [ ] Добавить миграции и backup policy.
- [x] Развести identity-таблицы для Telegram и Web (`users` + `web_users` + `user_identity_links`).
- [x] Добавить связку специалиста и web identity (`specialists.user_id`) для персональных интеграций.
- [x] Добавить минимальную ролевую модель web-auth (`owner`/`admin`/`specialist`) для разграничения доступа.
- [x] Дать owner/admin возможность создавать web-пользователя роли `specialist` и связанного `specialists`-профиля.
- [x] Добавить server CRUD специалистов (`GET/POST/PATCH/DELETE /api/specialists`) с фильтрацией по `account_id`.

## 4. Integrations

- [x] Добавить endpoint запуска OAuth `/api/integrations/google/oauth/start`.
- [x] Реализовать полноценный OAuth 2.0 Google flow (auth URL + callback + token exchange).
- [x] Сохранять OAuth ключ web-пользователя в `web_user_integrations.google_api_key` после callback.
- [x] Добавить пользовательский Telegram BOT_TOKEN в `web_user_integrations` + проверку через Telegram `getMe` при сохранении.
- [ ] Добавить retry/backoff для внешних API.

## 5. Web delivery

- [x] Включить роутинг для `/login`, `/register`, `/appointments`, `/specialists`, `/settings`.
- [x] Использовать MUI как базовую UI систему.
- [x] Использовать `react-hook-form` для единообразного управления web-формами.
- [x] Ограничить неавторизованный UI только auth-экранами (без меню и настроек), после регистрации перенаправлять на `/login`.
- [x] Добавить в header профильный dropdown авторизованного пользователя (settings/logout) с адаптацией под мобильные экраны.
- [x] Добавить preloader первой загрузки для страницы appointments (skeleton вместо пустого контента).
- [x] Локализовать server API сообщения через словари `ru/en` (по `Accept-Language`/`x-locale`) для консистентного UX с web i18n.
- [x] Показывать backend `message` в web при ошибках API (auth/settings/specialists/appointments) с единым user-friendly fallback для сетевых проблем.
- [ ] Подключить error tracking.
- [ ] Настроить caching/security headers на edge.
- [x] При `401 Unauthorized` на API автоматически очищать auth-state во фронте и отправлять пользователя на `/login`.

## 6. Appointments readiness

- [x] Сначала закрыть MVP-слайс: list/create/edit + cancel/reschedule (end-to-end через web + server).
- [x] Добавить контракт и валидацию для lifecycle appointments (create/update/reschedule schemas + route-smoke coverage (service layer mocked)).
- [x] Добавить lifecycle endpoints `mark-paid` и `notify` + smoke-тесты.
- [x] Добавить обязательную валидацию `POST /api/appointments`: `appointmentAt`, `appointmentEndAt`, `firstName`, `lastName`, и один контакт (`username|phone|email`).
- [x] Добавить выбор существующего клиента в web appointment form + автопредзаполнение полей клиента.
- [x] Добавить автосоздание клиента при создании appointment, если выбранного клиента нет.
- [ ] Добавить optimistic locking/versioning для защиты от одновременного редактирования.
- [ ] Расширить аудит-лог действий (cancel/reschedule/mark-paid/notify): фильтрация, actor context, retention policy.
- [ ] Добавить идемпотентность на операции с внешними уведомлениями.

## 7. Meeting links readiness

- [ ] Ввести двойную модель ссылок: `user.defaultMeetingLink` + `appointment.meetingLink`.
- [ ] Проверять валидность URL и разрешенные домены meeting-провайдеров.
- [ ] Добавить маскирование/редакцию ссылок в логах и аналитике.
- [ ] Добавить fallback-политику: если appointment ссылка пустая, использовать default ссылку пользователя.

## 8. Web ↔ Server integration tests (critical flows)

- [ ] Добавить отдельный CI job для интеграционных web-тестов против поднятого backend (без мока API-контрактов).
- [ ] Покрыть минимум 8–12 happy-path/guardrail сценариев для `appointments`, `specialists`, `settings`.
- [ ] Проверять role-доступ (`owner/admin/specialist`) и ожидаемые ошибки (`401/403/422`) в web UX.
- [ ] Запускать этот набор на PR + nightly (а быстрые smoke оставить baseline для каждого прогона).

Описание того, что мы должны разработать.
- Регистрация.
- Логин.
- Страница настроек приложения/telegram-бота/оповещений/users/услуг/аккаунта + отдельный раздел специалистов (`/specialists`).
- [x] Поддержка разных языков (web: `ru/en`, централизованные словари переводов, переключатель языка в header).
- Управление appointments (смена статуса, подтверждение оплаты, отмена записи, изменение даты, ручное уведомление, добавление ссылки для встречи).
