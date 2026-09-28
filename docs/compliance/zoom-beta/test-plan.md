# Meetli — Zoom App Test Plan

Effective date: 2026-09-28

This document is the step-by-step test plan referenced from the Zoom Marketplace
submission's release notes, for use by the Zoom App Review team.

**Verified end-to-end on production (`meetli.cc`) on 2026-09-28** using a real
test account: connected Zoom via OAuth, created an appointment with Zoom as the
meeting provider from the internal dashboard, and confirmed a real Zoom join
link (`us05web.zoom.us/j/...`) was attached to it. The steps below match what
was actually exercised, not just a theoretical flow.

## 1. What the app does

Meetli is a scheduling/appointments SaaS. Once a user connects their Zoom account,
Meetli can create a Zoom meeting automatically for any appointment and attach the
join link to booking confirmations and reminders sent to the client.

## 2. Scopes requested and why

| Scope | Purpose |
| --- | --- |
| `meeting:write:meeting` | Create a Zoom meeting on the connected user's behalf when they book an appointment with Zoom selected as the meeting provider. |
| `user:read:user` | Read basic profile info (name, email) of the connected Zoom account, shown in Settings → Integrations to confirm which Zoom account is connected. |

No other scopes are requested. See [oauth-scope-and-token-handling.md](oauth-scope-and-token-handling.md)
for the full scope-minimality rationale.

## 3. Test account

Login URL: `https://meetli.cc/login`
Credentials: provided separately in the Zoom Marketplace "Test account and credentials" field.
The account has one specialist (`zoomtestowner`) and one bookable service ("Test service",
30 min) already set up, so the reviewer does not need to create anything before testing.

## 4. Step-by-step test flow

### 4.1 Connect Zoom (OAuth authorization)

1. Sign in to Meetli with the provided test account.
2. Go to **Settings → Integrations**.
3. Locate the **Zoom** card and select **Connect**.
4. You are redirected to Zoom's OAuth consent screen (`zoom.us/oauth/authorize`).
   Review the requested scopes and select **Authorize**.
5. You are redirected back to `https://meetli.cc/settings?zoom_oauth=success`,
   and the Zoom card now shows **Connected**, along with the connected Zoom
   account's name/email (from `user:read:user`).

Expected result: no errors; the Zoom card persists as Connected after a page refresh.

### 4.2 Create an appointment with a Zoom meeting

1. From the Meetli dashboard, create a new appointment (or edit an existing one).
2. In the meeting provider field, select **Zoom**.
3. Save the appointment.

Expected result: the appointment now shows a **Join Zoom Meeting** link. This
calls the Zoom REST API (`POST /v2/users/me/meetings`) server-side using the
access token obtained in step 4.1, via `meeting:write:meeting`.

### 4.3 Verify the meeting link

1. Open the appointment detail view and confirm the Join link is present and
   points to a valid `zoom.us/j/...` URL.
2. Optionally, open the link to confirm it loads a real Zoom meeting.

### 4.4 Disconnect Zoom

1. Go to **Settings → Integrations**.
2. Select **Disconnect** on the Zoom card.

Expected result: the card returns to a disconnected state; Meetli clears the
stored Zoom OAuth token for that user immediately. Creating a new appointment
with Zoom as the provider now fails gracefully (the UI indicates Zoom needs to
be reconnected) until the user connects again.

## 5. Related documents

- [Support and Documentation](../support.md) — end-user-facing instructions for
  adding, using, and removing the app (same content published at
  `https://meetli.cc/support`).
- [oauth-scope-and-token-handling.md](oauth-scope-and-token-handling.md) — scope
  and token-handling detail for reviewers auditing security/privacy.
