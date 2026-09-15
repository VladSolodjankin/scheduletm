# Web browser E2E

Canonical status and backlog for Playwright browser coverage.

## Iteration 1: admin on a real environment

Run with `E2E_BASE_URL`, explicit `E2E_API_URL`, `E2E_ADMIN_EMAIL`, and
`E2E_ADMIN_PASSWORD`. Credentials must belong to an `admin`; missing variables
and role mismatches fail the run. Use a dedicated test account and database.

- [x] Real UI login, persisted session, protected-route redirect, and logout.
- [ ] Public Pages create/save/publish/view/archive/delete with cleanup is
  implemented; live verification remains.
- [x] Update `public-page-builder.ui.e2e.spec.mjs` from inline Services
  title/description/price inputs to the catalog-backed service picker with a
  seeded account service; verify the rendered catalog card and booking CTA.
- [ ] Add a repeatable fixture with at least two selectable services and verify
  carousel dots, keyboard navigation, swipe, reduced-motion behavior, and
  optional autoplay in a live browser run.
- [ ] Extend the Public Pages lifecycle browser flow with restore, compact
  mobile editor navigation, contrast guidance states, and mobile/desktop
  public rendering before treating the current source coverage as a release
  smoke.
- [ ] Specialist schedule update and restore is implemented; live verification
  remains.
- [ ] Appointments create/edit/reschedule/cancel. The calendar cells and
  appointment cards have no accessible names, so a stable locator cannot yet be
  expressed without a small product accessibility change.
- [ ] Specialist create/edit/deactivate/restore/soft-delete. Current soft-delete
  keeps the user assigned, so a repeatable test requires a resettable fixture or
  an explicit test-only cleanup contract.

The iteration-1 spec is additive and does not run remote/destructive tests
unless explicitly invoked.

## Iteration 2

- [ ] Roles and tenant isolation: `product_admin`, `owner`,
  `specialist`, and `client`, including direct URL and API denial.
- [ ] Auth register, OTP/resend, invite, refresh, and password recovery.
- [ ] Users create/edit/deactivate/delete/resend invite/default meeting link.
- [ ] Settings: system/account/user, locale/timezone, notifications, and
  integrations.
- [ ] Appointment recurrence, atomic slot conflicts, cancellation policy, and notification.
- [ ] Public Page slug conflicts and concurrent editors.
- [ ] Public booking selection/defaults and schedule/calendar/overlap conflicts.
- [ ] Public status privacy, wrong verifier, missing appointment, rate limit,
  and no-store.
- [ ] Negative UX, retry/recovery, accessibility, keyboard, and responsive
  coverage.
