# Meeting providers

Этот документ фиксирует текущий продуктовый контракт. Новые providers не входят
в production MVP без отдельного продуктового решения; общий backlog находится в
[`../TODO.md`](../TODO.md).

## Реализовано

- Поддерживаемые provider values: `manual`, `zoom`, `yandex_telemost`, `offline`.
- Specialist booking policy хранит allowed providers и priority.
- Explicit link конкретной встречи имеет высший приоритет.
- При выборе Zoom или Yandex Telemost backend создаёт встречу через OAuth integration **специалиста** (`specialists.user_id`), а не пользователя, создающего запись.
- Если провайдер не подключён или создание не удалось, берётся следующий кандидат (preferred клиента → priority политики специалиста); явный `offline` остаётся offline.
- Приоритет: explicit appointment link → успешный Zoom/Telemost link → specialist default link → offline address.
- Явный `offline` не заменяется default link.
- Meeting provider/link/location возвращаются appointment API и privacy-safe public status.
- Поведение provider fallback покрыто unit-тестами.

## Хранение metadata

Meeting metadata хранятся в колонках `appointments.meeting_link`, `appointments.meeting_provider` и `appointments.location_address` (миграция `20260919120000`). Допустимые значения `meeting_provider` и `clients.preferred_meeting_provider` ограничены CHECK-констрейнтами (расширены миграцией `20261018090000` значением `yandex_telemost`). Id Zoom-встречи хранится в `appointments.zoom_meeting_id`; для Telemost отдельного поля у встречи нет, последний id/ссылка лежат в `web_user_integrations.yandex_last_meeting_id/yandex_last_join_url`.

## Отложено

- Google Meet (enum расширяем, но значение пока не добавлено), Outlook/Teams, iCal и другие providers.
- Provider-specific retry/idempotency за пределами текущего Zoom flow.

Дополнительные providers добавляются только после отдельного продуктового выбора; текущая реализация намеренно не создаёт неработающие placeholders.
