# Google OAuth Scope Classification and Verification Path

Reviewed: 2026-09-21
Reviewer: engineering (code audit, tracked in issue #226)

## Scope

Code paths reviewed:
- `server/src/services/googleOAuthService.ts`
- `server/src/services/calendarAvailabilityService.ts`
- `server/src/config/env.ts`

## Scopes actually requested

`GOOGLE_OAUTH_SCOPES` (`server/src/config/env.ts`) defaults to `GOOGLE_DEFAULT_SCOPES`
(`googleOAuthService.ts:26-30`) when the env var is unset:

- `openid`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/calendar.readonly`

`calendarAvailabilityService.ts` only ever calls
`GET /calendar/v3/calendars/{calendarId}/events` (read-only, `calendarAvailabilityService.ts:104`)
to compute busy slots for availability. There is no calendar write, no Gmail, Drive, Contacts, or
People API usage anywhere in the codebase (`grep` for `googleapis.com` finds only the
`calendar/v3/calendars/.../events` GET call and the `oauth2.googleapis.com/token` endpoint).

**Finding: scope set is minimal for the feature** — read-only calendar access is exactly what
free/busy lookup needs; no broader Calendar scope (e.g. full `calendar` read/write, or
`calendar.events` write) is requested.

## Sensitive vs. restricted classification

Per Google's OAuth API verification tiers (Google API Console > OAuth consent screen > scope
picker classifies each scope when you add it):

| Scope | Classification |
|---|---|
| `openid` | Not sensitive |
| `.../auth/userinfo.email` | Not sensitive (basic profile scope) |
| `.../auth/calendar.readonly` | **Sensitive** |

None of the three scopes fall in Google's **restricted** tier. Restricted scopes are the ones
carrying the extra CASA (Cloud Application Security Assessment third-party audit) requirement —
they're concentrated in Gmail (most scopes), Drive (broad file access), and a handful of other
highly sensitive APIs. `calendar.readonly` is on Google's sensitive list, not the restricted list.

**Finding: this app only needs standard verification, not CASA.** Standard verification for a
sensitive-only scope set requires:
- A verified OAuth consent screen (app name, logo, support email, developer contact, authorized
  domain).
- A linked, published privacy policy (already in place: `../privacy-policy.md`).
- A demo video showing the OAuth consent flow and how the requested scope is used in-product.
- Written justification per scope for why it's needed (see below — can be copied directly into
  the Google Cloud Console verification form).

If a future feature needs to *write* Calendar events (not just read busy slots), that would still
be `calendar` or `calendar.events` — both sensitive, not restricted — so the CASA requirement
would still not apply on the current feature trajectory. Re-check this conclusion if Drive, Gmail,
or People API scopes are ever added.

## Per-scope justification (for the Cloud Console verification form)

- **`openid`** — required by the OAuth flow itself to establish a verifiable identity for the
  connecting Google account; used only to complete sign-in, not stored beyond the session.
- **`.../auth/userinfo.email`** — used to show the specialist which Google account is connected
  in the integrations UI (`SettingsCard`/`SystemSettingsTab`) so they can confirm it's the right
  one before relying on it for calendar sync.
- **`.../auth/calendar.readonly`** — used exclusively to read free/busy events from the
  specialist's own connected Google Calendar (`calendarAvailabilityService.ts`) so the booking
  page can avoid offering slots that conflict with their external calendar. No calendar data is
  written, shared with other users, or used for any purpose beyond this availability computation.

## Token caching / refresh-before-expiry

`calendarAvailabilityService.ts:36-43,76-98` mirrors the Zoom pattern documented in
[`../zoom-beta/oauth-scope-and-token-handling.md`](../zoom-beta/oauth-scope-and-token-handling.md):
it reuses the cached `googleApiKey`/`googleTokenExpiresAt` from `web_user_integrations` and only
calls `refreshGoogleAccessToken` when the token is missing or within 30 seconds of expiry — it
does not request a new token before every call. A specialist with a revoked or expired refresh
token is skipped (logged, not thrown) so one broken connection doesn't fail availability lookups
for other specialists. This was previously an open item (issue #234's Google half); it's now
confirmed resolved in the codebase as of commit `53c26f1`.

## Remaining open items before Google verification submission (not addressed by this review)

- OAuth consent screen branding in Google Cloud Console: app logo, app name, and authorized
  domain still need to be configured/uploaded — this is Cloud Console configuration, not a code
  change, and is owned by whoever holds the Google Cloud project.
- Demo video recording showing the connect-Google-Calendar flow end-to-end (consent screen through
  a booking page reflecting the synced availability) — needed for the verification submission,
  not yet recorded.
- Submit for standard verification (not CASA) once the above two items are ready.
