# Google OAuth Scope Classification and Verification Path

Reviewed: 2026-10-20 (supersedes the 2026-09-21 read-only review, issue #226)
Reviewer: engineering (code audit)

## Scope

Code paths reviewed:
- `server/src/services/googleOAuthService.ts`
- `server/src/services/calendarAvailabilityService.ts`
- `server/src/services/googleCalendarEventService.ts`
- `server/src/repositories/googleCalendarSyncRepository.ts` and `server/src/jobs/googleCalendarSync.job.ts`
- `server/src/config/env.ts`

## Scopes actually requested

A single **Connect Google** action requests all of the following in one consent screen
(`GOOGLE_DEFAULT_SCOPES` plus `GOOGLE_OAUTH_WRITE_SCOPE`, `googleOAuthService.ts`, `env.ts`; override the base
list with `GOOGLE_OAUTH_SCOPES`):

- `openid`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/calendar.freebusy` (busy time ranges for availability)
- `https://www.googleapis.com/auth/calendar.events.owned` ("See, create, change, and delete events on Google
  calendars you own"; `GOOGLE_OAUTH_WRITE_SCOPE`, default value shown)

The write permission is **required for the integration**: Meetli automatically adds the user's appointments to
their calendar. Google's granular consent lets the user untick it; in that case the connection is **not
completed** — the callback clears the credentials and granted scopes and redirects with
`reason=calendar_write_required`, so there is never a half-connected state. The granted scopes returned by
Google are stored in `web_user_integrations.google_granted_scopes` and re-validated before every write.
If the Cloud Console does not offer `calendar.events.owned`, set
`GOOGLE_OAUTH_WRITE_SCOPE=https://www.googleapis.com/auth/calendar.events`. (The console scope picker accepted
all four scopes above on 2026-10-20.)

No full `calendar` scope, no Gmail, Drive, Contacts, or People API usage anywhere in the codebase.

Calendar API calls made:
- `POST /calendar/v3/freeBusy` for `primary` — returns only busy time ranges (no titles, attendees, organizer
  or creator emails). Used for **booking availability** (public pages and the appointment form) and as the
  generic "busy" blocks in the appointments calendar (`calendarAvailabilityService.ts`).
- `GET /calendar/v3/calendars/primary/events` (`events.list`, `singleEvents=true`, limited response fields) —
  called live when **the connected user themselves** opens the appointments calendar, to show that user the
  title of each of their own events. Never called for any other viewer, never cached or stored. Meetli's own
  events (`extendedProperties.private.appointmentId`), cancelled events, events marked free, and events the
  user declined are excluded. If this call fails, the generic freeBusy blocks are used.
- `POST/PATCH/DELETE /calendar/v3/calendars/primary/events[/{id}]` with `sendUpdates=none` — creates, updates,
  and deletes the events for the user's appointments (`googleCalendarEventService.ts`).
- `oauth2.googleapis.com/token` for code exchange and refresh.

**Finding: the scope set is minimal for the features.** Availability needs only free/busy time
(`calendar.freebusy`); showing the owner their own event titles and syncing appointments needs only events on
the user's own calendar (`calendar.events.owned`).

## Sensitive vs. restricted classification

As shown by the Cloud Console scope picker after adding the scopes (2026-10-20):

| Scope | Classification |
|---|---|
| `openid` | Non-sensitive |
| `.../auth/userinfo.email` | Non-sensitive |
| `.../auth/calendar.freebusy` | Non-sensitive |
| `.../auth/calendar.events.owned` | **Sensitive** |

No scope is in Google's **restricted** tier (restricted scopes carry the CASA third-party security assessment
requirement — Gmail, broad Drive, etc.).

**Finding: standard verification only, no CASA** (re-check if Gmail, Drive, or People API scopes are ever
added). Standard verification for a sensitive scope requires:
- A verified OAuth consent screen (app name, logo, support email, developer contact, authorized domain,
  links to home page, privacy policy, and terms).
- A published privacy policy that describes Google user data and includes the Limited Use statement
  (`../privacy-policy.md`, section 6 "Google Calendar integration data").
- A verified domain (Google Search Console).
- A demo video showing the OAuth consent flow and in-product use of every requested scope (see script below).
- Written justification per scope (below — can be copied into the Cloud Console form).

## Per-scope justification (for the Cloud Console verification form)

- **`openid`** — required by the OAuth flow to establish a verifiable identity for the connecting Google
  account; used only to complete the connection.
- **`.../auth/userinfo.email`** — used to show the user which Google account is connected in the
  Integrations settings, so they can confirm it is the right one.
- **`.../auth/calendar.freebusy`** — used to learn when the specialist's own connected Google Calendar is
  busy, so the booking page and the appointment form do not offer slots that conflict with their external
  calendar. Only busy time ranges are requested for this purpose; clients and other users never see event
  details. Busy times are not stored as a copy of the calendar.
- **`.../auth/calendar.events.owned`** — used for two things on the user's own primary calendar:
  (1) the app creates, updates, and deletes calendar events for the user's own appointments, so appointments
  booked in Meetli also appear in the specialist's calendar and the time is not double-booked by hand; event
  contents are limited to the service name, time, location or meeting link, and an internal appointment id —
  no client contact details, no attendees, no Google notifications; (2) when the connected user opens the
  appointments calendar, the app reads that user's own events for the visible period and shows the user the
  title of each busy slot, so they can see what it is. Titles are read live, shown only to that user, and are
  never stored or cached.

## Data handling summary (for reviewers)

- Tokens: AES-256-GCM encrypted at rest (`../../../server/docs/integration-secrets.md`); refreshed ~30 s
  before expiry; a revoked or failing connection is skipped with a log line and never breaks other users.
- Write path: automatic for every appointment of a connected user whose Google grant includes the write scope;
  re-validated at enqueue time and again at processing time. Asynchronous outbox with retries; a Google failure
  never fails the appointment.
- Event titles: produced only for the Google account owner viewing their own appointments calendar (their web
  user id equals the specialist's connected user). Owners/admins viewing other specialists, clients, and the
  public booking path receive no titles. Titles are never logged.
- Content written to Google: service name, time with the specialist's IANA timezone, location or meeting link,
  `extendedProperties.private.appointmentId`. Client name, phone, email, notes, and Telegram username are
  never written. `sendUpdates=none`, no attendees.
- Disconnect / revoke: disconnecting clears credentials and granted scopes. Events already created are not
  removed (stated in the privacy policy). Permanent deletion of a user, specialist, client, or account deletes
  the Google events Meetli created, best effort, before removing the appointments.
- Limited Use: stated in the privacy policy (section 6).

## Demo video script (3–4 minutes, English UI, show the OAuth client id in the browser URL during consent)

1. Open Meetli → Settings → Integrations; show the Google Calendar card and the caption under **Connect
   Google**.
2. Click **Connect Google**; show the single consent screen listing every requested permission (see your
   calendar availability; see, create, change, and delete events on calendars you own); approve. The card now
   shows "Connected".
3. **Availability:** add a busy event ("Dentist") in the connected Google Calendar; open the Meetli appointments
   calendar and show the busy block with the title "Dentist" (visible only to this user); open the public
   booking page and show that the conflicting slot is not offered.
4. Create an appointment in Meetli; show the event appearing in Google Calendar with only the service name,
   time, and location or link (no client details); show that it is not duplicated as a separate "busy" block in
   Meetli.
5. Reschedule the appointment; show the event moving. Cancel it; show the event disappearing.
6. Disconnect Google; show the card returns to "not connected"; mention that revoking access is also possible
   in the Google Account permissions page.

## Token caching / refresh-before-expiry

`calendarAvailabilityService.ts` (`resolveUsableGoogleAccessToken`) reuses the cached token from
`web_user_integrations` and refreshes only when the token is missing or within 30 seconds of expiry. The
same helper serves the event writer, so refresh logic exists once. A specialist with a revoked or expired
refresh token is skipped (logged, not thrown). See also the Zoom pattern in
[`../zoom-beta/oauth-scope-and-token-handling.md`](../zoom-beta/oauth-scope-and-token-handling.md).

## Remaining open items before Google verification submission

- Cloud Console (done 2026-10-20: branding, scopes, production redirect URI): upload the logo, verify the
  domain in Search Console, then publishing status "In production".
- Verify the full flow once in Testing with a test account (connect, titles for the owner only, event sync,
  disconnect).
- Record the demo video per the script above.
- Submit for standard verification (CASA not required) and respond to the reviewer's email.
- Known limitations to mention if asked: the Telegram bot does not read Google busy time (public web booking
  does); the bot only enqueues event writes, the server performs all Google calls.
