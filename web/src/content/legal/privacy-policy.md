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
- Integration data, such as whether Google, Zoom, or Yandex Telemost is connected, the Google permissions granted, token expiry metadata, the most recent Zoom and Yandex Telemost meeting identifiers and URLs created through the service, and the identifiers of Google Calendar events created for appointments.
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

### Google Calendar integration data

When a user connects Google Calendar:

- Meetli stores Google OAuth credentials, the list of Google permissions (scopes) that user granted, and related expiry metadata needed to access the connected calendar on that user's behalf.
- **Availability for booking.** To avoid offering booking slots that conflict with the user's own calendar, Meetli asks Google only whether the connected calendar is busy during a time range (Google's free/busy information). Booking pages, clients, and other users of the service see only that a time is unavailable, never the details of the user's events. Busy times are not stored as a copy of the calendar.
- **Showing the user their own events.** When the connected user opens the appointments calendar in Meetli, Meetli reads that user's own calendar events for the visible period (title, time, whether the event is all-day, cancelled, declined, or marked as free) and shows the title to that user only, so they can see what each busy slot is. These details are read live each time, are shown only to the Google account owner, are not shown to other users, administrators, or clients, and are not stored or cached by Meetli.
- **Adding appointments to the calendar.** When connecting, Google asks the user to allow Meetli to see and manage events on calendars the user owns. This permission is required for the integration: if the user declines it on Google's consent screen, the connection is not completed and no Google data is kept. Once connected, Meetli automatically creates, updates, and deletes calendar events for that user's appointments. Each event contains the service name, start and end time, the appointment location or meeting link, and an internal appointment identifier. Meetli does not write client names, phone numbers, email addresses, notes, or Telegram usernames into events, and does not invite attendees or send Google notifications.
- Meetli stores the identifier of each created Google event so that it can update or delete it when the appointment is rescheduled or cancelled.
- Disconnecting Google clears the stored Google credentials and granted-permission information and stops adding events. Events already created in the user's Google Calendar are not removed by disconnecting; the user can delete them in Google Calendar. When a user, specialist, client, or account is permanently deleted, Meetli attempts to delete the corresponding events it created before removing the appointments.
- Users can also revoke Meetli's access at any time in their Google Account permissions settings.

Meetli's use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. Meetli does not use Google user data for advertising, does not sell it, does not use it to train generalized artificial intelligence or machine learning models, and does not allow humans to read it except with the user's consent, for security purposes, to comply with law, or for internal operations with aggregated and anonymized data.

### Yandex Telemost integration data

When a user connects Yandex Telemost:

- Meetli stores Yandex OAuth credentials and related expiry metadata needed to create Telemost meetings on behalf of that connected user, and the identifier and join link of the most recent meeting created.
- Meetli uses this data only to create Telemost meetings requested through Meetli. Meeting links are created with open joining, so anyone who has a link can join the meeting.
- Disconnecting Yandex Telemost clears the stored Yandex credentials and the most recent stored meeting linkage fields from the application database.

Meetli does not use Yandex integration data for advertising or unrelated profiling.

## 7. Sharing and Subprocessors

Meetli may share data with service providers and infrastructure vendors strictly as needed to deliver the service, including:

- Zoom, when a customer user chooses to connect Zoom and create Zoom meetings.
- Google, when a customer user chooses to connect Google Calendar (availability lookups, showing the user their own events, and adding the user's appointments as calendar events).
- Yandex, when a customer user chooses to connect Yandex Telemost and create Telemost meetings.
- Email delivery providers used for verification and transactional notifications, including Brevo.
- Mapping providers used for business location features, including Mapbox where enabled.
- Hosting, database, networking, logging, and operational support providers used to run the service.

These providers act only within the scope needed to deliver the relevant product feature or operational service. Meetli does not authorize subprocessors to use customer personal data for their own independent marketing purposes.

Meetli does not sell personal data.

## 8. Security Measures

Meetli applies technical and organizational measures that include:

- Role-based access control for `product_admin`, `owner`, `specialist`, and `client` roles.
- Session management with short-lived access tokens and refresh-token rotation.
- CSRF protections on refresh and logout endpoints.
- TLS in supported production environments.
- Security headers via `helmet` and controlled CORS allowlists.
- Account-segregated records using `account_id` boundaries throughout the application data model.
- Audit/event logging for appointment actions and short-retention error logging for security operations.
- Password hashing using PBKDF2 with per-user salts.

Third-party integration credentials (Zoom, Google, and Telegram OAuth tokens/secrets) are encrypted at the application layer with AES-256-GCM before storage; the corresponding plaintext columns have been removed from the primary integrations table. Other system settings secrets are protected through database and infrastructure access controls.

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
