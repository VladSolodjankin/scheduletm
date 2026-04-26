# Settings rework plan (final recommendations)

Документ фиксирует целевую модель настроек для MVP без лишнего усложнения архитектуры.

## Статус итерации (2026-04-26)

### ✅ Уже сделано в этой итерации

1. Начата реализация `specialist_booking_policies`:
   - серверные endpoints чтения/обновления правил;
   - серверная валидация payload;
   - отдельная таблица и repository для правил.
2. На фронте добавлена отдельная вкладка настроек правил бронирования специалиста.
3. В bot логика редактирования/отмены начала учитывать `cancel_grace_period_hours`.
4. Тестовое покрытие для `specialist_booking_policies`:
   - frontend: интеграционный smoke-контракт для загрузки/сохранения и UI-полей;
   - backend: unit-тесты схемы/доступов и route-smoke для `GET/PUT /api/settings/specialist-booking-policy`.

### ⏭️ Следующая итерация

1. Настройки оповещений (`account_notification_defaults`, `specialist_notification_settings`, `client_notification_settings`).
2. Авто-отмена неоплаченных записей через scheduler/jobs.
3. Полная сквозная UX-поддержка последствий поздней отмены (refund/no-refund) в web и bot.

---

## 1) Общая структура настроек

Разделяем настройки на 3 уровня:

1. `system_settings` — глобальные системные настройки (только `owner`)
2. `account_settings` — настройки аккаунта (`owner`, `admin`)
3. `user_settings` — персональные настройки пользователя

Дополнительно:

* `specialist_settings` — настройки специалиста (прайс, расписание, дефолтная длительность)
* `specialist_booking_policies` — правила бронирования/отмены
* `account_notification_defaults` — дефолты нотификаций
* `specialist_notification_settings` — логика отправки
* `client_notification_settings` — логика получения
* `user_integrations` — внешние интеграции

---

## 2) Целевые таблицы

1. `user_settings`
2. `user_integrations`
3. `account_notification_defaults`
4. `specialist_notification_settings`
5. `client_notification_settings`
6. `specialist_booking_policies`
7. `account_settings`
8. `system_settings`
9. `specialist_settings`

---

## 3) Миграция `app_settings` → `account_settings` и `user_settings`

План:

1. Создать `account_settings` и расширить `user_settings`
2. Скопировать данные из `app_settings` в новые таблицы по зоне ответственности
3. Перевести сервисы и API на новые источники
4. Оставить `app_settings` read-only на 1 релиз (fallback)
5. Удалить `app_settings` в cleanup

Принцип разбиения:

* account-level (TTL, брендовые/организационные дефолты, общие флаги) → `account_settings`
* user-level (timezone, locale, UI, персональные интеграции) → `user_settings` / `user_integrations`

---

## 4) `specialist_settings`

Выносим из `specialists`:

* `base_session_price`
* `base_hour_price`
* `work_start_hour`
* `work_end_hour`
* `slot_duration_min`
* `slot_step_min`
* `default_session_continuation_min`

Структура:

* `id`
* `account_id`
* `specialist_id` (unique)
* поля выше
* `created_at`
* `updated_at`

---

## 5) Нотификации

### 5.1 Уровни

1. Account — дефолт
2. Specialist — управляет отправкой
3. Client — управляет получением

### 5.2 `account_notification_defaults`

* `account_id`
* `notification_type`
* `channel`
* `enabled`
* `send_timing`
* `frequency`

### 5.3 `specialist_notification_settings`

* `account_id`
* `specialist_id`
* `notification_type`
* `channel`
* `enabled`
* `send_timing`
* `frequency`

Смысл: когда отправлять клиентам.

### 5.4 `client_notification_settings`

* `account_id`
* `client_id`
* `notification_type`
* `channel`
* `enabled`

Смысл: получать или нет.

### 5.5 Effective-логика

```text
send if:

(specialist OR account default)
AND
(client != disabled)
```

---

## 6) `specialist_booking_policies`

### 6.1 Поля (MVP)

* `account_id`
* `specialist_id` (unique)
* `cancel_grace_period_hours` (default `24`)
* `refund_on_late_cancel` (default `false`)
* `auto_cancel_unpaid_enabled` (default `false`)
* `unpaid_auto_cancel_after_hours` (default `72`)
* `created_at`
* `updated_at`

### 6.2 Что улучшили относительно исходной идеи

1. Единое именование (`auto_cancel_unpaid_enabled`) вместо длинных вариаций — проще читать в коде и API.
2. `unpaid_auto_cancel_after_hours` применяется **от времени создания** appointment (`created_at + N hours`).
3. Если оплата пришла до job — отмена не выполняется (идемпотентная проверка в момент job).

### 6.3 Опционально (не в MVP, но совместимо)

* `min_advance_booking_hours` — минимальное время до начала слота для записи.
* `max_advance_booking_days` — максимальный горизонт записи.
* `reschedule_grace_period_hours` — отдельное окно для переноса.

---

## 7) Логика бронирования (MVP)

### 7.1 Отмена клиентом

* если до старта `< cancel_grace_period_hours` и `refund_on_late_cancel = false` → без возврата
* иначе → обычный возврат

### 7.2 Авто-отмена за неоплату

* если `auto_cancel_unpaid_enabled = true` → при создании `pending` записи планируем job
* в момент job: если запись всё ещё `pending` и не оплачена → `cancelled (auto_cancel_unpaid)`

### 7.3 Edge cases

* обрабатываем только `pending`
* идемпотентность job
* проверка статуса и факта оплаты перед отменой
* аудит причины отмены (`cancel_reason = auto_cancel_unpaid`)

### 7.4 Минимальные статусы

```text
pending
confirmed
cancelled
```

---

## 8) Поддержка на фронте и в bot

### 8.1 Frontend

Сделать отдельную страницу настроек: `Specialist booking policies`:

* форма полей из `specialist_booking_policies`
* валидация (целые числа, диапазоны, зависимые поля)
* локализованные тексты (`ru/en`) и подсказки
* optimistic/pessimistic save + обработка ошибок API

Плюс полная поддержка ограничений в UX:

* в календаре/создании записи предупреждать о правилах отмены
* при отмене показывать, будет ли возврат
* при создании `pending` показывать дедлайн авто-отмены неоплаченной записи

### 8.2 Bot

Полная поддержка этих же ограничений:

* перед подтверждением записи показывать правило отмены и дедлайн оплаты
* при команде отмены — то же правило возврата (как в web)
* сценарий авто-отмены: корректное клиентское сообщение о причине
* все пользовательские сообщения через локали бота

### 8.3 Единый доменный контракт

Чтобы web и bot не расходились:

* один server use-case/resolver для вычисления `effective booking policy`
* один server use-case для решения `refund allowed?`
* один server use-case для `should auto-cancel unpaid?`

---

## 9) Сервисы: что добавить/обновить

### 9.1 Новые сервисы

* `BookingPolicyService` (CRUD + effective-policy)
* `BookingPolicyEvaluator` (refund/auto-cancel decision)
* `UnpaidAutoCancelScheduler` (schedule/revoke/execute jobs)

### 9.2 Что обновить

* `AppointmentService`:
  * create: планирование job
  * cancel: применение refund policy
  * mark-paid: отмена/деактивация job
* `NotificationService`:
  * шаблонные сообщения об авто-отмене и политике
* bot appointment handlers:
  * чтение effective-policy и единый текстовый вывод

---

## 10) RBAC

### Все

* `user_settings`
* `client_notification_settings`

### owner / admin / specialist

* `specialist_notification_settings`
* `specialist_booking_policies`
* `user_integrations`

### owner / admin

* `account_settings`
* `account_notification_defaults`

### owner

* `system_settings`

---

## 11) Что хранить в `system_settings`

Только runtime-настройки без секретов:

* `REFRESH_TOKEN_TTL_DAYS`
* `ACCESS_TOKEN_TTL_SECONDS`
* `SESSION_COOKIE_NAME`
* email sender defaults
* rate/security limits

Google OAuth параметры и секреты хранить только в `.env`:

```env
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=...
```

---

## 12) Что хранить в `user_settings`

* timezone
* locale
* UI настройки
* quiet hours

Не хранить секреты/API keys: их место в `user_integrations`.

---

## 13) Порядок внедрения (коротко)

1. DB migration + DTO + server services.
2. API endpoints + RBAC + tests.
3. Web settings page + локали + интеграция в appointment UX.
4. Bot flow update + локали.
5. Фоновый job авто-отмены + наблюдаемость (логи/метрики).
6. Cleanup legacy (`app_settings`) после стабилизации.

---

## 14) Рекомендации по упрощению

1. **Не делать отдельные политики на уровне account в MVP** — только specialist-level + fallback default в коде.
2. **Оставить только 2 обязательных ограничения в MVP**: late-cancel refund и auto-cancel unpaid.
3. **Единый вычислитель политик на сервере** (web и bot лишь отображают результат).
4. **Без сложного rule-engine**: простые boolean + numeric поля.
5. **Расширять через новые nullable-поля/enum**, не ломая текущий контракт.
