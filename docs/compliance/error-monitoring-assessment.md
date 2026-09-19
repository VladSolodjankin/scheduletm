# Error monitoring: is the in-house solution enough, or do we need Sentry?

Assessment per #219. Reviewed `server/src/services/errorTrackingService.ts`, `server/src/repositories/errorLogRepository.ts`, and `docs/compliance/security-policy-incident-response.md`.

## What exists today

- Both frontend (`trackWebError`) and backend (`trackServerError`) errors are captured into a Postgres table (`error_logs`), visible only to `product_admin` (see `docs/compliance/security-policy-access-control.md`).
- Every captured error also fires a real-time Telegram alert (`notifyErrorToTelegram`), if `APP_ENCRYPTION_KEY` and a bot token/chat id are configured.
- Retention was a hardcoded 7 days, opportunistically purged on every insert (`cleanupExpiredLogs`) rather than via a scheduled job. **Bumped to 30 days as part of this review** — a one-line, zero-cost change; 7 days was too short to investigate anything that surfaces after the fact (a user report a few days later, a slow trend).

## What it can't do, compared to Sentry (or similar)

- **No grouping/deduplication.** Every occurrence is its own row (`listErrorLogs` is a flat, newest-first list filterable only by `source`/`accountId`). There's no way to see "this is the same error, it happened 400 times across 60 users" — someone has to read raw messages to notice a pattern.
- **No alert throttling.** `notifyErrorToTelegram` fires on every single occurrence, unconditionally. A crash loop (e.g. a bad deploy hitting every request) sends the ops Telegram chat one message per request, not one message for the incident.
- **No release/deploy correlation.** Nothing ties an error to the version of the code that produced it, so "did this start after the last deploy?" has to be answered by memory/timing, not data.
- **No sourcemap-aware stack traces.** Frontend errors capture whatever stack the browser gives — for a minified production bundle that's minified symbol names and bundled line numbers, not the original source location.
- **No issue lifecycle** (resolve/mute/reopen, assign to someone) — it's a log, not an issue tracker.

## Recommendation

**Keep the in-house solution for now — don't adopt Sentry today.** At current scale (pre-launch/early, one team), the real-time Telegram alert already gives fast detection, which is the operational goal the incident-response policy actually commits to ("begin incident triage promptly after detection") — it doesn't promise grouping, release tracking, or a fixed retention window, so there's no live compliance gap.

**Revisit this once real production traffic starts**, specifically because of the four gaps above — they're not things worth building in-house (grouping/dedup, sourcemap resolution, and release correlation are Sentry's actual core product, not a side feature) — a free/hobby-tier Sentry project would cover this app's likely volume for a long time before any paid tier is needed. Treat "we're getting duplicate Telegram alerts for the same incident" or "we can't tell which errors are new since the last deploy" as the concrete trigger to act on this, rather than a calendar date.

If/when adopting Sentry: keep the existing Postgres `error_logs` + Telegram alert as-is for the backend `trackServerError` path (cheap, already working, no reason to rip out), and point the frontend's `@sentry/react`-style SDK at Sentry for `trackWebError` first — that's where sourcemap support and release tagging matter most, and it's the smaller integration surface to start with.
