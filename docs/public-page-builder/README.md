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
- Management API ограничен account scope и ролями `product_admin`/`owner`.
- Public lookup отдаёт только published snapshot активного аккаунта.
- Slug нормализуется, глобально уникален и является каноническим public identity.
- Revision/`expectedRevision` защищают от stale writes.
- Web использует `ApiPublicPageRepository`; localStorage/local repository fallback отсутствует.
- Preview и public page используют один renderer.
- Документ versioned и проходит normalize/migrate/validate.

## Расширенный дизайн, архив и расписание

Strict schema v3 сохраняет настройки в существующих `theme.tokens` и `theme.styleDefaults`.
Новые страницы используют Roboto; размеры шрифтов вводятся и выводятся в rem, а числовые
значения документа сохраняют прежний масштаб (16 = 1rem). Палитра сохраняет пользовательскую
типографику и оформление кнопок; сброс применяется к выбранной группе настроек.

Кнопка поддерживает подзаголовок, отдельное оформление через `design.linkStyle`, открытие
URL в новой вкладке и ограниченную анимацию pulse/lift с учётом reduced motion.
Nullable настройки блока наследуют значения секции и страницы.

`archivedBlocks` хранится только в draft вместе с исходным `sourceSectionId`. Архивирование
и восстановление поддерживают Undo/Redo; пустая исходная секция удаляется, а восстановление
идёт в конец существующей исходной секции либо в конец страницы. Конфликт активной социальной
сети оставляет блок в архиве. Draft/history сохраняют ссылки на media архива; публичный snapshot
исключает архив и используемые только им media.

`schedule.period` задаёт UTC-интервал со включённым началом и исключённым концом;
`schedule.weekdays` независимо ограничивает дни ISO 1–7. `timezone` фиксируется из настроек
аккаунта при создании страницы и сохраняется при её редактировании. Некорректные и неоднозначные
локальные времена при переходе DST отклоняются. Редактор показывает блок вне расписания с меткой,
а preview/public меняют видимость на границе периода или локальных суток без перезагрузки.
Будущие блоки сохраняются в опубликованном snapshot.

Перед запуском v3 требуется forward-only migration
`20260910160000_migrate_public_pages_to_schema_v3.ts`. Она преобразует draft/published отдельно,
сохраняет идентификаторы и метаданные, переносит старые цвета кнопок в overrides и фиксирует
ранее отображаемые радиусы. Наличие файла миграции не означает, что она применена к базе.

Strict schema v4 добавляет обязательную позицию кадра профильной фотографии в
`profile.avatarPosition`. Значение хранится как две целые координаты от 0 до 100 в
каноническом формате `X% Y%`; `50% 50%` означает центр. Forward-only migration
`20260910180000_migrate_public_pages_to_schema_v4.ts` атомарно обновляет draft и непустой
published snapshot, не изменяя остальные данные документа. Наличие файла migration не
означает, что она применена к базе.

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
- `PUT /api/public-pages/:id/draft`
- `POST /api/public-pages/:id/publish`
- archive/delete endpoints текущего route contract.

Public endpoints:

- `GET /api/public-pages/by-slug/:slug`
- `GET /api/public-pages/by-slug/:slug/booking-options`
- `POST /api/public-pages/by-slug/:slug/appointments`
- `GET /api/public-pages/by-slug/:slug/appointments/:appointmentId/status?accessCode=...` — `accessCode` — высокоэнтропийный код, выданный клиенту при бронировании (см. `POST .../appointments` response `accessCode`).

## Booking

- Возвращаются только active account-scoped specialists/services.
- Query `specialist`/`service` выполняет preselection; единственный вариант выбирается автоматически.
- Гость указывает имя/фамилию и минимум email или телефон.
- Browser timezone отправляется автоматически; backend использует timezone специалиста как fallback.
- Backend проверяет прошедшее время, рабочие дни/часы, slot step, внешний календарь и DB overlap.
- Slot policy errors возвращаются как стабильные `slot_unavailable`/`slot_conflict`.
- Начало записи должно попадать точно на минуту: ненулевые секунды и миллисекунды отклоняются без округления.
- POST записи ограничен 10 запросами в минуту на IP; превышение возвращает 429 и `Retry-After`. `app.set('trust proxy', 1)` в `src/app.ts` доверяет первому хопу reverse proxy, так что `req.ip` — реальный IP клиента, а не адрес proxy.
- После создания выполняется обычное уведомление `appointment_created` с учётом настроек и отказов клиента. Ошибка доставки не отменяет созданную запись.
- Public lookup (`GET /by-slug/:slug`, 60/мин), media serving (`GET /media/:mediaId/content`, 120/мин) и booking options (`GET /by-slug/:slug/booking-options`, 60/мин) также ограничены per-IP; превышение возвращает 429 и `Retry-After`.
- Лимиты хранятся в Redis (`REDIS_URL`), что даёт корректный подсчёт при нескольких инстансах сервера; без `REDIS_URL` используется in-process Map (верно только для одного инстанса). При недоступности Redis лимитер fail-open (пропускает запрос и логирует ошибку), а не тихо переключается на локальный счётчик.

## Public status privacy

Status endpoint использует appointment id и фамилию специалиста, rate limit и `Cache-Control: no-store`. Wrong verifier и missing appointment неразличимы (`404`). Client names, contacts, notes, payment и internal account/client/user IDs не возвращаются.

Фамилия специалиста доступна публично и не является секретом. Замена этого verifier и выбор владельца Zoom-интеграции для гостевой записи остаются незакрытыми контрактами перед выпуском.

## Проверки

- Server schemas/service/repository/route unit и smoke tests.
- Web source-contract tests.
- Runtime unit tests normalize/migrate/corrupted documents и undo/redo.
- TypeScript и ESLint.

Неприменённые migrations и runtime browser/PostgreSQL smoke не считаются выполненными автоматически. Открытые задачи: [`TODO.md`](./TODO.md).

## Railway media storage

Для production используется Railway Storage Bucket, а не файловая система deployment. Bucket остаётся private:
публичная страница получает изображение через backend, когда media присутствует в published snapshot или используется активной услугой того же активного аккаунта; редактор
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

Create/save/publish проверяют в транзакции существование media, принадлежность аккаунту и канонический URL.
Гонка с удалением и восстановление после частичного сбоя S3/БД требуют отдельного изменения lifecycle; текущая проверка ссылок не делает эти операции атомарными.

Railway Volume для этого flow не требуется. Обычный deployment disk эфемерен, а Volume ограничивает сервис одной
репликой; Storage Bucket лучше соответствует пользовательским media и горизонтальному масштабированию API.
