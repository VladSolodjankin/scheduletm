# Zoom OAuth Scope and Token Handling Review

Reviewed: 2026-09-15
Reviewer: engineering (code audit, tracked in issue #225 / #234)

## Scope

Code paths reviewed:
- `server/src/services/zoomOAuthService.ts`
- `server/src/services/zoomService.ts`
- `server/src/repositories/webUserIntegrationRepository.ts`

## OAuth scope minimality (Zoom App Review requirement #2)

`ZOOM_OAUTH_SCOPES` (`server/src/config/env.ts`) defaults to `meeting:write:meeting user:read:user`
(`zoomOAuthService.ts:19`) when the env var is unset. This matches the scopes actually
registered/approved for this app in the Zoom Marketplace console (Scopes section) as of
2026-09-21: `meeting:write:meeting` (create a meeting) and `user:read:user` (identify the
connected user). The app creates a meeting via `POST /v2/users/me/meetings` (`zoomService.ts:97`)
and does not read any other Zoom resource (no chat, recordings, phone, contacts, etc.). No scope
broader than these two is requested or registered.

**Correction (2026-09-21):** this document previously stated the default/registered scopes were
`meeting:write:meeting meeting:read:meeting`. That was the code's hardcoded fallback default at
the time, but it did not match what was actually registered in the Zoom console for this app
(`meeting:write:meeting` + `user:read:user`) — `meeting:read:meeting` was never registered/approved
and is unused in the codebase. If `ZOOM_OAUTH_SCOPES` were ever unset in production, the OAuth
authorize request would have asked for an unregistered scope, which Zoom would reject, breaking
the Connect Zoom flow. The code default was corrected in `zoomOAuthService.ts` to match the
console registration.

**Finding: compliant.** No action needed unless product scope changes (e.g. #230's webhook status
sync may need an additional scope if Zoom requires it for webhook subscription management —
re-check when that issue is implemented, and register any new scope in the console first).

## Token caching / refresh-before-expiry (Zoom App Review requirement #4)

Zoom requires apps to cache the access token and use the refresh flow instead of requesting a new
token before every API call.

`createZoomMeeting` (`zoomService.ts:54-141`):
1. Reads the cached `zoom_access_token` / `zoom_refresh_token` / `zoom_token_expires_at` from
   `web_user_integrations` via `findWebUserIntegrationByWebUserId` — it does **not** request a new
   token unconditionally.
2. Only calls `refreshZoomAccessToken` when `zoom_token_expires_at` is missing or within 30 seconds
   of expiry (`zoomService.ts:76`), i.e. refreshes proactively before the token actually expires
   rather than waiting for a 401.
3. Persists the refreshed token back to `web_user_integrations` immediately after a successful
   refresh, so the next call reuses it.
4. On refresh failure (e.g. the specialist revoked access in Zoom), returns
   `{ ok: false, reason: 'zoom_auth_failed' }` instead of throwing unhandled — the caller
   (`appointmentService.ts`) can surface this to the specialist.

**Finding: compliant with Zoom's caching requirement.** The 401-driven-refresh anti-pattern
described in issue #234 does not apply to Zoom; #234's Google Calendar half (whether
`calendarAvailabilityService.ts` also proactively refreshes rather than re-fetching read-only
busy slots) is still open and should be verified separately before closing #234.

## Token storage at rest

See [`server/docs/integration-secrets.md`](../../../server/docs/integration-secrets.md) for the
encryption-at-rest architecture (AES-256-GCM, `APP_ENCRYPTION_KEY`), completed as part of issue #228:
the plaintext `zoom_access_token` / `zoom_refresh_token` columns have been removed from
`web_user_integrations` — only the `_encrypted` columns remain.

## On Behalf Of (OBF) token requirement — resolved, not applicable

Reviewed 2026-09-15 against Zoom's official docs (`developers.zoom.us/blog/transition-to-obf-token-meetingsdk-apps`,
`developers.zoom.us/docs/meeting-sdk/obf-faq`). The OBF requirement (effective 2026-03-02) applies only to
apps that **join meetings as a participant outside their own account** — this is a Meeting SDK concept
(embedding Zoom's client SDK to join/record a call, e.g. recording bots, in-app video embeds). It requires
the `user:read:token` scope and a per-join REST call to mint the OBF token before joining.

This app does not use the Meeting SDK and never joins a meeting programmatically. It only calls the
Meetings **REST API** (`POST /v2/users/me/meetings`, `zoomService.ts:97`) to create a meeting inside the
connected specialist's own Zoom account; the resulting `join_url`/`start_url` are opened by humans in
their normal Zoom client/browser. That is explicitly outside the OBF requirement's scope.

**Conclusion: no OBF token integration needed.** No code change, no additional scope
(`user:read:token` not required). Worth stating explicitly in the Technical Design Review submission so
the Zoom reviewer doesn't flag it as a gap, but it is not a blocking gap on our side.

## Remaining open items before Zoom submission (not addressed by this review)

- Formal Technical Design Review write-up and submission to Zoom Developer Console — a process step
  outside this repository, owned by the product/account holder.
- SAST/DAST evidence refresh — generated by the existing GitHub Actions pipeline
  (see `sast-latest.md`, `dast-latest.md`); rerun before final submission so the evidence timestamp
  is current.
