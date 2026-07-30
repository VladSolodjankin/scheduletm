# Meeting providers: текущее состояние

## Реализовано

- Поддерживаемые provider values: `manual`, `zoom`, `offline`.
- Specialist booking policy хранит allowed providers и priority.
- Explicit link конкретной встречи имеет высший приоритет.
- При выборе Zoom backend создаёт Zoom meeting через OAuth integration.
- Specialist settings содержат optional `defaultMeetingLink`.
- Приоритет: explicit appointment link → успешный Zoom link → specialist default link → offline address.
- Явный `offline` не заменяется default link.
- Meeting provider/link/location возвращаются appointment API и privacy-safe public status.
- Поведение provider fallback покрыто unit-тестами.

## Техническое ограничение

Текущие meeting metadata сохраняются совместимо с существующей схемой appointment notes. Отдельная нормализованная migration возможна позже, но не требуется для текущего простого contract.

## Отложено

- Google Meet, Outlook/Teams, iCal и другие providers.
- Provider-specific retry/idempotency за пределами текущего Zoom flow.
- Нормализация старых appointment notes в отдельные columns.

Дополнительные providers добавляются только после отдельного продуктового выбора; текущая реализация намеренно не создаёт неработающие placeholders.
