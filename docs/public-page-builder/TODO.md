# Public Page Builder: актуальный TODO

## Реализовано

- [x] PostgreSQL storage, account isolation и forward-only migration.
- [x] Draft/published snapshots, revision concurrency и conflict recovery.
- [x] Глобально уникальный нормализованный slug и public lookup.
- [x] Server quotas, validation, payload limit и JSON errors.
- [x] Production API repository без localStorage/local repository fallback.
- [x] List/create/edit/duplicate/archive/delete flows.
- [x] Templates, themes, sections, blocks, preview и shared renderer.
- [x] Autosave, manual save, bounded undo/redo и stale-request protection.
- [x] Publish validation, safe CTA/media URL rules и unknown-block fallback.
- [x] Публичный booking route, options и appointment creation по текущему slug.
- [x] Specialist/service query preselection и single-option auto-select.
- [x] Browser timezone, server fallback, schedule/calendar/overlap validation.
- [x] Публичный appointment status без client PII.
- [x] Server unit/smoke tests, source-contract tests и runtime model tests.

## Приоритет: production-ready `/:slug`

- [x] Добавить обязательные logo/specialist photo controls с загрузкой, заменой и удалением.
- [x] Добавить custom background image для всей страницы и отдельного блока.
- [ ] Подготовить не менее 10 встроенных фоновых изображений.
- [x] Добавить настройку page font из ограниченного набора production-safe шрифтов.
- [x] Добавить page-level цвета текста и фона, сохранив готовые темы и defaults.
- [x] Сохранить block-level цвета текста и фона и добавить background image/overlay.
- [ ] Довести UX блоков description, services/prices, contacts, socials и messengers.
- [x] Подготовить стартовый шаблон для одного специалиста.
- [ ] Проверить полный flow: create → design → upload → save → publish → public mobile/desktop view.

## Перед выпуском

- [ ] Применить Public Pages и связанные migrations на целевой PostgreSQL.
- [ ] Проверить repository/migrations на чистой PostgreSQL.
- [ ] Выполнить runtime smoke: create → save → publish → public view → booking → status → archive → delete.
- [ ] Проверить два параллельных редактора и `revision_conflict`.
- [ ] Выполнить production web build и browser responsive/accessibility smoke.

## Следующий этап: E2E

- [ ] Public Page management lifecycle is implemented in browser iteration 1;
  booking, status, RBAC, conflict, and accessibility work remains in the
  canonical [`web/tests/e2e/TODO.md`](../../web/tests/e2e/TODO.md).

## Следующий этап: media

Для ближайшего коммерческого этапа обязательны logo/specialist photo, cover/hero,
фон страницы и фон отдельного блока. Галерея и расширенное управление изображениями
не блокируют первый production release.

- [x] Account-owned media records и object storage.
- [x] Upload API с MIME, размером и проверкой фактического формата.
- [x] Image decoding/validation, безопасные UUID-ключи и lifecycle удаления.
- [x] File picker, draft preview, replace/remove.
- [ ] Logo/avatar/Hero/gallery/background media controls.
- [ ] Cover/contain, focal point, overlay и aspect-ratio guidance.

## Улучшения редактора

- [ ] Keyboard reorder с доступными объявлениями позиции.
- [ ] Компактные mobile-вкладки редактора.
- [ ] Preview карточек шаблонов.
- [ ] Contrast/color guidance.
- [ ] Typography/spacing/radius/border presets.
- [ ] Проверка доступности slug до сохранения и предупреждение о смене опубликованного slug.
- [ ] Focus/scroll к конкретной publish validation error.
- [ ] Runtime tests API repository/autosave concurrency.

## Отзывы: отдельный последующий этап

- [ ] Добавить account-scoped таблицу отзывов и административное управление записями.
- [ ] Не добавлять клиентскую отправку отзывов на этом этапе; публичная страница только читает опубликованные отзывы.
- [ ] Выбрать и реализовать renderer: секция со скриншотами и/или стилизованные chat bubbles.
- [ ] Добавить управление порядком, видимостью и привязкой отзывов к публичной странице.

## Отложено

- [ ] Redirect старого slug и временное резервирование.
- [ ] Saved themes/presets, analytics и conversions.
- [ ] Custom domains и тарифные quotas.
- [ ] A/B testing и scheduled publishing.
- [ ] Безопасные add-ons/integrations.
