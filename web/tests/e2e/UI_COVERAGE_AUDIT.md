# UI Integration Coverage Audit (as of 2026-04-29)

## Current coverage (Playwright UI e2e)

Covered by real browser integration tests in `web/tests/e2e/ui/*.spec.mjs`:

- Navigation and role-aware menu visibility for `owner/admin/specialist/client`.
- Access control for direct URL opens (`/specialists`, `/notification-logs`, `/error-logs`).
- Session logout from profile menu.
- Public auth routes: `/login` ↔ `/register` screen switch; invalid invite states on `/invite/accept` and `/verify-email` without token/email.
- Settings tabs visibility by role (`System settings`, `Account settings`).
- Users flow for owner: create → edit → deactivate.

## Current gaps (high priority)

1. **Auth UI flow is only partially covered via browser interactions**
   - Covered: screen switching `/login` ↔ `/register`, invalid invite states for `/invite/accept` and `/verify-email` without token/email.
   - Missing: form submission/validation errors for `/login`, full `/register` happy/negative flows, OTP UX (autofocus/paste/resend cooldown).

2. **Appointments UI workflows are not covered end-to-end**
   - No UI e2e that clicks through create/edit/cancel/reschedule/mark-paid/notify in calendar.
   - No UI e2e for late-cancel policy UX (refund vs no-refund confirmation text in actual UI).
   - No UI e2e for role-based filter set visibility on Appointments page.

3. **Specialists management UI behavior is not covered**
   - Missing owner/admin positive CRUD flows for specialists.
   - Missing specialist/client negative-path checks in specialist management interactions (not only page-level denial).

4. **Settings form behavior is mostly uncovered**
   - Only tab visibility is checked.
   - No save/update tests for user/system/account/notification/specialist policy tabs.
   - No validation and optimistic/pessimistic UI feedback checks for settings forms.

5. **Notification logs page functionality is not covered**
   - No UI e2e for filters (`account/specialist/user`) and table rendering.
   - No UI e2e for retry action availability by status and retry execution result.

6. **Users RBAC positive/negative matrix is incomplete**
   - Positive CRUD is only verified for owner.
   - No explicit admin/specialist/client create/edit/deactivate permission matrix at action level.

7. **Localization/theme UI checks are not covered**
   - No UI e2e for ru/en switching and key user-visible strings.
   - No UI e2e for theme mode/palette changes persistence.

## Medium-priority gaps

- Error logs page: only owner navigation/admin deny covered; missing rendering/filters/details checks.
- Router deep-link behavior for protected pages under expired session.
- Cross-page smoke for empty/loading/error UI states.

## Recommended next test additions (order)

1. `auth.ui.e2e.spec.mjs`
   - login success/failure + validation
   - invite accept + verify-email OTP flow

2. `appointments.ui.e2e.spec.mjs`
   - create/edit/cancel/reschedule/mark-paid/notify
   - late-cancel refund/no-refund messaging
   - role-based filters visibility matrix

3. `settings-forms.ui.e2e.spec.mjs`
   - save flows for key settings tabs
   - validation and toast/error checks

4. `notification-logs.ui.e2e.spec.mjs`
   - filters + retry action by status

5. Extend existing suites
   - `users.ui.e2e.spec.mjs`: admin/specialist/client action-level permissions
   - `access-control.ui.e2e.spec.mjs`: deeper assertions for denied actions, not only page text

## Notes on existing contract/smoke tests

The fast `node:test` suites (`web.integration.e2e.test.mjs`, `smoke.e2e.test.mjs`) validate source-level contracts and route/API usage patterns, but they do not replace browser UI interaction coverage for form/input/click/state behavior.

## Negative scenarios coverage to add

Add explicit browser-level negative-path checks across key modules:

- Auth: invalid credentials, weak password, password mismatch, expired/invalid OTP, resend failures.
- Appointments: invalid reschedule slot, cancel/mark-paid/notify API failures, forbidden actions by role.
- Settings: validation errors, failed save requests, disabled actions for non-permitted roles.
- Specialists/Users: forbidden CRUD actions, backend validation errors, conflict errors.
- Notification logs: retry failures and unavailable retry action for non-retriable statuses.

These scenarios should be added as separate test cases (or dedicated `*.negative.ui.e2e.spec.mjs` suites) to keep intent and failure diagnostics clear.
