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
- Управление интеграциями (Google + Telegram BOT_TOKEN в user settings).
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

- Страницы: `/login`, `/register`, `/appointments`, `/specialists`, `/settings` через `react-router-dom`.
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
- `GET /api/specialists`
- `POST /api/specialists`
- `PATCH /api/specialists/:id`
- `DELETE /api/specialists/:id`
- `GET /api/settings/system` (owner/admin)
- `PUT /api/settings/system` (owner/admin)
- `GET /api/settings/user`
- `PUT /api/settings/user`
- `POST /api/integrations/google/oauth/start`
- `GET /api/integrations/google/oauth/callback`

`PUT /api/settings/system` обновляет системные настройки (таблица `app_settings`), а `PUT /api/settings/user` сохраняет пользовательские настройки (`web_users` для UI/locale/timezone + `web_user_integrations` для Google/Telegram интеграций).

Слой данных серверной части теперь фиксирует разделение identity-моделей:

- `telegram_users` — Telegram-пользователи.
- `web_users` — web-учетки для email/password auth.
- `user_identity_links` — связь между Telegram и Web учетками (1:1 в рамках `account_id`).
- `web_users.role` — роль web-пользователя (`owner`/`admin`/`specialist`).
- `web_user_integrations.telegram_bot_token` — персональный BOT_TOKEN для Telegram-интеграции пользователя в web settings.
- `specialists.user_id` — прямая 1:1 привязка специалиста к web-учетке (в рамках `account_id`).
- `server` auth-сервис регистрирует/логинит через `web_users`, а `bot` user-сервис при наличии email делает auto-link через `user_identity_links`.
- В `server` добавлен i18n-слой ответов API (dictionary-based `ru/en`, выбор локали из `Accept-Language`/`x-locale`), чтобы серверные тексты были синхронизированы с подходом web.

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
- На фронте добавлен единый helper обработки API-ошибок: backend `message` теперь показывается пользователю во всех основных web-сценариях (auth/settings/specialists/appointments), а при сетевых сбоях выводится дружелюбное сообщение вместо технических деталей.


### Google OAuth 2.0 (добавлено)

- Кнопка `Connect Google` в web теперь запускает backend endpoint `POST /api/integrations/google/oauth/start`.
- Backend формирует `authorizeUrl` и redirect на Google Consent Screen.
- Callback обрабатывается через `GET /api/integrations/google/oauth/callback` с обменом `code -> tokens`.
- `access_token` Google сохраняется в `web_user_integrations.google_api_key` для текущего web-пользователя (под будущую ролевую модель, где специалист логинится сам).
- После успешного callback пользователь возвращается на `/settings`, а в настройках отмечается `googleConnected: true`.
- Управление специалистами вынесено из `Settings` в отдельный раздел `/specialists` в левом меню (для `owner/admin`).
- На странице `/specialists` создание специалиста теперь выполняется через выбор из `web_users` текущего `account_id` (только `role = specialist` и `is_active = true`, исключая уже привязанные профили специалистов).
- Переменные окружения добавлены в `server/.env.example`: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_OAUTH_SCOPES`.

Текущее состояние модели данных для Google:

- `web_user_integrations.google_api_key` — ключ, полученный через web OAuth (источник истины для авторизованного web-пользователя).
- `specialists.user_id` определяет, какому специалисту принадлежит `web_user`.
- `specialists` больше не хранит Google credentials: источник истины только `web_user_integrations.google_api_key/google_calendar_id`.

### Telegram BOT_TOKEN (добавлено)

- В `User settings` добавлено password-поле для `BOT_TOKEN`.
- Backend при сохранении токена вызывает Telegram API `getMe`; если API недоступен, токен всё равно сохраняется как рабочий fallback.
- В `web_user_integrations` сохраняются `telegram_bot_token` и метаданные бота (`telegram_bot_username`, `telegram_bot_name`) для отображения статуса на фронте.
- Bot backend использует токен из `web_user_integrations.telegram_bot_token` (а не из `.env BOT_TOKEN`) для Telegram API вызовов.

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
- Следующий шаг: добавить расширенные фильтры календаря и углубить audit/logging слой для lifecycle-событий.

### Рекомендуемая задача на следующий шаг

С учётом текущей структуры `server` (чистое разделение `routes -> services -> repositories`) и `web` (контейнеры + календарный UI), лучший следующий инкремент:

1. добавить lifecycle-операции `mark-paid` и `notify` в appointments API;
2. вывести эти действия в существующий popup карточки appointment в web;
3. добавить минимальный audit trail событий без запуска сложной event-driven архитектуры.

Почему именно это:

- даёт максимальную бизнес-ценность в уже готовом календарном флоу;
- использует существующую модульную структуру без рефакторинга;
- остаётся в рамках KISS/DRY: переиспользуем текущие сервисы/контейнеры и расширяем только необходимый минимум.

### Статус инкремента 4.7 (выполнено)

- Server: добавлены `POST /api/appointments/:id/mark-paid` и `POST /api/appointments/:id/notify`.
- Server: добавлен минимальный audit trail `appointment_events` для действий `cancel/reschedule/mark-paid/notify`.
- Web: в popup редактирования appointment добавлены действия `Mark as paid` и `Notify client`.
- Web: в popup добавлен простой список последних lifecycle-событий.
- Тесты: расширены server route-smoke и web smoke проверки на новые endpoint/actions.

### Appointments MVP: что уже сделано

- В формах создания/редактирования appointment добавлен выбор клиента из `clients` (фильтрация внутри текущего `account_id` на сервере).
- Если выбран существующий клиент, поля контактов (`username`, `firstName`, `lastName`, `phone`, `email`) предзаполняются.
- Поле `phone` в web-форме appointment поддерживает выбор страны (постсоветские + европейские страны), маску номера и клиентскую валидацию длины номера.
- Форма создания/редактирования appointment в web перестроена в двухколоночный layout (на `sm+`), чтобы быстрее заполнять связанные поля парами.
- Поля времени (`Start date`, `Start time`, `End time`) перенесены выше контактных данных и на `sm+` отображаются в одной строке (3 колонки), чтобы сначала фиксировать слот записи.
- Для layout формы добавлен переиспользуемый helper генерации responsive grid-конфигурации, который можно применять к другим группам полей.
- Если клиент не выбран, web позволяет ввести данные вручную; при создании appointment новый клиент автоматически создаётся в таблице `clients`.
- Для `POST /api/appointments` добавлена обязательная валидация:
  - `appointmentAt` (начало),
  - `appointmentEndAt` (окончание),
  - `firstName`,
  - `lastName`,
  - хотя бы одно из: `username` или `phone` или `email`.
- Server: добавлены endpoint'ы `GET /api/appointments`, `POST /api/appointments`, `PATCH /api/appointments/:id`, `POST /api/appointments/:id/cancel`, `POST /api/appointments/:id/reschedule`.
- В server добавлена базовая role-aware фильтрация:
  - `owner/admin` видят записи всех специалистов внутри своего `account_id`;
  - `specialist` видит только свои записи.
- Во все выборки appointments добавлена привязка к `account_id` как базовое правило изоляции данных.
- Web: добавлена страница `/appointments`:
  - календарный тайм-грид с отображением записей прямо в слотах по времени;
  - режимы просмотра `Day/Week/Month`: week-view всегда начинается с понедельника (Monday → Sunday), текущий день подсвечивается в шапке, а month-view показывает список записей по каждой дате;
  - в month-view клик по дню открывает popup создания записи с дефолтным временем `09:00` выбранного дня;
  - прошедшие дни в `Day/Week/Month` визуально приглушены (серый disabled-style), чтобы быстрее отличать их от доступных дней;
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

### Стоит ли добавлять web integration-тесты с backend для Appointments/Specialists/Settings

Да — **стоит**, но точечно, без перегруза пайплайна:

- оставить текущие быстрые smoke/e2e проверки web как baseline (быстрый feedback);
- добавить отдельный слой `web + real server API` только для критических пользовательских сценариев:
  - `appointments`: list/create/edit/reschedule/cancel/mark-paid/notify;
  - `specialists`: list/create/edit/delete + role-ограничения `owner/admin`;
  - `settings`: чтение/сохранение `user/system`, включая интеграционные поля (Google/Telegram).
- запускать такие тесты в CI как отдельный job (например, на PR + nightly), чтобы не замедлять каждый локальный прогон.

Практичный баланс для MVP: **smoke + 8–12 integration happy-path/guardrail кейсов** достаточно, чтобы рано ловить регрессии контракта web↔server без over-engineering.

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
