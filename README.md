# Meetli Monorepo

## О проекте

**Meetli** — платформа для управления расписанием специалистов и коммуникацией с клиентами через web + Telegram.

### Какие проблемы решаем

- Потерянные или пропущенные записи из-за ручного ведения календаря.
- Разрозненные каналы коммуникации (мессенджеры, заметки, таблицы).
- Ручные подтверждения, переносы и напоминания, которые отнимают время.
- Отсутствие единого места для настроек услуг, специалистов и клиентских записей.

### Какие услуги предоставляет продукт

- Регистрация/логин и централизованные настройки аккаунта.
- Управление интеграциями (в первую очередь Google).
- Управление appointments: создание, изменение статуса, перенос, отмена, подтверждение оплаты, ручные уведомления.
- Управление ссылками на онлайн-встречи (дефолтная ссылка + override на конкретную запись).
- Web-интерфейс + Telegram-бот как единая экосистема.

### Зачем это пользователям

- Экономия времени на рутинных операциях и меньше ошибок в расписании.
- Прозрачный процесс работы с клиентскими записями в одном месте.
- Более стабильный клиентский опыт: понятные статусы, своевременные уведомления, актуальные ссылки на встречи.
- Готовая база для масштабирования: новые услуги, специалисты, языки и интеграции без пересборки процесса “с нуля”.

Репозиторий разделен на изолированные приложения:

- `bot` — Telegram-бот.
- `server` — Node.js API слой для web-клиента и интеграций.
- `web` — React SPA для пользователя.

## Структура

```text
scheduletm/
├─ bot/
├─ server/
└─ web/
```

## MVP сейчас

### Web

- Страницы: `/login`, `/register`, `/settings` через `react-router-dom`.
- UI на `@mui/material` (без кастомного CSS на старте).
- Формы web переведены на `react-hook-form` для единообразного контроля полей и submit-state.
- Разделение на `components`, `containers`, `pages`, `app`, `shared`.
- Кнопка `Подключить Google` на странице настроек.

### Server

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/specialists`
- `GET /api/settings/system` (owner/admin)
- `PUT /api/settings/system` (owner/admin)
- `GET /api/settings/user`
- `PUT /api/settings/user`
- `POST /api/integrations/google/oauth/start`
- `GET /api/integrations/google/oauth/callback`

`PUT /api/settings/system` обновляет системные настройки (таблица `app_settings`), а `PUT /api/settings/user` сохраняет пользовательские настройки (`web_users`, включая `uiThemeMode` / `uiPaletteVariantId`).

Слой данных серверной части теперь фиксирует разделение identity-моделей:

- `telegram_users` — Telegram-пользователи.
- `web_users` — web-учетки для email/password auth.
- `user_identity_links` — связь между Telegram и Web учетками (1:1 в рамках `account_id`).
- `web_users.role` — роль web-пользователя (`owner`/`admin`/`specialist`).
- `specialists.user_id` — прямая 1:1 привязка специалиста к web-учетке (в рамках `account_id`).
- `server` auth-сервис регистрирует/логинит через `web_users`, а `bot` user-сервис при наличии email делает auto-link через `user_identity_links`.

Сервер разнесен по слоям:

- `config` — env + схемы валидации.
- `routes` — HTTP-маршруты.
- `middlewares` — auth/rate-limit middleware.
- `services` — бизнес-логика auth/settings.
- `repositories` — persistence-слой на БД (settings, sessions, login attempts, oauth state).
- `utils` — утилиты (crypto/cookies).


### Web UI foundation (апрель 2026)

- Добавлены базовые UI-wrapper компоненты над MUI: кнопки, табы, формы, поля ввода, page-контейнер.
- Добавлены `MainLayout`, `Header`, `LeftMenu` для единого каркаса страниц.
- Добавлена централизованная тема (light/dark) + 5 мягких палитр, включая базу `hsl(210, 100%, 38%)`.
- Все базовые константы размеров/скруглений/spacing вынесены в отдельный слой theme-констант, чтобы быстро менять стиль продукта.
- Для неавторизованных пользователей показываются только auth-экраны (`/login`, `/register`) без меню и настроек.
- Дефолтная локаль берётся из системного языка браузера (если пользователь ещё не выбирал язык вручную).
- После регистрации пользователь перенаправляется на `/login` (без автологина).
- Auth-экран обновлён: в карточке логина/регистрации используется `logo_text.svg` вместо текстовой заглушки, а компоновка выровнена по более аккуратным пропорциям (включая правило золотого сечения для hero-блока).
- Для авторизованного пользователя в шапке добавлен profile-компонент: avatar (или инициалы), имя/email в меню, переход в настройки и logout.
- Header сделан более responsive: на мобильных экранах элементы внешнего вида/локали минимизированы, сохранены ключевые действия (язык, тема, профиль).
- На странице appointments добавлен preloader (skeleton) для первой загрузки данных, чтобы пользователь не видел пустой экран до прихода ответа API.


### Google OAuth 2.0 (добавлено)

- Кнопка `Connect Google` в web теперь запускает backend endpoint `POST /api/integrations/google/oauth/start`.
- Backend формирует `authorizeUrl` и redirect на Google Consent Screen.
- Callback обрабатывается через `GET /api/integrations/google/oauth/callback` с обменом `code -> tokens`.
- `access_token` Google сохраняется в `web_users.google_api_key` для текущего web-пользователя (под будущую ролевую модель, где специалист логинится сам).
- После успешного callback пользователь возвращается на `/settings`, а в настройках отмечается `googleConnected: true`.
- Переменные окружения добавлены в `server/.env.example`: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_OAUTH_SCOPES`.

Текущее состояние модели данных для Google:

- `web_users.google_api_key` — ключ, полученный через web OAuth (источник истины для авторизованного web-пользователя).
- `specialists.user_id` определяет, какому специалисту принадлежит `web_user`.
- `specialists` больше не хранит Google credentials: источник истины только `web_users.google_api_key/google_calendar_id`.

## Куда двигаться дальше (web/server)

Порядок продолжения разработки (KISS, без преждевременного усложнения):

1. **Перевести хранение данных с in-memory на БД** (выполнено для settings/login attempts/oauth state и web sessions).
2. **Добавить appointments как отдельный модуль** в `server` + отдельные страницы/таблицы в `web`.
3. **Реализовать операции по appointment**: смена статуса, отмена, перенос даты, ручное уведомление, подтверждение оплаты.
4. ✅ **Внедрить i18n в web** (добавлена поддержка `ru/en`, локаль в header, переводы вынесены в отдельный слой).
5. **Довести auth до production-потока**: logout/revoke, CSRF.
6. ✅ **Покрыть критические сценарии тестами** (route-smoke для server (с моками service-слоя) + web smoke-проверки auth/settings/appointments).

### Текущий шаг (без переусложнения)

Текущий инкремент закрыл **Appointments MVP Slice** и smoke-покрытие ключевого флоу.

- Backend: `GET /api/appointments`, `POST /api/appointments`, `PATCH /api/appointments/:id`, `POST /cancel`, `POST /reschedule`.
- Поля MVP: `scheduledAt`, `status`, `meetingLink`, `notes`.
- Web: страница appointments с календарём, popup-формой создания/редактирования и действиями cancel/reschedule.
- Тесты: добавлены server route-smoke-сценарии (`create/reschedule/cancel`, с моками service-слоя) и web smoke-проверки (`auth/settings/appointments`).
- Следующий шаг: расширить lifecycle (`mark-paid`, `notify`) и покрыть edge-case сценарии конфликтов.

### Appointments MVP: что уже сделано

- Server: добавлены endpoint'ы `GET /api/appointments`, `POST /api/appointments`, `PATCH /api/appointments/:id`, `POST /api/appointments/:id/cancel`, `POST /api/appointments/:id/reschedule`.
- В server добавлена базовая role-aware фильтрация:
  - `owner/admin` видят записи всех специалистов внутри своего `account_id`;
  - `specialist` видит только свои записи.
- Во все выборки appointments добавлена привязка к `account_id` как базовое правило изоляции данных.
- Web: добавлена страница `/appointments`:
  - календарный тайм-грид с отображением записей прямо в слотах по времени;
  - режимы просмотра `Day/Week` (Teams-like подход на MVP-уровне), при этом в week-view первым днем всегда идет текущий/focus день (а не фиксированный понедельник);
  - создание/редактирование записи в popup;
  - при клике по слоту календаря форма создания предзаполняется временем выбранного слота (а не текущим временем пользователя);
  - действия `cancel` и `reschedule` через popup;
  - drag&drop перенос записи между слотами календаря;
  - при попытке создать/перенести запись в прошлый слот показывается error toast (без навязчивого hover tooltip).
- Для `owner/admin` добавлен фильтр по специалистам сверху страницы appointments.
- Добавлена поддержка внешней занятости из Google Calendar в web appointments (`busySlots`), чтобы видеть занятые интервалы помимо локальных записей.
- Временная модель унифицирована:
  - в БД и API `scheduledAt` хранится в UTC;
  - в web календаре время отображается в локальной timezone браузера пользователя (IANA);
  - для выбранного специалиста в UI показывается его timezone как контекст.
  Это устраняет расхождения вида: специалист в UTC+3 видит 12:00, клиент в UTC+4 — 13:00 (один и тот же UTC-момент).
- Таймзоны пользователей сохраняются как IANA-идентификаторы:
  - `web_users.timezone` — timezone специалиста/веб-пользователя (берется из браузера при auth/register, может изменяться в user settings);
  - `clients.timezone` — timezone клиента (при отсутствии явного значения используется fallback timezone аккаунта).

### Appointments MVP: что оставили на следующий инкремент

- Расширенные фильтры календаря и групповые операции.

## Решение по ссылке на встречу

Рекомендуемая стратегия:

- хранить `meetingLink` **на уровне appointment** как фактическую ссылку конкретной встречи;
- хранить `defaultMeetingLink` **на уровне пользователя/специалиста** как шаблон по умолчанию.

Почему так:

- appointment-level гибко поддерживает разные платформы/ссылки для разных клиентов/услуг;
- user-level default не заставляет вводить ссылку каждый раз;
- при создании appointment сервер заполняет `meetingLink` из `defaultMeetingLink`, но позволяет переопределить.

Это компромисс DRY + KISS: одна понятная модель без дублирования ручного ввода.

## Безопасность (MVP)

- `helmet`.
- CORS ограничен `APP_URL`.
- Валидация входа через `zod`.
- Salted PBKDF2 hash для паролей.
- Защита логина от brute-force (lockout).
- Refresh-сессия через `HttpOnly` cookie.
- Access/refresh web-сессии сохраняются в БД (`web_user_sessions`), а не в in-memory.
- Logout в web вызывает backend `POST /api/auth/logout`, который удаляет текущие access/refresh токены из БД и очищает refresh cookie.
- Если API возвращает `401 Unauthorized`, web-клиент автоматически очищает auth-сессию и делает redirect на `/login`.

> `settings` и OAuth/login state переведены в БД: system settings в `app_settings`, user settings/integrations в `web_users`.

## Команды

```bash
npm install
npm run typecheck
npm run build
```

Локально:

```bash
npm run -w @scheduletm/server dev
npm run -w @scheduletm/web dev
```

Для дополнительной информации смотри PRODUCTION_READINESS_CHECKLIST.md, README.md, TODO.md, PROJECT_MAP.md
После доработки не зыбудь обновить документации.
