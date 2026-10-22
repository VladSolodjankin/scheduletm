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

## Google Calendar: scopes, запись событий и названия занятости

- Единое согласие «Подключить Google» (`POST /api/integrations/google/oauth/start`, тело не принимается) запрашивает
  базовые scope `openid`, `userinfo.email`, `calendar.freebusy` (`GOOGLE_OAUTH_SCOPES` переопределяет список) И scope
  записи `GOOGLE_OAUTH_WRITE_SCOPE` (по умолчанию `calendar.events.owned`), `include_granted_scopes=true`. Если в Google
  Console нет `calendar.events.owned`, запасной вариант — `GOOGLE_OAUTH_WRITE_SCOPE=https://www.googleapis.com/auth/calendar.events`.
  Scope `calendar.events` и `calendar` лишь распознаются как scope записи, но сами не запрашиваются.
- Пользовательского переключателя записи нет. Запись событий в Google включается автоматически, если Google
  фактически выдал scope записи (`web_user_integrations.google_granted_scopes`, из ответа token/refresh) и токен есть.
  Синхронизируются приёмы в любом статусе; отменённый приём → удаление события.
- Если при гранулярном согласии пользователь снял галочку записи, подключение считается неудачным: callback очищает
  токены и `google_granted_scopes` (как `/disconnect`) и редиректит на `${APP_URL}/settings?google_oauth=error&reason=calendar_write_required`.
  Успех — `${APP_URL}/settings?google_oauth=success`. Состояния «подключено без записи» нет.
- `POST /api/integrations/google/disconnect` сбрасывает токены и `google_granted_scopes`.
- Занятость: `POST https://www.googleapis.com/calendar/v3/freeBusy` (календарь `primary`) — для публичного бронирования,
  расчёта слотов и всех, кроме владельца аккаунта; без названий и email организаторов.
- Названия занятости только владельцу: в `GET /api/appointments` (календарь приёмов) каждый внешний слот `busySlots[]`
  получает необязательное поле `title`, только если запрашивает веб-пользователь, чей Google-аккаунт подключён
  (`specialists.user_id` = запрашивающий). Для владельца-админа, смотрящего чужих специалистов, админов, клиентов и
  публичного бронирования `title` не отдаётся. Источник — `events.list` (`primary`, `singleEvents=true`) на видимый
  диапазон, запрос выполняется вживую при каждом обращении; `calendar.events.owned` входит в список scope
  `events.list` (документация Google), но покрывает только события, где пользователь — организатор. Кэша, хранения и
  логирования названий нет. Исключаются события, созданные Meetli (`extendedProperties.private.appointmentId`),
  `status=cancelled`, `transparency=transparent` и отклонённые пользователем; события на весь день (`start.date`)
  превращаются в блок на сутки в часовом поясе пользователя. Если `events.list` не сработал, отдаются обычные блоки
  freeBusy без `title` (в лог пишется только статус).


### Запись событий: outbox, содержимое, повторы

- Запись включается только если у веб-пользователя специалиста есть токен и в `google_granted_scopes` есть scope
  записи. Проверка делается при постановке в очередь (один запрос; бот предфильтрует по непустым токену и
  `google_granted_scopes`) и повторно сервером при обработке; без Google-подключения строки upsert в очереди не
  создаются. Исключение: delete с известным `google_event_id` обходит проверку при постановке в очередь, а при
  обработке пропускается без обращения к Google, если токена или scope уже нет.
- Весь Google I/O выполняет только сервер (job `googleCalendarSync.job.ts`). Сервер и бот лишь
  вставляют строку в таблицу `google_calendar_sync_queue` (бот пишет напрямую в общую БД, Google и OAuth-токенов
  не касается). После успешной постановки в очередь сервер через ~0,75 с (после коммита транзакции) запускает
  проход job немедленно, поэтому событие появляется в Google Calendar через секунду-две после изменения приёма.
  Интервальный job (10 с) — страховка для повторных попыток и приёмов, созданных ботом. Постановка в очередь не бросает ошибок и не блокирует операцию с записью на приём.
- Очередь: `account_id`, `appointment_id` (без FK, чтобы delete пережил удаление приёма), `action` (`upsert|delete`),
  `status` (`pending|processing|done|failed`), снимок `google_event_id` + `web_user_id`, `attempts`,
  `next_attempt_at`, `locked_until` (lease для `FOR UPDATE SKIP LOCKED`), `last_error_status` (только HTTP-код/причина).
  Уникальный частичный индекс по `appointment_id WHERE status='pending'` даёт коалесинг: повторный upsert обновляет
  существующую pending-строку, delete вытесняет upsert.
- `appointments.google_event_id` / `google_event_web_user_id` — id события и чей календарь его содержит (PATCH/DELETE идут
  с правами владельца события, даже если специалист приёма потом сменился; тогда событие удаляется у прежнего владельца
  и создаётся у нового). Календарь всегда `primary`.
- Поведение: создание → `POST events` с `extendedProperties.private.appointmentId`; перенос/изменение → `PATCH`
  (если событие удалено в Google, 404/410, создаётся заново); отмена, автоотмена неоплаченных, отмена клиентом,
  отмена из Zoom-вебхука и из бота → `DELETE` (404/410 считаются успехом). Серия «Repeat» — отдельная строка и
  отдельное событие на каждый приём, без RRULE, обрабатывается последовательно с небольшой паузой.
- Содержимое события (минимизация): `summary` = название услуги (иначе «Appointment»), `start`/`end` с IANA
  `timeZone` специалиста, `location` = адрес (если есть), `description` = ссылка на встречу (если есть). Не передаются
  имя клиента, телефон, email, заметки, Telegram username; участников нет, всегда `sendUpdates=none`.
- Ретраи: 401 → один refresh токена и повтор; 403/408/429/5xx/сеть → повтор с экспоненциальной паузой
  (1, 2, 4, 8 мин, максимум 1 ч), после 5 попыток строка получает `failed`; прочие 4xx → `failed` сразу. Если токен или
  scope к моменту обработки сняты, строка закрывается без обращения к Google. Токены и содержимое событий не логируются
  (только account_id, appointment_id, action, HTTP-статус). Завершённые строки удаляются через 14 дней.
- Создание идемпотентно: в `POST events` передаётся детерминированный `id` (`sm` + base32hex от account_id и
  appointment_id), HTTP 409 трактуется как «событие уже создано» и ведёт к `PATCH` того же id. Так повтор после сбоя
  записи id в БД не плодит дубликаты. Если событие было удалено в Google, новое создаётся с id следующего «поколения».
  Завершение строки очереди (`done/retry/failed`) выполняется только пока строка в `processing` с тем же lease, поэтому
  воркер с истёкшим lease не перезаписывает заново взятую строку.
- Отключение Google (`/disconnect`) или неудачное подключение НЕ удаляют уже созданные события. Позже отменить их
  нельзя (нет валидных учётных данных), поэтому оставшееся событие продолжит отображаться занятым в freeBusy.
  Подключение не создаёт события для уже существующих будущих приёмов (backfill нет), только для новых/изменённых.
- Постановка в очередь при изменении приёма — best-effort и не атомарна с коммитом обновления (сверки/reconciliation
  нет): при сбое постановки событие может остаться неактуальным. Пропускная способность обработки ≈ 40 событий в минуту.
- Удаление пользователя/специалиста/клиента/аккаунта (`deletionService`): до физического удаления приёмов сервер
  best-effort удаляет их события в Google (пока токены ещё есть); ошибки логируются и удаление не блокируют.
- Бот не обращается к Google: он только ставит строки в `google_calendar_sync_queue`. Слоты в боте не учитывают занятость из
  Google Calendar (публичное веб-бронирование учитывает её через freeBusy).

### Диагностика

Все строки лога синхронизации начинаются с префикса `[googleCalendarSync]` (бот — `[googleCalendarSync][bot]`) и
содержат только id, действие, HTTP-статус и фиксированный код причины (без названий, email, токенов, тел ответов).
Проход без работы ничего не пишет.

- `job started intervalMs=<n>` — job зарегистрирован при старте сервера.
- `not queued appointment=<id> account=<id> action=<a> skip=<код>` — строка в очередь не поставлена. Коды:
  `no_specialist_id`, `no_specialist`, `specialist_has_no_web_user`, `no_integration_row`, `no_access_token`,
  `write_scope_missing` (бот: `no_google_connection`).
- `queued appointment=<id> action=<upsert|delete>` — строка поставлена в очередь.
- `done appointment=<id> action=<a> event=created|updated|deleted` — событие в Google синхронизировано.
- `skipped appointment=<id> action=<a> reason=<код>` — обработка пропущена без обращения к Google. Коды:
  `appointment_missing`, `specialist_has_no_web_user`, `no_integration_row`, `no_access_token`,
  `write_scope_missing`, `no_event_reference`.
- `retry|failed appointment=<id> action=<a> status=<HTTP-код или причина> attempt=<n>` — ошибка; `retry` — будет
  повтор, `failed` — строка закрыта.

Если при создании приёма нет ни `queued`, ни `not queued`, постановка в очередь вообще не вызывалась (или запрос упал
с `enqueue failed`).

## Платёжные секреты (Payment setup)

- `account_payment_providers.secret_encrypted` хранит YooKassa secret key и BOG client secret; шифрование
  `integrationSecretCrypto` (AES-256-GCM, `APP_ENCRYPTION_KEY`), plaintext-колонок нет. Секреты не возвращаются API
  (только `hasSecret`), не логируются; пустой secret при повторном сохранении оставляет прежний.
- Stripe (Standard connected account): токен подключённого аккаунта не хранится, в `config_json` лежит только
  `accountId` (`acct_...`); платежи идут платформенным `STRIPE_SECRET_KEY` + заголовок `Stripe-Account`.
  Платформенные env: `STRIPE_CLIENT_ID`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_OAUTH_REDIRECT_URI` (secret-хранилище деплоя).
- Токены ссылок на оплату (`appointment_payment_tokens`) и per-account токены вебхуков (`webhook_token_hash`) хранятся
  только как SHA-256. URL вебхука выводится детерминированно из `APP_ENCRYPTION_KEY` и id аккаунта; при ротации ключа
  URL меняются (переподключите провайдера и обновите URL в кабинете провайдера).
- При ротации `APP_ENCRYPTION_KEY` колонку `account_payment_providers.secret_encrypted` нужно перешифровать так же, как остальные `*_encrypted`.

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
