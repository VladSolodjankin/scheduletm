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
- по клику запускается backend-интеграция через `POST /api/integrations/zoom/meetings`;
- при успешном ответе показывается success-уведомление;
- при ошибке показывается локализованная ошибка `connectZoom` (ru/en);
- все строки добавлены в i18n-словари (без hardcoded текста).

Текущая реализация запускает тестовое создание Zoom meeting (MVP handshake), чтобы пользователь мог быстро проверить, что интеграция доступна с его аккаунтом.

Следующие шаги:
- привязать создание Zoom meeting к flow создания `appointment`;
- сохранять/показывать `meetingProvider` в UI записи;
- добавить явный connected-state для Zoom в user integrations API (по аналогии с `googleConnected`).
