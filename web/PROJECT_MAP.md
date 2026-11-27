# PROJECT_MAP: web

React 19 SPA на React Router, MUI, shared API/auth/i18n/theme и локальных MobX stores.

- `src/app/` — bootstrap и routing.
- `src/pages/` — auth, appointments, settings, logs и public flows.
- `src/containers/` — data loading и orchestration.
- `src/components/` — UI и layouts; `components/agent/AgentAssistant.tsx` — AI-ассистент настройки (drawer из `MainLayout`: чат со стримингом, вложения фото/PDF со сжатием на клиенте, чек-лист настройки), `components/agent/agentAttachments.ts` — подготовка вложений.
- `src/features/public-page-builder/` — Public Page domain/model/repository.
- `src/shared/` — API client, auth, i18n, theme, types и UI kit; `shared/api/agent.ts` — API ассистента (`/api/agent/*`: SSE-чат, история, подтверждение действий, setup-status).
- `tests/unit/` — runtime unit tests.
- `tests/e2e/*.test.mjs` — быстрые source-contract checks.
- `tests/e2e/ui/` — browser E2E.

Основные flows:

1. Auth/register/invite.
2. Role-aware cabinet для `product_admin`, `owner`, `specialist`, `client`.
3. Appointments и create-only recurrence.
4. Settings (tabs: Account, Online booking, Notifications, Integrations, Profile; System for product_admin), integrations, client notifications; main-menu pages `/payments` (owner) and `/days-off` (owner, specialist).
5. AI setup assistant (`AgentAssistant`): чат, вложения, чек-лист шагов настройки, подтверждение предложенных изменений.
6. Public booking `/:slug/booking` и status `/:slug/appointment-status`.

Backend contracts находятся под `/api/*`; Public Pages используют `/api/public-pages/*`.
