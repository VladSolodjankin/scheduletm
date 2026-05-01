# Zoom и мульти-платформенные встречи (план внедрения)

## Короткий ответ
Да, интеграцию с Zoom можно добавить без большого рефакторинга.

И да — можно дать клиенту выбор платформы, но в легком формате: спросить один раз и сохранить как дефолт (`preferred_meeting_provider`) для следующих записей.

Также обязательно добавляем `offline`, потому что часть встреч проходит очно.

## Подход MVP
- specialist/admin подключает доступные online-провайдеры (минимум `zoom`, далее `telemost`);
- клиенту при первой записи показываем one-time выбор формата встречи (если разрешено политикой аккаунта/специалиста);
- выбор клиента сохраняется как дефолт на будущее;
- при создании appointment система пытается применить preference клиента, затем fallback по приоритету specialist;
- сохраняем `meetingProvider`, `meetingLink` (для online) и `locationAddress` (для offline) в appointment;
- отправляем клиенту ссылку/адрес через текущий канал уведомлений (Telegram -> Email fallback).

## Где решать “где пройдет встреча”
Решение на 2 уровнях (с простым приоритетом):

1. **Client preference** (`preferred_meeting_provider`) — заполняется один раз при первом выборе клиента.
2. **Specialist settings** — override и список разрешенных провайдеров для конкретного специалиста.

Если preference клиента недоступен для текущего specialist, используем fallback по приоритету specialist.

## Провайдеры
`meeting_provider_default`/`meetingProvider` должен поддерживать:
- `offline`;
- `zoom`;
- `telemost`;
- `manual`.

> `manual` — ручная ссылка для онлайн-встреч (когда API провайдера не подключен).

## Модель данных (MVP)

### 1) Client settings
Добавить в настройки клиента:
- `preferred_meeting_provider`: `offline | zoom | telemost | manual | null`.

### 2) Specialist settings
Добавить/использовать поля:
- `meeting_providers_priority`: упорядоченный список, например `offline,telemost,zoom,manual`;
- `allowed_meeting_providers`: список разрешенных провайдеров;
- `meeting_provider_override_enabled`: boolean (для specialist override).

### 3) Appointment
Добавить/использовать поля:
- `meetingProvider`: `offline | zoom | telemost | manual | ''`;
- `meetingLink`: string (для online-провайдеров);
- `locationAddress`: string (для offline);

## Логика создания appointment
1. Определяем effective providers для специалиста.
2. Если у клиента есть `preferred_meeting_provider` и он разрешен, используем его.
3. Иначе берем первый доступный из приоритета specialist.
4. Дальше по провайдеру:
   - `offline`: сохраняем адрес; карта строится на UI через Google Maps API.
   - `zoom`/`telemost`: пытаемся создать meeting через API;
   - `manual`: используем заранее заданную/введенную ссылку.
5. Если online-провайдер не сработал — пробуем следующий по приоритету.
6. Если все online-провайдеры недоступны:
   - fallback в `offline` (если разрешен и есть адрес), иначе `manual`,
   - appointment не падает, а ошибка логируется.

## UI/UX (минимально)
- В Settings добавляем отдельный таб **Booking Settings** (можно объединить с текущими Booking policies).
- В этом табе specialist/admin управляет провайдерами встреч и их приоритетом.
- При первой записи клиента: компактный вопрос “Как обычно проводить встречу?” с вариантами из разрешенных провайдеров.
- Чекбокс/подсказка: “Запомнить как вариант по умолчанию”.
- В последующих записях выбор подставляется автоматически, но его можно изменить.
- Для `offline` показываем адрес и карту в карточке/календаре appointment (карта строится через Google Maps API по адресу).
- Если в Booking Settings выбран режим `offline`:
  - скрываем поля настройки online-провайдеров (`zoom`/`telemost`/`manual`);
  - показываем поля адреса офлайн-встречи;
  - показываем карту с возможностью выбрать/уточнить адрес на карте (координаты -> автозаполнение адреса).

## Уведомления
Нужно гарантировать:
- для online отправляется `meetingLink`;
- для offline отправляется `locationAddress`;
- для `manual`: если специалист добавил/обновил ссылку после создания appointment, отправляется отдельное уведомление клиенту “Ссылка на встречу добавлена” с самой ссылкой;
- тексты локализуются через i18n (без hardcoded строк).

## Acceptance criteria для MVP
- Клиент может один раз выбрать дефолтный формат встречи, и он сохраняется.
- `meeting_provider_default` включает `offline`.
- Для offline встреч в appointment сохраняется адрес и отображается карта по адресу (Google Maps API).
- Если в Booking Settings выбран `offline`, поля online-провайдеров скрываются, а поля адреса и карта выбора адреса отображаются.
- При недоступности выбранного online-провайдера система использует следующий доступный по приоритету.
- Создание appointment не падает из-за сбоя внешнего meeting API.
- Клиент получает в уведомлении либо online-ссылку, либо offline-адрес/карту.
- Для `manual`: при добавлении ссылки специалистом после создания записи клиент получает отдельное уведомление с новой ссылкой.

## Старт backend-интеграции (2026-04-30)

Обновление (2026-04-30, позднее): переход на user-level Zoom OAuth 2.0 (General App) с redirect callback. Теперь каждый специалист подключает личный Zoom-аккаунт через `POST /api/integrations/zoom/oauth/start` и `GET /api/integrations/zoom/oauth/callback`, после чего `POST /api/integrations/zoom/meetings` создает встречи от имени подключенного пользователя.

Реализован базовый server-side Zoom MVP:

- добавлен endpoint `POST /api/integrations/zoom/meetings` (только backend вызов, без раскрытия секретов в браузере);
- endpoint валидирует payload (`topic`, `startTime`, `duration`, `timezone`) и создает встречу через Zoom API `POST /v2/users/me/meetings`;
- для авторизации используется Zoom Server-to-Server OAuth (`grant_type=account_credentials`);
- переменные окружения хранятся только на backend:
  - `ZOOM_ACCOUNT_ID`
  - `ZOOM_CLIENT_ID`
  - `ZOOM_CLIENT_SECRET`
- в `web_user_integrations` добавлено хранение Zoom-данных:
  - `zoom_access_token`, `zoom_token_expires_at`, `zoom_connected_at`
  - `zoom_last_meeting_id`, `zoom_last_join_url`, `zoom_last_start_url`

Ответ endpoint:

- `zoomMeetingId`
- `joinUrl` (для клиента)
- `startUrl` (только для организатора/служебного использования)

## Обновление frontend (2026-04-30)

Сделан первый шаг UI-интеграции на странице `Settings` в табе `Integrations`:

- добавлена брендированная кнопка `Connect Zoom` с логотипом Zoom;
- по клику запускается user-level OAuth flow через `POST /api/integrations/zoom/oauth/start` (c последующим redirect в Zoom);
- при успешном ответе показывается success-уведомление;
- при ошибке показывается локализованная ошибка `connectZoom` (ru/en);
- все строки добавлены в i18n-словари (без hardcoded текста).

Текущая реализация инициирует OAuth-подключение пользователя; создание встреч выполняется отдельно через `POST /api/integrations/zoom/meetings` после успешного callback.

Следующие шаги:
- привязать создание Zoom meeting к flow создания `appointment`;
- сохранять/показывать `meetingProvider` в UI записи;
- добавить явный connected-state для Zoom в user integrations API (по аналогии с `googleConnected`).

## Обновление connected-state Zoom (2026-04-30)

Сделан следующий шаг по интеграции:

- в `GET /api/settings/user` добавлен флаг `zoomConnected`;
- значение `zoomConnected=true` возвращается, если в `web_user_integrations` есть `zoom_access_token` и `zoom_token_expires_at` еще не истек;
- на frontend в `Settings -> Integrations` кнопка Zoom теперь показывает состояние `Zoom connected` и блокируется после успешного подключения;
- состояние обновляется локально после возврата из Zoom callback (`zoom_oauth=success`) и при последующей загрузке `GET /api/settings/user`.

## Обновление appointment flow (2026-04-30)

- создание Zoom meeting привязано к `POST /api/appointments`: если выбран `meetingProvider=zoom` и ссылка не указана, backend пытается автоматически создать Zoom-встречу от имени текущего пользователя (specialist/admin/owner с подключенным Zoom OAuth) и сохраняет `joinUrl` в appointment;
- в appointment API добавлен `meetingProvider` (`manual | zoom`) и он сохраняется/читается вместе с `meetingLink`;
- в UI формы записи добавлен выбор провайдера встречи (`Manual link`/`Zoom`);
- в календарных карточках записи отображается выбранный `meetingProvider`.

## Обновление preferences и booking settings (2026-04-30)

- добавлено сохранение `preferred_meeting_provider` у клиента (`manual | zoom`) и авто-запоминание первого выбора провайдера при создании записи;
- в specialist booking policy добавлены поля:
  - `meeting_providers_priority`
  - `allowed_meeting_providers`
  - `meeting_provider_override_enabled`;
- расширены backend/frontend контракты settings для чтения/сохранения этих полей.

## Обновление offline location foundation (2026-05-01)

- для `account_settings` добавлены поля офлайн-локации бизнеса:
  - `business_address`
  - `business_lat`
  - `business_lng`
- контракты `GET/PUT /api/settings/account` расширены новыми полями;
- зафиксирован MVP-подход для offline-карты: Mapbox (карта + geocoding/reverse geocoding) в админке и read-only карта в публичной части.

## Обновление offline provider в appointment flow (2026-05-01)

Закрыта следующая часть MVP для meeting providers:

- `offline` добавлен в типы и контракты appointment API/web;
- в форме создания/редактирования записи появился явный выбор `Offline`;
- в календаре и карточках записи отображается `meetingProvider=offline`;
- дефолтные provider-цепочки в booking policy обновлены на `offline,zoom,manual`;
- добавлена миграция для расширения `preferred_meeting_provider` и default-приоритетов в БД.

Что осталось по этому плану (следующий шаг):
- добавить реальное хранение `locationAddress` в appointment (сейчас для `offline` пока без отдельного поля адреса);
- добавить Mapbox UI (выбор адреса в админке + read-only карта в публичной части);
- довести fallback-цепочку online->offline/manual при ошибках внешних API;
- добавить уведомления для offline с адресом/картой и отдельное событие для обновления manual-ссылки после создания записи.


## Обновление locationAddress в appointment (2026-05-01)

- в `POST/PATCH /api/appointments` добавлено поле `locationAddress` (MVP-хранение для `offline`);
- адрес сохраняется и читается через существующий `comment`-payload (`locationAddress: ...`) вместе с `meetingProvider`/`meetingLink`;
- в форме записи (`web`) для `meetingProvider=offline` добавлено поле адреса встречи;
- добавлены i18n-ключи `appointments.fields.locationAddress` (ru/en).

## Обновление fallback meeting providers (2026-05-01)

- в `POST /api/appointments` добавлена последовательная fallback-цепочка выбора провайдера:
  - сначала явный выбор из payload;
  - затем `preferred_meeting_provider` клиента (если разрешен политикой specialist);
  - затем `meeting_providers_priority` specialist с фильтрацией по `allowed_meeting_providers`;
- при `meetingProvider=zoom` без ссылки система пробует создать Zoom-встречу, и при ошибке автоматически переходит к следующему провайдеру из цепочки (без падения создания appointment);
- если клиент ничего не выбирал, а ссылка уже введена вручную, сохраняется `manual`;
- `preferred_meeting_provider` теперь сохраняется также для `offline` (а не только для `manual/zoom`), чтобы первый офлайн-выбор клиента мог стать дефолтом.

## Обновление Account Settings UI для offline-адреса (2026-05-01)

- в `Settings -> Account settings` добавлены поля:
  - `businessAddress`
  - `businessLat`
  - `businessLng`
- поля привязаны к существующим `GET/PUT /api/settings/account` контрактам и сохраняются через текущий save-flow без дополнительного API.

## Обновление Mapbox preview в Account Settings (2026-05-01)

- в `Settings -> Account settings` добавлен базовый Mapbox preview для offline-локации:
  - при наличии `businessLat/businessLng` показывается статическая карта с маркером;
  - при наличии `businessAddress` показывается кнопка перехода в Mapbox Search;
- для включения используется `VITE_MAPBOX_PUBLIC_TOKEN` на frontend.

## Что осталось доделать (актуально на 2026-05-01)

Ниже — короткий actionable backlog именно по Zoom/multi-provider направлению, синхронизированный с `README.md`, `TODO.md` и текущим состоянием этого плана.

### P0 (закрыть до production)

1. Привязать end-to-end уведомления к провайдеру встречи:
   - для `offline` отправлять `locationAddress` (+ ссылка на карту, если доступна);
   - для `manual` отправлять отдельное уведомление, если ссылка добавлена/обновлена после создания записи;
   - для `zoom` гарантировать отправку валидного `joinUrl` после fallback-логики.
2. Добавить e2e/интеграционные тесты критичного appointment-flow без моков meeting provider логики:
   - создание записи с `zoom` (успех);
   - создание записи с ошибкой Zoom и fallback на `offline/manual`;
   - сценарий с `preferred_meeting_provider` клиента и override политикой specialist.
3. Довести observability по интеграциям:
   - метрики/алерты по ошибкам Zoom API и частоте fallback-срабатываний;
   - явные reason-коды в логах/событиях appointment при переключении провайдера.

### P1 (сразу после P0)

1. Добавить connected-state и UX для следующих провайдеров (`telemost`, затем Google/Outlook/iCal по roadmap).
2. Вынести provider-specific тексты и уведомления в i18n-ключи с единым шаблоном для web+bot.
3. Расширить UI booking settings:
   - более явное управление приоритетом провайдеров (drag/drop или up/down);
   - валидация конфликтных конфигураций (например, `offline` разрешен, но нет адреса аккаунта).

### P2 (после стабилизации)

1. Отвязать `locationAddress` от `comment`-payload и вынести в отдельное нормализованное поле/колонку с миграцией данных.
2. Добавить idempotency-ключ для повторных попыток создания external meetings (Zoom и будущие провайдеры).
3. Добавить runbook инцидентов meeting providers (rate limits, revoke токена, деградация API, массовый fallback).

## Быстрый срез статуса (2026-05-01)

- ✅ Базовый Zoom OAuth + создание meetings и fallback-цепочка уже есть.
- ✅ `offline` провайдер и MVP-хранение `locationAddress` в appointment-flow уже есть.
- ⚠️ Не завершены provider-aware уведомления и отдельное событие для обновления `manual` ссылки.
- ⚠️ Нет полного набора автотестов и продуктовых метрик/алертов по meeting providers.
