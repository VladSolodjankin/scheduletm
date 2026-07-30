# PROJECT_MAP: web

React 19 SPA на React Router, MUI, shared API/auth/i18n/theme и локальных MobX stores.

- `src/app/` — bootstrap и routing.
- `src/pages/` — auth, appointments, settings, logs и public flows.
- `src/containers/` — data loading и orchestration.
- `src/components/` — UI и layouts.
- `src/features/public-page-builder/` — Public Page domain/model/repository.
- `src/shared/` — API client, auth, i18n, theme, types и UI kit.
- `tests/unit/` — runtime unit tests.
- `tests/e2e/*.test.mjs` — быстрые source-contract checks.
- `tests/e2e/ui/` — browser E2E.

Основные flows:

1. Auth/register/invite.
2. Role-aware cabinet для `product_owner`, `owner`, `admin`, `specialist`, `client`.
3. Appointments и create-only recurrence.
4. Settings, integrations, client notifications и specialist default meeting link.
5. Public Page management и public `/:slug`.
6. Public booking `/:slug/booking` и status `/:slug/appointment-status`.

Backend contracts находятся под `/api/*`; Public Pages используют `/api/public-pages/*`.
