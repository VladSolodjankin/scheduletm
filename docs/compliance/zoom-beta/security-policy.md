# Security Policy

Effective date: 2026-05-03

This Security Policy describes the baseline security controls and operating practices used for Meetli and the Zoom Beta integration workflow.

This document is intended for public review. It is written to reflect the current production-intended control posture in this repository and should be read together with:

- `security-policy-access-control.md`
- `security-policy-vulnerability-management.md`
- `security-policy-incident-response.md`

## 1. Scope

This policy covers the Meetli web application, backend API, supporting scheduling workflows, notification processing, account/session management, and user-authorized Zoom meeting integration.

## 2. Security Principles

Meetli is operated according to the following principles:

- Least privilege.
- Separation of tenant data by account scope.
- Defense in depth across authentication, transport, application logic, and operations.
- Secure-by-default session and integration handling.
- Measured logging and auditability for security-relevant actions.
- Continuous hardening based on scan findings, code review, and operational feedback.

## 3. Access Control

Meetli uses role-based access control with the roles `owner`, `admin`, `specialist`, and `client`.

- `owner` has the highest administrative scope, including system-level settings.
- `admin` manages account-level operations.
- `specialist` has limited operational access to assigned workflows.
- `client` access is restricted to the client's own profile and appointments.

Application authorization is enforced centrally in backend policy logic and route guards. Sensitive management actions require an authenticated access token, and key account/session flows are further protected with CSRF validation.

Additional access-control details are documented in `security-policy-access-control.md`.

## 4. Authentication and Session Security

Meetli currently uses:

- Password-based authentication with PBKDF2 password hashing and per-user salts.
- Email verification during onboarding.
- Invite acceptance flows with one-time verification tokens and 24-hour validity.
- Short-lived access tokens stored server-side in the session table.
- Refresh tokens issued via cookies with rotation on refresh.
- CSRF protection for refresh and logout endpoints using a double-submit token pattern.
- Login abuse protection with temporary lockouts after repeated failed authentication attempts.

Default timing values in the current implementation are:

- Access token lifetime: 15 minutes.
- Refresh token lifetime: 30 days.
- Login lockout after repeated failures: 15 minutes.

## 5. Network and Application Protections

Meetli applies:

- TLS for production-intended deployments.
- HTTP security headers via `helmet`.
- CORS origin allowlisting for approved frontend origins.
- Suppression of framework-identifying headers.
- Request logging that excludes query strings in standard access logs to reduce accidental logging of OAuth codes and other sensitive URL parameters.
- Input validation on API routes using schema validation.

## 6. Data Protection Controls

Meetli limits data access using account scoping, role-based authorization, and operational access controls.

- Passwords are not stored in plaintext.
- Some system-level alerting secrets are encrypted at the application layer before database storage.
- Session and integration records are stored in restricted backend tables and are intended to be protected by infrastructure and database access controls.
- Not all integration secrets currently use uniform application-layer field encryption. This area is tracked as an ongoing hardening concern and should not be overstated in customer-facing claims.

## 7. Logging, Monitoring, and Auditability

Meetli maintains security-relevant operational records that include:

- Appointment event history.
- Session state and token revocation behavior.
- Login attempt tracking.
- Notification processing outcomes.
- Error logs for web and server failures with a 7-day retention window.

Error logs can be routed to Telegram operational alerts when configured. Error logging is intended for service reliability and incident response, not for customer profiling.

## 8. Third-Party Integrations

Meetli integrates with third parties only where needed for product functionality. For Zoom:

- A user must explicitly authorize Zoom OAuth.
- Zoom credentials are stored only to support the requested integration.
- Zoom meetings are created on behalf of the connected user through backend-only API calls.
- Users can disconnect Zoom, which clears stored Zoom integration credentials from the application database.

## 9. Deletion and Credential Removal

Meetli is designed to support administrator-initiated removal of accounts and user access with attention to associated credentials and integration data.

- Account deletion requests can be scheduled with a 10-day reconsideration window before the scheduled deletion date, and the request may be cancelled during that period by an authorized administrator.
- The intended scope of permanent account deletion includes account-scoped data, user records, appointments, specialists, services, stored passwords, and related credentials associated with that account.
- Specialist and client users can initiate self-service deletion of their own account profile. That workflow schedules permanent deletion after 10 days and allows cancellation before the scheduled deletion date.
- In the current implemented user-management flow, deleting a managed user revokes that user's access immediately and removes the deleted user from standard user-management views.
- Administrative user deletion does not by itself guarantee immediate removal of all related business records such as appointments; those records may remain until separately removed or until an account-level deletion workflow is completed.

## 10. Secure Development and Change Management

Meetli uses code review, repository-based change tracking, security scanning artifacts, and documented evidence under `docs/compliance/zoom-beta/` to support the Zoom Beta review process.

Security validation activities include:

- SAST and dependency review.
- DAST baseline testing on staging.
- TLS verification evidence.
- Documented remediation tracking for discovered findings.

## 11. Incident and Vulnerability Response

Meetli maintains separate documented procedures for:

- Vulnerability intake, triage, remediation, and verification in `security-policy-vulnerability-management.md`.
- Incident detection, escalation, containment, recovery, and post-incident review in `security-policy-incident-response.md`.

## 12. Limitations and Transparency

This policy describes the current intended control posture. It is not a certification statement and should not be interpreted as a claim that every control is fully mature or fully automated in every environment. Where evidence or hardening work remains in progress, Meetli tracks that work separately and aims to avoid making unsupported security claims.
