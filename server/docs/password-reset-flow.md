# Forgot-password flow

Reviewed as part of #221. Implementation: `authService.ts` (`requestPasswordReset`/`resetPassword`) + `passwordResetRepository.ts` (`createPasswordResetChallenge`/`confirmPasswordReset`), routes in `authRoutes.ts`. This is the unauthenticated "forgot my password" flow — distinct from the in-app password change while logged in (`/api/settings/user/password/*`, reviewed separately in `sessions-and-tokens.md` as part of #223).

## Flow

```
POST /api/auth/password-reset/request {email}
  -> requestPasswordReset (fire-and-forget, response doesn't wait on it)
  -> always 200 "if the account is eligible, a code has been sent"

POST /api/auth/password-reset/confirm {email, code, password}
  -> resetPassword -> confirmPasswordReset
  -> 200 on success, generic 400 "invalid or expired" on any failure
```

## Reset code

- 4-digit OTP (`createOtpCode`), stored as `hashPassword(code, codeSalt)` — never stored or logged in plaintext.
- **Lifetime**: 10 minutes (`passwordResetTtlMs` in `authService.ts`).
- **One-time use**: `confirmPasswordReset` consumes the challenge (`consumed_at`) inside the same transaction as the password update, via a conditional `UPDATE ... WHERE id = ? AND failed_attempts = ? AND consumed_at IS NULL` that only succeeds if nothing else touched the row first — a second concurrent confirm with the same code can't both succeed.
- **Invalidated on use**: confirming an unrelated *new* request also invalidates the old one — `createPasswordResetChallenge` marks any still-unconsumed challenge for that user as consumed before inserting the new one, so only the latest requested code is ever valid.
- **Failed-attempt lockout**: 5 wrong codes (`MAX_FAILED_ATTEMPTS`) locks the challenge (`consumed_at` set) even before it expires.
- **Request throttling**: 60s cooldown between requests, max 5 requests/hour per user (`RESEND_COOLDOWN_MS`, `MAX_SENDS_PER_WINDOW` in `passwordResetRepository.ts`) — independent of the general per-IP `createRequestRateLimit` used elsewhere, since this endpoint has no auth to key on.

## Session invalidation after reset

`confirmPasswordReset` revokes **all** of the user's sessions (`web_user_sessions`) in the same transaction as the password update — a successful reset always ends every existing login, on every device.

## Enumeration protection

- `requestPasswordReset` silently no-ops for an unknown email or an ineligible account (`isPasswordResetEligible`: must be active, not deleted, and have a verified email) — the route always returns the same 200 with a generic message regardless.
- The route doesn't await the service call before responding (`void requestPasswordReset(...).catch(...)`), so response timing doesn't leak whether the email exists via DB round-trip latency.
- `resetPassword` returns a plain `false` (→ generic 400) for an unknown/ineligible email, an invalid code, an expired challenge, or a locked-out challenge — the client can't distinguish these cases.

## Known gap

None found specific to this flow. The two gaps noted for the *in-app* password change (missing session revocation on that endpoint, no owner-triggered force-logout) are tracked in `sessions-and-tokens.md`, not here — this forgot-password flow already revokes everything on success.
