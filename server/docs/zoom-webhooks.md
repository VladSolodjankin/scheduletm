# Zoom webhooks

Implements #230: keeps appointment state in sync with what actually happens in Zoom, instead of only knowing that a meeting link was created.

## What's handled

`POST /api/integrations/zoom/webhook` (`integrationRoutes.ts`, logic in `zoomWebhookService.ts`):

| Zoom event | Effect |
|---|---|
| `meeting.started` | Sets `appointments.zoom_meeting_started_at` on the matching appointment. |
| `meeting.ended` | Sets `appointments.zoom_meeting_ended_at`. |
| `meeting.deleted` | Marks the appointment `cancelled` (unless already cancelled) and writes an `appointment_events` audit row with `actorWebUserId: null`, `metadata: { source: 'zoom_webhook' }`. |
| anything else | Acknowledged (200) and marked processed, no other effect — subscribing to more Zoom events later doesn't require a code change to avoid retry storms. |

Deliberately **not** implemented as writing to the `status` state machine for started/ended: `AppointmentStatus` is `'new' | 'confirmed' | 'cancelled'` and several other things (auto-cancel-unpaid job, notifications, the public booking status endpoint) assume only those three values. Adding a fourth ("held"/"completed") would touch all of those; the started/ended timestamps give the same signal ("did the meeting actually happen") without that blast radius.

## Matching a webhook event to an appointment

Appointments store the Zoom-side numeric meeting id (`appointments.zoom_meeting_id`, populated in `appointmentService.ts` when a meeting is auto-created via Zoom) and are looked up by it (`findAppointmentByZoomMeetingIdAnyAccount`) — across all accounts, since a webhook has no notion of our tenant, only Zoom's own account id. An event for a meeting we didn't create (or created before this field existed) has no match and is a no-op.

## Verification (not the Telegram-webhook pattern)

Per the issue's explicit note not to copy `bot/src/routes/telegramWebhook.ts`'s `:secret`-in-URL pattern — Zoom doesn't support that model. Two different mechanisms, both required:

- **`endpoint.url_validation`**: Zoom's one-time setup ping, sent *unsigned*. Respond with `{ plainToken, encryptedToken: HMAC-SHA256(ZOOM_WEBHOOK_SECRET_TOKEN, plainToken) }` to prove you hold the secret — handled first, before any signature check.
- **Every other event**: signed via `x-zm-signature: v0=<hex>` over `v0:{x-zm-request-timestamp}:{raw body}`, HMAC-SHA256 with the same secret. Verified against the **raw request bytes** (`app.ts` mounts a dedicated `express.json({ verify })` for this one path to capture them before JSON parsing — the global body parser downstream would otherwise have already consumed/reserialized the body). Requests older than 5 minutes are rejected as stale regardless of signature validity.

## Idempotency

Zoom redelivers on a non-2xx or slow response. `zoom_webhook_events` (own table, not shared with the bot's `processed_updates`) dedupes by a hash of `event:object.uuid-or-id:event_ts`, using the same lease-then-mark-processed shape as `bot/src/repositories/processed-update.repository.ts` — acquire a lease, process, mark processed; on failure, release the lease so a genuine retry can still go through instead of being permanently stuck as "processing".

## Setup

1. Zoom Marketplace app → **Feature** → **Event Subscriptions** → add a webhook pointing at `https://<api-host>/api/integrations/zoom/webhook`, subscribed to at least `Meeting Started`, `Meeting Ended`, `Meeting Deleted`.
2. Copy the app's **Secret Token** into `ZOOM_WEBHOOK_SECRET_TOKEN`.
3. Save in the Zoom console — it fires `endpoint.url_validation` immediately; the endpoint must already be deployed and reachable for that to succeed.

Without `ZOOM_WEBHOOK_SECRET_TOKEN` set, the endpoint responds 404 to everything (kept intentionally inert rather than accepting unverifiable events).
