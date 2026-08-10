# Public Page Builder

Public Page Builder реализован как server-authoritative full-stack feature.

## Ближайшая продуктовая цель

Приоритет ближайшего коммерческого этапа — production-ready публичная страница
`/:slug`, которую один специалист может оформить и опубликовать без разработки.

Обязательный scope этапа:

- логотип и/или фотография специалиста с загрузкой файла;
- собственное фоновое изображение страницы и отдельных блоков;
- не менее 10 встроенных фоновых изображений, доступных без загрузки;
- настройка шрифта, цвета текста и цвета фона страницы и блоков;
- готовые темы и безопасные значения по умолчанию;
- блоки описания, услуг и цен, контактов, социальных сетей и мессенджеров;
- responsive preview и корректная публичная страница на mobile/desktop;
- server-owned media storage с проверкой формата, размера и account scope.

Отзывы не входят в этот этап. В будущем они хранятся в отдельной таблице и
только отображаются на публичной странице: клиенты пока не могут оставлять их
через продукт. Возможные варианты renderer — секция со скриншотами отзывов или
стилизованные chat bubbles.

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

## Railway media storage

Для production используется Railway Storage Bucket, а не файловая система deployment. Bucket остаётся private:
публичная страница получает изображение через backend только когда media присутствует в published snapshot; редактор
загружает draft preview через authenticated endpoint.

Настройка Railway:

1. Создать Storage Bucket в том же project/environment.
2. Передать API service credentials Bucket через variable references.
3. Задать `AWS_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
   `AWS_S3_BUCKET_NAME` и `AWS_DEFAULT_REGION` (для Railway обычно `auto`).
4. Проверить, что `API_BASE_URL` содержит публичный HTTPS URL API.
5. Применить migration `20260810120000_create_public_page_media.ts`.

Upload принимает только JPEG/PNG/WebP до 5 MiB. Backend декодирует файл, сверяет формат, ограничивает изображение
размером 12000x12000 px, создаёт безопасный UUID object key и сохраняет account-owned metadata в PostgreSQL.
Удаление выполняется после сохранения draft; если старый published snapshot ещё использует файл, редактор повторяет
удаление после публикации новой версии.

Railway Volume для этого flow не требуется. Обычный deployment disk эфемерен, а Volume ограничивает сервис одной
репликой; Storage Bucket лучше соответствует пользовательским media и горизонтальному масштабированию API.
