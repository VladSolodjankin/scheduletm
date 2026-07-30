# Public Page Builder

Public Page Builder реализован как server-authoritative full-stack feature.

## Архитектура

- PostgreSQL хранит draft и published snapshots.
- Management API ограничен account scope и ролями `product_owner`/`owner`/`admin`.
- Public lookup отдаёт только published snapshot активного аккаунта.
- Slug нормализуется, глобально уникален и является каноническим public identity.
- Revision/`expectedRevision` защищают от stale writes.
- Web использует `ApiPublicPageRepository`; localStorage/local repository fallback отсутствует.
- Preview и public page используют один renderer.
- Документ versioned и проходит normalize/migrate/validate.

## Маршруты web

- `/public-pages`
- `/public-pages/new`
- `/public-pages/:profileId/edit`
- `/:slug`
- `/:slug/booking`
- `/:slug/appointment-status`

Specific public routes объявлены раньше generic `/:slug`.

## API

Management endpoints требуют access token:

- `GET /api/public-pages`
- `POST /api/public-pages`
- `GET /api/public-pages/:id`
- `PATCH /api/public-pages/:id`
- `POST /api/public-pages/:id/publish`
- archive/delete endpoints текущего route contract.

Public endpoints:

- `GET /api/public-pages/by-slug/:slug`
- `GET /api/public-pages/by-slug/:slug/booking-options`
- `POST /api/public-pages/by-slug/:slug/appointments`
- `GET /api/public-pages/by-slug/:slug/appointments/:appointmentId/status?specialistLastName=...`

## Booking

- Возвращаются только active account-scoped specialists/services.
- Query `specialist`/`service` выполняет preselection; единственный вариант выбирается автоматически.
- Гость указывает имя/фамилию и минимум email или телефон.
- Browser timezone отправляется автоматически; backend использует timezone специалиста как fallback.
- Backend проверяет прошедшее время, рабочие дни/часы, slot step, внешний календарь и DB overlap.
- Slot policy errors возвращаются как стабильные `slot_unavailable`/`slot_conflict`.

## Public status privacy

Status endpoint использует appointment id и фамилию специалиста, rate limit и `Cache-Control: no-store`. Wrong verifier и missing appointment неразличимы (`404`). Client names, contacts, notes, payment и internal account/client/user IDs не возвращаются.

## Проверки

- Server schemas/service/repository/route unit и smoke tests.
- Web source-contract tests.
- Runtime unit tests normalize/migrate/corrupted documents и undo/redo.
- TypeScript и ESLint.

Неприменённые migrations и runtime browser/PostgreSQL smoke не считаются выполненными автоматически. Открытые задачи: [`TODO.md`](./TODO.md).
