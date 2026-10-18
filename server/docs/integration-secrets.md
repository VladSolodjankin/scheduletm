# Хранение секретов интеграций (Google/Zoom/Yandex Telemost/Telegram)

## Где хранится ключ шифрования

Все OAuth-токены и bot-токены в таблице `web_user_integrations` (Google access/refresh token,
Zoom access/refresh token, Yandex access/refresh token, Telegram bot token) шифруются на уровне приложения AES-256-GCM
(`server/src/utils/crypto.ts`) перед записью в БД — см. `server/src/repositories/integrationSecretCrypto.ts`.

Ключ шифрования — переменная окружения `APP_ENCRYPTION_KEY` (`server/src/config/env.ts`). Она задаётся
в secret-хранилище окружения деплоя (Railway/хостинг env vars), не коммитится в репозиторий
(`server/.env.example` содержит только плейсхолдер). Без этой переменной чтение/запись зашифрованных
секретов падает с explicit-ошибкой (`APP_ENCRYPTION_KEY is required to ... encrypted ...`) — silent fallback
на чтение как есть не предусмотрен.

Соответствующие plaintext-колонки (`google_api_key`, `google_refresh_token`, `telegram_bot_token`,
`zoom_access_token`, `zoom_refresh_token`) удалены из `web_user_integrations` миграциями
`20260915130000_backfill_encrypt_web_user_integration_secrets` (докодирует оставшиеся незашифрованные
значения перед удалением) и `20260915140000_drop_plaintext_web_user_integration_secrets`.

## Yandex Telemost

- Колонки `web_user_integrations.yandex_access_token_encrypted` и `yandex_refresh_token_encrypted` шифруются тем же
  `integrationSecretCrypto` (AES-256-GCM, `APP_ENCRYPTION_KEY`); plaintext-колонок нет. Остальные поля:
  `yandex_token_expires_at`, `yandex_connected_at`, `yandex_last_meeting_id`, `yandex_last_join_url`.
- Env: `YANDEX_OAUTH_CLIENT_ID`, `YANDEX_OAUTH_CLIENT_SECRET` (secret-хранилище деплоя),
  `YANDEX_OAUTH_REDIRECT_URI` (`<API_BASE_URL>/api/integrations/yandex/oauth/callback`),
  `YANDEX_OAUTH_SCOPES` (по умолчанию `telemost-api:conferences.create`).
- OAuth state хранится в таблице `yandex_oauth_states` (одноразовый, TTL 10 минут).
- Отключение (`POST /api/integrations/yandex/disconnect`) очищает токены UPDATE-ом существующей строки и не создаёт новых.
- При смене ключа шифрования строки с Yandex-токенами нужно перешифровать так же, как остальные `*_encrypted` колонки.

## Google Calendar: scopes и запись событий

- Чтение занятости: `POST https://www.googleapis.com/calendar/v3/freeBusy` (календарь `primary`), без названий и email
  организаторов. Новые подключения запрашивают только `openid`, `userinfo.email`, `calendar.freebusy`
  (`GOOGLE_OAUTH_SCOPES` переопределяет список). Старые токены со scope `calendar.readonly` продолжают работать.
- Запись событий — opt-in. Код ЗАПРАШИВАЕТ только тот scope записи, что задан в `GOOGLE_OAUTH_WRITE_SCOPE`
  (по умолчанию `calendar.events.owned`). Scope `calendar.events` и `calendar` лишь распознаются как уже выданные
  scope записи (например, у ранее подключённых пользователей), но сами не запрашиваются. Если в Google Console
  нет `calendar.events.owned`, запасной вариант — `GOOGLE_OAUTH_WRITE_SCOPE=https://www.googleapis.com/auth/calendar.events`.
  Scope запрашивается только при `POST /api/integrations/google/oauth/start` с телом
  `{ "access": "write" }` (инкрементальная авторизация, `include_granted_scopes=true`). Запрошенный access хранится
  в `google_oauth_states.requested_access`.
- `web_user_integrations.google_granted_scopes` — scope, фактически выданные Google (из ответа token/refresh;
  при повторном согласии заменяется полным набором). `google_calendar_write_enabled` (по умолчанию `false`) —
  пользовательский переключатель; включение через `PUT /api/settings/user` `{ googleCalendarWriteEnabled: true }`
  возвращает 409 `google_write_scope_missing`, если Google не подключён или scope записи не выдан.
- `POST /api/integrations/google/disconnect` сбрасывает токены, `google_granted_scopes` и `google_calendar_write_enabled`.
- Callback добавляет `&scope_write=granted|missing` только если был запрошен `access=write`. Если после обмена кода
  scope записи не выдан, `google_calendar_write_enabled` сбрасывается в `false`. Сервер не знает email Google-аккаунта,
  поэтому при смене Google-аккаунта флаг не сбрасывается автоматически, пока новый аккаунт выдал scope записи
  (переподключение с другим аккаунтом оставляет флаг включённым и события пойдут в календарь нового аккаунта).

### Запись событий: outbox, содержимое, повторы

- Запись включается только если у веб-пользователя специалиста `google_calendar_write_enabled = true` и в
  `google_granted_scopes` есть scope записи. Проверка делается при постановке в очередь (один запрос) и повторно при
  обработке; при выключенной настройке строки upsert в очереди не создаются. Исключение: delete с известным
  `google_event_id` обходит проверку при постановке в очередь (иначе события не удалялись бы после выключения), а при
  обработке пропускается без обращения к Google, если флаг или scope уже сняты.
- Весь Google I/O выполняет только сервер (job `googleCalendarSync.job.ts`, интервал 30 с). Сервер и бот лишь
  вставляют строку в таблицу `google_calendar_sync_queue` (бот пишет напрямую в общую БД, Google и OAuth-токенов
  не касается). Постановка в очередь не бросает ошибок и не блокирует операцию с записью на приём.
- Очередь: `account_id`, `appointment_id` (без FK, чтобы delete пережил удаление приёма), `action` (`upsert|delete`),
  `status` (`pending|processing|done|failed`), снимок `google_event_id` + `web_user_id`, `attempts`,
  `next_attempt_at`, `locked_until` (lease для `FOR UPDATE SKIP LOCKED`), `last_error_status` (только HTTP-код/причина).
  Уникальный частичный индекс по `appointment_id WHERE status='pending'` даёт коалесинг: повторный upsert обновляет
  существующую pending-строку, delete вытесняет upsert.
- `appointments.google_event_id` / `google_event_web_user_id` — id события и чей календарь его содержит (PATCH/DELETE идут
  с правами владельца события, даже если специалист приёма потом сменился; тогда событие удаляется у прежнего владельца
  и создаётся у нового). Календарь всегда `primary`, `google_calendar_id` игнорируется.
- Поведение: создание → `POST events` с `extendedProperties.private.appointmentId`; перенос/изменение → `PATCH`
  (если событие удалено в Google, 404/410, создаётся заново); отмена, автоотмена неоплаченных, отмена клиентом,
  отмена из Zoom-вебхука и из бота → `DELETE` (404/410 считаются успехом). Серия «Repeat» — отдельная строка и
  отдельное событие на каждый приём, без RRULE, обрабатывается последовательно с небольшой паузой.
- Содержимое события (минимизация): `summary` = название услуги (иначе «Appointment»), `start`/`end` с IANA
  `timeZone` специалиста, `location` = адрес (если есть), `description` = ссылка на встречу (если есть). Не передаются
  имя клиента, телефон, email, заметки, Telegram username; участников нет, всегда `sendUpdates=none`.
- Ретраи: 401 → один refresh токена и повтор; 403/408/429/5xx/сеть → повтор с экспоненциальной паузой
  (1, 2, 4, 8 мин, максимум 1 ч), после 5 попыток строка получает `failed`; прочие 4xx → `failed` сразу. Если флаг или
  scope к моменту обработки сняты, строка закрывается без обращения к Google. Токены и содержимое событий не логируются
  (только account_id, appointment_id, action, HTTP-статус). Завершённые строки удаляются через 14 дней.
- Создание идемпотентно: в `POST events` передаётся детерминированный `id` (`sm` + base32hex от account_id и
  appointment_id), HTTP 409 трактуется как «событие уже создано» и ведёт к `PATCH` того же id. Так повтор после сбоя
  записи id в БД не плодит дубликаты. Если событие было удалено в Google, новое создаётся с id следующего «поколения».
  Завершение строки очереди (`done/retry/failed`) выполняется только пока строка в `processing` с тем же lease, поэтому
  воркер с истёкшим lease не перезаписывает заново взятую строку.
- Выключение настройки и отключение Google (`/disconnect`) НЕ удаляют уже созданные события. Позже отменить их
  нельзя (нет валидных учётных данных), поэтому оставшееся событие продолжит отображаться занятым в freeBusy.
  Включение флага не создаёт события для уже существующих будущих приёмов (backfill нет), только для новых/изменённых.
- Постановка в очередь при изменении приёма — best-effort и не атомарна с коммитом обновления (сверки/reconciliation
  нет): при сбое постановки событие может остаться неактуальным. Пропускная способность обработки ≈ 40 событий в минуту.
- Удаление пользователя/специалиста/клиента/аккаунта (`deletionService`): до физического удаления приёмов сервер
  best-effort удаляет их события в Google (пока токены ещё есть); ошибки логируются и удаление не блокируют.
- Бот больше не обращается к Google: ни запись, ни чтение занятости. Слоты в боте не учитывают занятость из Google
  Calendar (публичное веб-бронирование учитывает её через freeBusy). Прежнее чтение через events.list в боте и так
  было сломано: колонка `google_api_key` удалена миграцией 20260915140000, а токен использовался как API key.

## Ротация ключа

Формальной автоматизированной процедуры ротации `APP_ENCRYPTION_KEY` пока нет. Ручная процедура:

1. Сгенерировать новый ключ.
2. Расшифровать все текущие значения `*_encrypted` колонок старым ключом, зашифровать новым — по аналогии
   со скриптом бэкфилла в `20260915130000_backfill_encrypt_web_user_integration_secrets.ts` (прочитать все
   строки `web_user_integrations`, перешифровать, записать).
3. Обновить `APP_ENCRYPTION_KEY` в окружении деплоя только после успешного прогона перешифровки —
   иначе действующие токены станут нечитаемыми (`Unable to decrypt encrypted ...`), и пользователям
   потребуется заново подключать интеграции.
4. Задокументировать факт ротации (дата, кто выполнял) в рамках инцидент-/security-процесса.

Следующий шаг для доведения до production-готовности — автоматизировать шаг 2 отдельным
maintenance-скриптом с поддержкой double-key (старый+новый) на время ротации, чтобы не требовать
простоя.

## Известный смежный технический долг

Отдельная (более старая) таблица `user_integrations` (`server/src/repositories/userIntegrationRepository.ts`,
используется в `settingsService.ts` как legacy-источник для чекбоксов `googleConnected`/`telegramBotConnected`)
всё ещё содержит plaintext-колонки `google_api_key`, `google_refresh_token`, `telegram_bot_token`. Код больше
не пишет туда секреты в открытом виде (см. комментарий в `updateUserTelegramIntegration`), но исторические
значения могли остаться. Эта таблица не входит в объём данной миграции — требует отдельного аудита/очистки.
