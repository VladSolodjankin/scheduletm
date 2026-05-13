# Privacy Policy

Effective date: 2026-05-03

This Privacy Policy describes how Meetli processes personal data when customers, team members, and clients use the Meetli web application, scheduling workflows, notifications, and optional third-party integrations.

This document is intended for public access. It summarizes the current production-intended behavior of the application as implemented in this repository. It does not grant contractual rights beyond applicable law or separate written agreements.

## 1. Scope

This policy applies to:

- Meetli account registration, sign-in, and session management.
- User and client profile management.
- Appointment scheduling, rescheduling, cancellation, and reminders.
- Optional third-party integrations used by the customer, including Zoom OAuth and Zoom meeting creation.
- Operational security logging related to the service.

## 2. Categories of Personal Data

Depending on how the service is used, Meetli may process:

- Account and user identity data, such as first name, last name, email address, phone number, Telegram username, timezone, locale, and role.
- Client record data, such as contact details and client-to-specialist/account relationships.
- Appointment data, such as service details, scheduled date and time, specialist, payment status, meeting provider, and meeting link.
- Integration data, such as whether Google or Zoom is connected, token expiry metadata, and the most recent Zoom meeting identifiers and URLs created through the service.
- Notification data, such as delivery channel, recipient email or Telegram destination, delivery status, retry status, and message payload metadata.
- Security and audit data, such as login attempts, session records, appointment event history, and error logs.
- Technical request data, such as IP-based anti-abuse signals, request path, browser-origin data required for CORS validation, and security headers/cookies needed for authentication.

Meetli does not intentionally request special-category personal data as part of the standard product workflow.

## 3. Sources of Data

Meetli receives personal data:

- Directly from account owners, admins, specialists, clients, and invited users.
- From customer administrators who create or manage user and client records.
- From integrated providers when a user authorizes an integration, such as Zoom OAuth.
- From system-generated service events, such as appointment lifecycle changes, login attempts, and notification delivery events.

## 4. Why We Process Personal Data

Meetli processes personal data to:

- Create and manage customer accounts and user access.
- Authenticate users, maintain sessions, and protect accounts from unauthorized access.
- Create, update, cancel, and display appointments.
- Generate and deliver meeting links, including Zoom meetings when a user chooses Zoom as a meeting provider.
- Send service emails and reminders.
- Maintain audit trails for appointment activity and operational accountability.
- Detect, investigate, and respond to errors, abuse, fraud, misuse, or security incidents.
- Comply with legal obligations, enforce platform rules, and maintain the reliability of the service.

## 5. Legal Bases

Depending on the jurisdiction and context, Meetli generally relies on one or more of the following legal bases:

- Performance of a contract or steps requested before entering into a contract.
- Legitimate interests in operating, securing, and improving the service.
- Compliance with legal obligations.
- Consent, where consent is required for a particular processing activity.

Customers are responsible for ensuring that they have an appropriate legal basis for the personal data they enter into Meetli on behalf of their own clients or staff.

## 6. Zoom Integration Data

When a user connects Zoom:

- Meetli stores Zoom OAuth credentials and related expiry metadata needed to create meetings on behalf of that connected user.
- Meetli stores the latest Zoom meeting identifier and meeting URLs associated with the integration workflow.
- Meetli uses this data only to maintain the requested integration and create Zoom meetings initiated through Meetli.
- Disconnecting Zoom clears stored Zoom integration credentials and the most recent stored Zoom meeting linkage fields from the application database.

Meetli does not use Zoom integration data for advertising or unrelated profiling.

## 7. Sharing and Subprocessors

Meetli may share data with service providers and infrastructure vendors strictly as needed to deliver the service, including:

- Zoom, when a customer user chooses to connect Zoom and create Zoom meetings.
- Email delivery providers used for verification and transactional notifications, including Brevo.
- Mapping providers used for business location features, including Mapbox where enabled.
- Hosting, database, networking, logging, and operational support providers used to run the service.

These providers act only within the scope needed to deliver the relevant product feature or operational service. Meetli does not authorize subprocessors to use customer personal data for their own independent marketing purposes.

Meetli does not sell personal data.

## 8. Security Measures

Meetli applies technical and organizational measures that include:

- Role-based access control for `owner`, `admin`, `specialist`, and `client` roles.
- Session management with short-lived access tokens and refresh-token rotation.
- CSRF protections on refresh and logout endpoints.
- TLS in supported production environments.
- Security headers via `helmet` and controlled CORS allowlists.
- Account-segregated records using `account_id` boundaries throughout the application data model.
- Audit/event logging for appointment actions and short-retention error logging for security operations.
- Password hashing using PBKDF2 with per-user salts.

Some secrets in the system settings flow are encrypted at the application layer before storage. Other integration credentials are currently protected through database and infrastructure access controls rather than uniform application-layer field encryption. Meetli reviews this area as part of ongoing security hardening.

## 9. Retention

Meetli retains personal data only for as long as reasonably necessary for service delivery, security, compliance, and legitimate business operations.

Current system-enforced or implementation-defined retention examples include:

- Access tokens: 15 minutes by default.
- Refresh tokens: 30 days by default unless revoked or deleted earlier.
- Email verification and invite verification windows: 24 hours.
- Zoom OAuth state records: 10 minutes.
- Error logs: 7 days.
- Temporary login lockouts after repeated failed attempts: 15 minutes.

Meetli also supports deletion workflows initiated by authorized users and administrators:

- Account deletion requests can be scheduled by an authorized account administrator with a 10-day reconsideration window before the scheduled deletion date. During that window, the deletion request can be cancelled by an authorized administrator.
- The intended scope of account deletion includes account data and associated records such as users, appointments, specialists, services, stored passwords, and related credentials tied to that account.
- Self-service user deletion for specialist or client roles schedules permanent removal of that user's profile, passwords, appointments, integrations, and stored integration credentials after 10 days. Until the scheduled deletion date, that user can still sign in and cancel the deletion request.
- Administrative deletion of a managed user revokes that user's access immediately and removes the deleted user from standard user-management listings. Related records such as appointments may remain in the account for operational continuity unless separately removed through account-level deletion or other administrative action.

Where deletion is requested by a customer account for its own users or clients, Meetli processes that request within the product workflow and according to the configured retention and account ownership model.

Operational business records such as users, clients, appointments, notifications, and audit events may remain for the lifetime of the customer account unless deleted earlier by authorized administrators, removed in response to a valid request, or retained longer where required for security, dispute handling, or legal compliance.

## 10. User Rights and Requests

Subject to applicable law, data subjects may have rights to:

- Request access to their personal data.
- Request correction of inaccurate or incomplete data.
- Request deletion of data that is no longer required.
- Object to or request restriction of certain processing.
- Request data portability where applicable.

Requests should be submitted through the customer account administrator or by contacting Meetli at `support@meetli.cc`. Meetli may require reasonable verification before acting on a request.

Where the product exposes in-app deletion or cancellation controls, those controls are part of the supported request workflow.

## 11. Children

Meetli is not designed for independent use by children. Customers are responsible for ensuring lawful use of the service if they enter data relating to minors.

## 12. International Transfers

Meetli may process data in infrastructure locations used by its hosting and subprocessors. Where applicable, cross-border transfers should be governed by appropriate legal mechanisms and vendor commitments.

## 13. Changes to This Policy

Meetli may update this Privacy Policy from time to time to reflect changes in the service, legal requirements, integrations, or operational practices. The effective date at the top of this document indicates the latest revision date for this version.
