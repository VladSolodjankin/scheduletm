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

- [ ] Account-owned media records и object storage.
- [ ] Upload API с MIME, размером и проверкой фактического формата.
- [ ] Image processing, безопасные имена и lifecycle удаления.
- [ ] Picker/drag-and-drop, preview, replace/remove.
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

## Отложено

- [ ] Redirect старого slug и временное резервирование.
- [ ] Saved themes/presets, analytics и conversions.
- [ ] Custom domains и тарифные quotas.
- [ ] A/B testing и scheduled publishing.
- [ ] Безопасные add-ons/integrations.
