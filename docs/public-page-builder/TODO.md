# Public Page Builder: актуальный TODO

## Реализовано

- [x] PostgreSQL storage, account isolation и forward-only migration.
- [x] Draft/published snapshots, revision concurrency и conflict recovery.
- [x] Глобально уникальный нормализованный slug и public lookup.
- [x] Server quotas, validation, payload limit и JSON errors.
- [x] Production API repository без localStorage/local repository fallback.
- [x] List/create/edit/duplicate/archive/restore/delete flows.
- [x] Единый env-backed origin для отображения, копирования и открытия публичных URL.
- [x] Templates, themes, sections, blocks, preview и shared renderer.
- [x] Autosave, manual save, bounded undo/redo и stale-request protection.
- [x] Publish validation, safe CTA/media URL rules и unknown-block fallback.
- [x] Публичный booking route, options и appointment creation по текущему slug.
- [x] Specialist/service query preselection и single-option auto-select.
- [x] Browser timezone, server fallback, schedule/calendar/overlap validation.
- [x] Публичный appointment status без client PII.
- [x] Canonical URL и Open Graph metadata для публичной страницы; canonical строится по env-backed origin и нормализованному slug.
- [x] Перевести документы на strict schema v2 и удалить runtime-поддержку Hero, inline Services, Contacts URL и внешних media URL.
- [x] Server unit/smoke tests, source-contract tests и runtime model tests.

## Приоритет: production-ready `/:slug`

- [x] Добавить обязательные logo/specialist photo controls с загрузкой, заменой и удалением.
- [x] Добавить custom background image для всей страницы и отдельного блока.
- [x] Подготовить не менее 10 встроенных фоновых изображений.
- [x] Добавить настройку page font из ограниченного набора production-safe шрифтов.
- [x] Добавить page-level цвета текста и фона, сохранив готовые темы и defaults.
- [x] Сохранить block-level цвета текста и фона и добавить background image/overlay.
- [x] Реализовать UX блоков description (rich text), catalog services/prices, contacts и отдельных branded social/messenger buttons.
- [ ] Проверить эти блоки в живом browser flow: keyboard/mobile editing, длинный контент, пустые/error states и визуальную согласованность. Анонимный mobile/desktop renderer и Contacts actions уже проверены на изолированном стенде.
- [x] Подготовить стартовый шаблон для одного специалиста.
- [ ] Проверить полный flow: create → design → upload → save → publish → public mobile/desktop view.

## Перед выпуском

- [ ] Применить Public Pages и связанные migrations на целевой PostgreSQL.
- [x] Проверить repository/migrations на чистой PostgreSQL (63 migrations; unmanaged/stale media останавливает и откатывает migration, безопасная v1 fixture преобразуется в strict v2; remediation tests 184/184). Полный server suite: 386/389, ещё 3 несвязанных `business.integration` заблокированы таймаутом внешней БД.
- [ ] Выполнить полный HTTP/browser runtime smoke: create → save → publish → public view → booking → status → archive → restore → archive → delete. PostgreSQL repository lifecycle уже пройден.
- [ ] Проверить два живых параллельных редактора; repository `revision_conflict` и hook concurrency уже покрыты runtime-проверками.
- [x] Выполнить production web build.
- [x] Разделить leaf routes на lazy chunks; public routes не входят в preload, entry bundle уменьшен до ~520 kB (~165 kB gzip).
- [ ] Выполнить browser responsive/accessibility smoke. Responsive smoke анонимного renderer уже пройден; editor и accessibility остаются.

## Следующий этап: E2E

- [ ] Public Page management lifecycle is implemented in browser iteration 1;
  booking, status, RBAC, conflict, and accessibility work remains in the
  canonical [`web/tests/e2e/TODO.md`](../../web/tests/e2e/TODO.md).

## Следующий этап: media

Для ближайшего коммерческого этапа обязательны logo/specialist photo и Avatar cover,
фон страницы и фон отдельного блока. Галерея и расширенное управление изображениями
не блокируют первый production release.

- [x] Account-owned media records и object storage.
- [x] Upload API с MIME, размером и проверкой фактического формата.
- [x] Image decoding/validation, безопасные UUID-ключи и lifecycle удаления.
- [x] File picker, draft preview, replace/remove.
- [x] Logo/avatar/Avatar cover/image/gallery и page/section/block background media controls для актуального набора блоков.
- [x] Cover/contain и focal point для custom page/block backgrounds; overlay для block backgrounds.
- [x] Удалить старый Hero block/editor; для новых страниц используется только Avatar с managed media.

## Улучшения редактора

- [x] Keyboard reorder с доступными объявлениями позиции.
- [x] Компактная mobile-навигация редактора и полноэкранные панели настроек.
- [x] Preview карточек шаблонов.
- [ ] Завершить advisory WCAG contrast guidance: базовые heading/body/link проверки готовы, но перед закрытием нужны Map, first-session-free на service cards и отображение пограничных ratio без округления вверх.
- [ ] Проверить в браузере contrast на image/gradient backgrounds, rich-text цветах, nested cards, hover/focus состояниях и нетекстовых элементах.
- [x] Page typography/rounding/link-style presets и section/block typography/spacing/radius/border controls.
- [ ] По browser comparison решить, нужны ли отдельные one-click combined design presets сверх текущих controls.
- [x] Проверка доступности slug до сохранения и предупреждение о смене опубликованного slug.
- [x] Focus/scroll к конкретной publish validation error.
- [x] Runtime tests API repository/autosave concurrency.

## Отзывы: отдельный последующий этап

- [ ] Добавить account-scoped таблицу отзывов и административное управление записями.
- [ ] Не добавлять клиентскую отправку отзывов на этом этапе; публичная страница только читает опубликованные отзывы.
- [ ] Выбрать и реализовать renderer: секция со скриншотами и/или стилизованные chat bubbles.
- [ ] Добавить управление порядком, видимостью и привязкой отзывов к публичной странице.

## Отложено

- [ ] Добавить SSR/prerender/server-generated head, если для social unfurls и поисковых роботов требуется metadata до выполнения JavaScript.
- [ ] Redirect старого slug и временное резервирование.
- [ ] Saved themes/presets, analytics и conversions.
- [ ] Custom domains и тарифные quotas.
- [ ] A/B testing и scheduled publishing.
- [ ] Безопасные add-ons/integrations.
