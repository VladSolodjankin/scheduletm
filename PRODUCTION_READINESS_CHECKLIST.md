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
- [ ] Добавить CSRF protection для refresh cookie flow.
- [ ] Перенести секреты в secret manager (production).

## 3. API architecture

- [x] Разделить server-код по слоям (`routes/services/middlewares/config/repositories`).
- [ ] Перенести in-memory store в persistent storage.
- [ ] Добавить миграции и backup policy.
- [x] Развести identity-таблицы для Telegram и Web (`users` + `web_users` + `user_identity_links`).

## 4. Integrations

- [x] Добавить минимальный контракт `/api/integrations/google/connect`.
- [ ] Реализовать полноценный OAuth 2.0 Google flow.
- [ ] Добавить retry/backoff для внешних API.

## 5. Web delivery

- [x] Включить роутинг для `/login`, `/register`, `/settings`.
- [x] Использовать MUI как базовую UI систему.
- [ ] Подключить error tracking.
- [ ] Настроить caching/security headers на edge.

## 6. Appointments readiness

- [ ] Добавить контракт и валидацию для lifecycle appointments.
- [ ] Добавить optimistic locking/versioning для защиты от одновременного редактирования.
- [ ] Добавить аудит-лог действий (cancel/reschedule/mark-paid/notify).
- [ ] Добавить идемпотентность на операции с внешними уведомлениями.

## 7. Meeting links readiness

- [ ] Ввести двойную модель ссылок: `user.defaultMeetingLink` + `appointment.meetingLink`.
- [ ] Проверять валидность URL и разрешенные домены meeting-провайдеров.
- [ ] Добавить маскирование/редакцию ссылок в логах и аналитике.
- [ ] Добавить fallback-политику: если appointment ссылка пустая, использовать default ссылку пользователя.

Описание того, что мы должны разработать.
- Регистрация.
- Логин.
- Страница настроек приложения/telegram-бота/оповещений/специалистов/users/услуг/аккаунта (можно реализовать на одной странице settings через Tabs).
- [x] Поддержка разных языков (web: `ru/en`, централизованные словари переводов, переключатель языка в header).
- Управление appointments (смена статуса, подтверждение оплаты, отмена записи, изменение даты, ручное уведомление, добавление ссылки для встречи).
