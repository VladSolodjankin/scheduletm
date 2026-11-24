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

Отзывы добавляются владельцем вручную и принадлежат аккаунту, а не странице.
Они хранятся в таблице `account_reviews` и работают вживую, без draft/publish:
изменения сразу видны на опубликованных страницах. Блок `reviews` в документе
страницы хранит только настройки (`title`, `showSummary`, `autoplay`), сами
отзывы туда не копируются. Публичные данные отдаёт
`GET /api/public-pages/by-slug/:slug/reviews` (только `published`, со средним
рейтингом и количеством). Скриншот отзыва необязателен и публично доступен,
пока отзыв опубликован. Лимит — 30 отзывов на аккаунт. Значение
`source='client'` зарезервировано для будущих отзывов от клиентов.

Блок `credentials` (дипломы и сертификаты, до 10 элементов: изображение, alt,
название, организация, год; PDF не поддерживаются) хранится в JSON документа
страницы.

## Архитектура

- PostgreSQL хранит draft и published snapshots.
- Management API ограничен account scope и ролями `product_admin`/`owner`.
- Public lookup отдаёт только published snapshot активного аккаунта.
- Slug нормализуется, глобально уникален и является каноническим public identity.
- Revision/`expectedRevision` защищают от stale writes.
- Web использует `ApiPublicPageRepository`; localStorage/local repository fallback отсутствует.
- Preview и public page используют один renderer.
- Документ versioned и проходит normalize/migrate/validate.

## Раскладка: ширина страницы, размеры блоков и кнопки (schema v6)

- `theme.pageWidth` (`narrow` 720px, `medium` 960px, `wide` 1200px) задаёт максимальную ширину страницы и одинаково
  применяется в редакторе и на публичной странице.
- Страница и каждая «стилизованная» секция — 12-колоночная лента (`display: grid`). У каждого блока и у секции есть
  `size`: `full` или `half`; элементы текут слева направо и переносятся на следующий ряд. Секции `variant: 'off'` —
  прозрачные группы (`display: contents`): их блоки участвуют в ленте страницы напрямую. Новые размеры (`third`,
  `quarter`) добавляются значением `size` без миграции данных.
- Адаптивность построена на container queries: две колонки включаются, когда контейнер (страница или секция) не уже
  600px. Мобильный вид всегда 100%, поэтому превью устройств в редакторе совпадает с публичной страницей.
- Кнопки: `linkStyle.width` (`full`/`auto`) и `linkStyle.align` (`left`/`center`/`right`) задаются в теме и могут быть
  переопределены на секции и блоке (`null` — наследование).
- `services.layout`: `carousel`, `grid` или `list`.
- Размер блока и секции меняется иконками в hover-панели элемента. Перетаскивание реализовано на `@dnd-kit/core`
  (`BuilderDnd.tsx`): индикатор показывает, перед или после целевого элемента встанет блок.
- Forward-only migration `20261110090000_migrate_public_pages_to_schema_v6.ts` заменяет `section.layout` на размеры:
  многоколоночные раскладки становятся блоками `half`, остальные — `full`.

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

Strict schema v4 добавлял позицию кадра профильной фотографии; профиль удалён в schema v7 (ниже).

## Настройки страницы и профиль (schema v7)

Всё, что видит посетитель, строится из секций и блоков: отдельного «профиля» (имя, описание, логотип,
фото) больше нет. Фото и имя владельца — блок «Знакомство», логотип — блок «Картинка».
Forward-only migration `20261118090000_migrate_public_pages_to_schema_v7.ts` удаляет `profile` из
draft и published и убирает media, на которые ссылался только профиль.

Все настройки лежат в одном диалоге «Настройки»: стиль (палитра, шрифты, скругление, кнопки,
ширина, отступы между блоками, фон) и «Адрес и поиск» (slug, заголовок и описание для поиска,
картинка для превью ссылки). Кнопки мессенджеров по умолчанию в фирменных цветах
(`theme.styleDefaults.socialButtonColors`: `brand` или `theme`).

Отступы построены на золотом сечении: `--page-space-1…5` = 10/16/26/42/68px, шкала шрифтов
13/16/20/26/42. Между секциями всегда 42px, внутри группы 16px, заголовок и подпись прижаты
к тексту на 10px.

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

## Общий пакет, язык, аналитика, SEO и домены (schema v8)

- `shared/` (`@scheduletm/shared`) — единственное описание документа страницы (Zod-схема, типы, проверки публикации,
  разбор ссылок на видео, события аналитики, домены). Сервер и веб импортируют его; пакет собирается в `shared/dist`
  командой `npm run -w @scheduletm/shared build` (запускается автоматически при `npm install`).
- `locale` документа (`ru` | `en`) — язык публичных строк страницы; берётся из языка интерфейса владельца при создании,
  меняется в «Настройки → Адрес и поиск». Рендерер оборачивает страницу в `LocaleScope`.
- Новые блоки: `price-list`, `steps`, `stats`, `hours`, `video` (только https YouTube/Vimeo).
- Статистика: `POST /api/public-pages/by-slug/:slug/events` (просмотр/клик, без cookie), `GET /api/public-pages/:id/analytics?days=7|30|90`,
  страница `/public-pages/:id/analytics`.
- SEO: `web/server.mjs` отдаёт SPA и подставляет `<head>` страницы (title, description, canonical, Open Graph), `robots.txt`, `sitemap.xml`.
  Читает `VITE_API_URL` и `VITE_PUBLIC_PAGE_ORIGIN` из окружения.
- Собственный домен: `/api/public-pages/:id/domain` (+ `/verify`), проверка по DNS (домен резолвится в те же адреса, что и хост приложения),
  `web/server.mjs` находит страницу по `Host`. Сертификат для домена должен выпустить хостинг.
- Снимки шаблонов: `public-page-templates.visual.mock.ui.e2e.spec.mjs` (`E2E_BROWSER_CHANNEL=chrome` запускает установленный Chrome);
  базовые снимки платформозависимы (`*-win32.png`).
