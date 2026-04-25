# Settings rework plan (final recommendations)

Документ фиксирует целевую модель настроек для MVP без лишнего усложнения архитектуры.

---

## 1) Общая структура настроек

Разделяем настройки на 3 уровня:

1. `system_settings` — глобальные системные настройки (только `owner`)
2. `account_settings` — настройки аккаунта (`owner`, `admin`)
3. `user_settings` — персональные настройки пользователя

Дополнительно:

* `specialist_settings` — настройки специалиста (прайс, расписание, дефолтное продолжение сессии)
* `specialist_booking_policies` — правила бронирования
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

## 3) Миграция `app_settings` → `account_settings`

План:

1. Создать `account_settings`
2. Скопировать данные из `app_settings`
3. Перевести сервисы
4. Оставить `app_settings` на 1 релиз
5. Удалить в cleanup

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

---

### 5.2 `account_notification_defaults`

* `account_id`
* `notification_type`
* `channel`
* `enabled`
* `send_timing`
* `frequency`

---

### 5.3 `specialist_notification_settings`

* `account_id`
* `specialist_id`
* `notification_type`
* `channel`
* `enabled`
* `send_timing`
* `frequency`

Смысл: когда отправлять клиентам

---

### 5.4 `client_notification_settings`

* `account_id`
* `client_id`
* `notification_type`
* `channel`
* `enabled`

Смысл: получать или нет

---

### 5.5 Effective логика

```text
send if:

(specialist OR account default)
AND
(client != disabled)
```

---

## 6) `specialist_booking_policies`

* `account_id`
* `specialist_id` (unique)
* `cancel_grace_period_hours` (default 24)
* `refund_on_late_cancel`
* `auto_cancel_if_unpaid`
* `unpaid_auto_cancel_after_minutes`

---

## 7) Логика бронирования (MVP)

### Отмена

* < grace period AND no refund → не возвращаем
* иначе → обычный возврат

---

### Авто-отмена

* если включено → планируем job
* если не оплачено → `cancelled (auto_cancel_unpaid)`

---

### Edge cases

* только `pending`
* идемпотентность
* проверка статуса перед отменой

---

### Статусы

```text
pending
confirmed
cancelled
```

---

## 8) RBAC

### Все

* `user_settings`
* `client_notification_settings`

---

### owner / admin / specialist

* `specialist_notification_settings`
* `specialist_booking_policies`
* `user_integrations`

---

### owner / admin

* `account_settings`
* `account_notification_defaults`

---

### owner

* `system_settings`

---

## 9) Что хранить в `system_settings`

Только runtime-настройки без секретов:

* auth TTL
* email sender
* security limits

Google OAuth параметры и секреты храним только на уровне `.env` (не в таблицах настроек):

```env
GOOGLE_OAUTH_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your_google_client_secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3003/api/integrations/google/oauth/callback
```

---

## 10) Что хранить в `user_settings`

* timezone
* locale
* UI настройки
* quiet hours

НЕ хранить:

* API ключи → в `user_integrations`

---

## 11) Рекомендуемый порядок внедрения

1. `account_settings`
2. `system_settings`
3. `specialist_settings`
4. `notification tables`
5. `booking_policies`
6. cleanup

---

## 12) Ограничения MVP

* без сложной иерархии
* без лишних абстракций
* простая override-модель
* поэтапные миграции

---

## 13) Практичные улучшения (необязательно сразу)

### account_settings

* booking horizon
* минимальное время до записи
* дефолты нотификаций

---

### user_settings

* date/time format
* week start
* notification language

---

### specialist_booking_policies

* prepayment
* reschedule rules

---

## 14) UX нотификаций

* показать: "унаследовано / переопределено"
* presets: minimal / standard / verbose
* тестовое уведомление

---

## 15) Минимальный MVP-пакет

1. cancel rules
2. auto cancel unpaid
3. notifications (account + override)
4. user UI settings
5. inheritance UI
