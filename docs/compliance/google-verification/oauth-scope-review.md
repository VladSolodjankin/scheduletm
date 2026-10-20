# Google OAuth Scope Classification and Verification Path

Reviewed: 2026-10-19 (supersedes the 2026-09-21 read-only review, issue #226)
Reviewer: engineering (code audit)

## Scope

Code paths reviewed:
- `server/src/services/googleOAuthService.ts`
- `server/src/services/calendarAvailabilityService.ts`
- `server/src/services/googleCalendarEventService.ts`
- `server/src/repositories/googleCalendarSyncRepository.ts` and `server/src/jobs/googleCalendarSync.job.ts`
- `server/src/services/settingsService.ts` (the write setting)
- `server/src/config/env.ts`

## Scopes actually requested

Base connection (`GOOGLE_DEFAULT_SCOPES`, `googleOAuthService.ts:30-34`; override with `GOOGLE_OAUTH_SCOPES`):

- `openid`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/calendar.freebusy`

Write access is requested **only on demand**: when a user turns on "Create appointments in my Google
Calendar", the UI starts a second OAuth round with `{ "access": "write" }` and the server appends
`GOOGLE_OAUTH_WRITE_SCOPE` (`env.ts:20`, default `https://www.googleapis.com/auth/calendar.events.owned`;
`googleOAuthService.ts:76-78`). The request uses incremental authorization (`include_granted_scopes=true`),
so Google returns the union of granted scopes, which is stored in `web_user_integrations.google_granted_scopes`.
If the Cloud Console does not offer `calendar.events.owned`, set
`GOOGLE_OAUTH_WRITE_SCOPE=https://www.googleapis.com/auth/calendar.events`.

No full `calendar` scope, no Gmail, Drive, Contacts, or People API usage anywhere in the codebase.

Calendar API calls made:
- `POST /calendar/v3/freeBusy` for `primary` — reads only busy time ranges (no titles, attendees,
  organizer or creator emails) (`calendarAvailabilityService.ts`, `GOOGLE_FREEBUSY_URL`).
- `POST/PATCH/DELETE /calendar/v3/calendars/primary/events[/{id}]` with `sendUpdates=none` — only when the
  user enabled the write setting (`googleCalendarEventService.ts`).
- `oauth2.googleapis.com/token` for code exchange and refresh.

Existing connections made before this change hold `calendar.readonly`; `freeBusy` accepts it, so they keep
working without re-consent. `calendar.readonly` is no longer requested for new connections and is not
declared on the consent screen.

**Finding: the scope set is minimal for the features.** Availability needs only free/busy time
(`calendar.freebusy`); event creation needs only events the app itself created on the user's own calendar
(`calendar.events.owned`). The write scope is opt-in and off by default.

## Sensitive vs. restricted classification

Per Google's OAuth API verification tiers (the Cloud Console scope picker shows each scope's
classification when you add it — **confirm `calendar.freebusy` and `calendar.events.owned` there before
submitting**; the newer scopes' classification is not stated on the Calendar API auth page):

| Scope | Expected classification |
|---|---|
| `openid` | Not sensitive |
| `.../auth/userinfo.email` | Not sensitive (basic profile scope) |
| `.../auth/calendar.freebusy` | Sensitive (to confirm in the scope picker) |
| `.../auth/calendar.events.owned` | Sensitive (to confirm in the scope picker) |

None of these fall in Google's **restricted** tier (restricted scopes carry the CASA third-party
security assessment requirement — Gmail, broad Drive, etc.). Calendar scopes are on the sensitive list.

**Finding: standard verification only, no CASA** (re-check if Gmail, Drive, or People API scopes are
ever added). Standard verification for a sensitive scope set requires:
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
- **`.../auth/calendar.freebusy`** — used exclusively to learn when the specialist's own connected Google
  Calendar is busy, so the booking page and the appointment form do not offer slots that conflict with
  their external calendar. Only busy time ranges are requested; event contents are never read. Busy times
  are used for this availability computation only and are not stored as a copy of the calendar.
- **`.../auth/calendar.events.owned`** — used only if the user turns on "Create appointments in my Google
  Calendar" (off by default). The app then creates, updates, and deletes events for the user's own
  appointments on their primary calendar, so appointments booked in Meetli also appear in the specialist's
  calendar. Event contents are limited to the service name, time, location or meeting link, and an internal
  appointment id; no client contact details, no attendees, no Google notifications.

## Data handling summary (for reviewers)

- Tokens: AES-256-GCM encrypted at rest (`../../../server/docs/integration-secrets.md`); refreshed ~30 s
  before expiry; a revoked or failing connection is skipped with a log line and never breaks other users.
- Write path: opt-in per user, re-validated at enqueue time and again at processing time (setting enabled
  and write scope actually granted — Google's granular consent lets a user untick it). Asynchronous outbox
  with retries; a Google failure never fails the appointment.
- Content policy: service name, time with the specialist's IANA timezone, location or meeting link,
  `extendedProperties.private.appointmentId`. Client name, phone, email, notes, and Telegram username are
  never written. `sendUpdates=none`, no attendees.
- Disconnect / revoke: disconnecting clears credentials, granted scopes, and the write setting. Events
  already created are not removed (stated in the UI and the privacy policy). Permanent deletion of a user,
  specialist, client, or account deletes the Google events Meetli created, best effort, before removing
  the appointments.
- Limited Use: stated in the privacy policy (section 6).

## Demo video script (3–4 minutes, English UI, show the OAuth client id in the browser URL during consent)

1. Open Meetli → Settings → Integrations; show the Google Calendar card and the "Create appointments in my
   Google Calendar" switch (disabled until connected, off by default).
2. Click **Connect Google**; show the consent screen listing the base scopes; approve.
3. **Availability (freebusy):** add a busy event in the connected Google Calendar, open the public booking
   page, and show that the conflicting slot is not offered.
4. Turn on the write switch; show the second Google consent screen for calendar events; approve; show the
   switch now enabled.
5. Create an appointment in Meetli; show the event appearing in Google Calendar with only the service name,
   time, and location or link (no client details).
6. Reschedule the appointment; show the event moving. Cancel it; show the event disappearing.
7. Disconnect Google; show the switch resets; mention that revoking access is also possible in the Google
   Account permissions page.

## Token caching / refresh-before-expiry

`calendarAvailabilityService.ts` (`resolveUsableGoogleAccessToken`) reuses the cached token from
`web_user_integrations` and refreshes only when the token is missing or within 30 seconds of expiry. The
same helper serves the event writer, so refresh logic exists once. A specialist with a revoked or expired
refresh token is skipped (logged, not thrown). See also the Zoom pattern in
[`../zoom-beta/oauth-scope-and-token-handling.md`](../zoom-beta/oauth-scope-and-token-handling.md).

## Remaining open items before Google verification submission

- Confirm in the Cloud Console scope picker that `calendar.freebusy` and `calendar.events.owned` are
  offered and how they are classified; fall back to `calendar.events` if needed (env change only).
- OAuth consent screen in the Cloud Console: app name, logo, support and developer emails, authorized
  domain, home page, privacy policy and terms links; verify the domain in Search Console; set publishing
  status to "In production".
- Add the production redirect URI used by `GOOGLE_OAUTH_REDIRECT_URI`.
- Record the demo video per the script above.
- Submit for standard verification (CASA not required) and respond to the reviewer's email.
- Known limitation to mention if asked: the Telegram bot no longer reads Google busy time (public web
  booking does); the bot only enqueues event writes, the server performs all Google calls.
