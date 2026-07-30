# Web (`@scheduletm/web`)

React SPA для `product_owner`, tenant `owner`, `admin`, `specialist` и `client`.

## Возможности

- Auth/register/invite/verify flows.
- Role-aware navigation и direct-route guards.
- Appointments lifecycle и create-only recurrence `daily`/`weekly`.
- Users, specialists, settings, integrations и operational logs.
- Locale/timezone только в User settings.
- Client self notification settings.
- Specialist `defaultMeetingLink`.
- Public Page Builder с API persistence, templates, preview, autosave и publish conflict recovery.
- Public `/:slug`.
- Public booking `/:slug/booking`:
  - specialist/service query preselection;
  - single-option auto-select;
  - browser timezone без отдельного поля;
  - server-authoritative availability validation.
- Public appointment status `/:slug/appointment-status` без client PII.

## Команды

```bash
npm run -w @scheduletm/web typecheck
npm run -w @scheduletm/web lint
npm run -w @scheduletm/web test:unit
npm run -w @scheduletm/web test:e2e:contracts
npm run -w @scheduletm/web build
npm run -w @scheduletm/web dev
```

Iteration-1 admin browser E2E and the remaining iteration-2 backlog are tracked
only in [`tests/e2e/TODO.md`](./tests/e2e/TODO.md).

## Документация

- [`PROJECT_MAP.md`](./PROJECT_MAP.md)
- [`../docs/public-page-builder/README.md`](../docs/public-page-builder/README.md)
- [`../PRODUCTION_READINESS_CHECKLIST.md`](../PRODUCTION_READINESS_CHECKLIST.md)
