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
- Разделение на `components`, `containers`, `pages`, `app`, `shared`.
- Кнопка `Подключить Google` на странице настроек.

### Server

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/settings`
- `PUT /api/settings`
- `POST /api/integrations/google/oauth/start`
- `GET /api/integrations/google/oauth/callback`

`PUT /api/settings` теперь принимает и интерфейсные поля `uiThemeMode` / `uiPaletteVariantId`, чтобы сохранять тему и палитру после логина.

Слой данных серверной части теперь фиксирует разделение identity-моделей:

- `users` — Telegram-пользователи.
- `web_users` — web-учетки для email/password auth.
- `user_identity_links` — связь между Telegram и Web учетками (1:1 в рамках `account_id`).
- `web_users.role` — роль web-пользователя (`owner`/`specialist`).
- `specialists.web_user_id` — прямая 1:1 привязка специалиста к web-учетке (в рамках `account_id`).
- `server` auth-сервис регистрирует/логинит через `web_users`, а `bot` user-сервис при наличии email делает auto-link через `user_identity_links`.

Сервер разнесен по слоям:

- `config` — env + схемы валидации.
- `routes` — HTTP-маршруты.
- `middlewares` — auth/rate-limit middleware.
- `services` — бизнес-логика auth/settings.
- `repositories` — in-memory store (MVP).
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


### Google OAuth 2.0 (добавлено)

- Кнопка `Connect Google` в web теперь запускает backend endpoint `POST /api/integrations/google/oauth/start`.
- Backend формирует `authorizeUrl` и redirect на Google Consent Screen.
- Callback обрабатывается через `GET /api/integrations/google/oauth/callback` с обменом `code -> tokens`.
- `access_token` Google сохраняется в `web_users.google_api_key` для текущего web-пользователя (под будущую ролевую модель, где специалист логинится сам).
- После успешного callback пользователь возвращается на `/settings`, а в настройках отмечается `googleConnected: true`.
- Переменные окружения добавлены в `server/.env.example`: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_OAUTH_SCOPES`.

Текущее состояние модели данных для Google:

- `web_users.google_api_key` — ключ, полученный через web OAuth (источник истины для авторизованного web-пользователя).
- `specialists.web_user_id` определяет, какому специалисту принадлежит `web_user`.
- bot Google Calendar использует сначала ключ/календарь связанного `web_user`, а затем fallback на legacy `specialists.google_api_key` / `specialists.google_calendar_id`.

## Куда двигаться дальше (web/server)

Порядок продолжения разработки (KISS, без преждевременного усложнения):

1. **Перевести хранение данных с in-memory на БД** (минимальная схема users/sessions/settings).
2. **Добавить appointments как отдельный модуль** в `server` + отдельные страницы/таблицы в `web`.
3. **Реализовать операции по appointment**: смена статуса, отмена, перенос даты, ручное уведомление, подтверждение оплаты.
4. ✅ **Внедрить i18n в web** (добавлена поддержка `ru/en`, локаль в header, переводы вынесены в отдельный слой).
5. **Довести auth до production-потока**: logout/revoke, CSRF.
6. **Покрыть критические сценарии тестами** (интеграционные для server + e2e smoke для web).

### Текущий шаг (без переусложнения)

Фокус следующего инкремента: **Appointments MVP Slice** (минимальный рабочий кусок).

- Backend: `GET /api/appointments`, `POST /api/appointments`, `PATCH /api/appointments/:id`.
- Поля только MVP: `scheduledAt`, `status`, `meetingLink`, `notes`.
- Web: одна страница списка + простая форма создания/редактирования (без сложных фильтров и без drag&drop календаря).
- После этого — только 2 действия: `cancel` и `reschedule`, остальные операции позже.
- Критерий готовности: сценарий “создать запись → перенести → отменить” проходит целиком в web и server.

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

> `settings` пока остаются in-memory. Web auth-сессии уже хранятся в БД, следующий шаг — перенести туда же settings.

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
