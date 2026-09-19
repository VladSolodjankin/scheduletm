# Sessions and tokens

Reviewed as part of #223. Sessions are opaque, DB-backed tokens (table `web_user_sessions`), not JWTs — there are no claims to go stale, since every request re-reads the user's current role/`is_active`/`is_deleted` state from `web_users` (see "Permission re-evaluation" below).

## Token types and lifetimes

Each login/refresh creates **two** rows in `web_user_sessions` (`session_type: 'access' | 'refresh'`), both plain random tokens (`createToken()`, 32 random bytes hex):

| Token | Transport | Lifetime (env var, default) | Where checked |
|---|---|---|---|
| Access | `Authorization: Bearer <token>` header | `ACCESS_TOKEN_TTL_SECONDS`, 900s (15 min) | `requireAccessToken` → `resolveUserByAccessToken` (`authService.ts`) |
| Refresh | `httpOnly` cookie, path `/api/auth`, `sameSite: lax`, `secure` in production | `REFRESH_TOKEN_TTL_DAYS`, 30 days | `POST /api/auth/refresh` → `refreshAccess` |

A CSRF token (non-`httpOnly`, `sameSite: strict`) is issued alongside and checked (`x-csrf-token` header vs. cookie) on `/api/auth/refresh` and `/api/auth/logout` — the refresh cookie alone can't be used cross-site without it.

## Refresh rotation

`POST /api/auth/refresh` (`authRoutes.ts`) rotates on every use: `refreshAccess` revokes the presented refresh token, then `issueSession` mints a **new** access+refresh pair. A stolen refresh token that gets used by an attacker and then by the legitimate client (or vice versa) results in the second user's refresh failing with `sessionRefreshFailed`, since the token was already revoked — this doesn't detect the theft, but stops a replayed old refresh token from working forever.

## Permission re-evaluation

Both `resolveUserByAccessToken` and `refreshAccess` re-fetch the user row from `web_users` on every call and re-check `is_active`/`is_deleted`/account-active — nothing about role or active-state is cached in the token itself. **A role change, deactivation, or deletion takes effect on the user's very next request**, no explicit session revocation needed for that case specifically.

## What revokes sessions today

| Trigger | Where | Scope |
|---|---|---|
| Explicit logout | `POST /api/auth/logout` | Only the caller's own access+refresh token pair (by token value) |
| Forgot-password reset (`POST /api/auth/password-reset/confirm`) | `confirmPasswordReset` (`passwordResetRepository.ts`) | **All** sessions for that user |
| Email change confirm (`POST /api/auth/email-change/confirm`) | `confirmEmailChange` (`emailChangeRepository.ts`) | **All** sessions for that user |
| Owner/admin deactivates a managed user | `deactivateManagedUser` (`userManagementService.ts`) | **All** sessions for that user |
| Owner/admin deletes a managed user | `deleteManagedUser` (`userManagementService.ts`) | **All** sessions for that user |
| Role change (`updateManagedUser`) | — | None needed — see "Permission re-evaluation" above |

## Known gaps (not fixed here — flagging for a follow-up)

- **In-app password change has no session revocation.** `POST /api/settings/user/password/confirm` (`settingsRoutes.ts`) changes the password but leaves every other active session (other devices/browsers) valid. Forgot-password reset and email-change both revoke everything; this endpoint should revoke every *other* session (keeping the caller's own session alive, since it's an authenticated self-service action) — that needs a "delete by web_user_id except this token" repository method that doesn't exist yet.
- **No owner/product_admin action to force-logout an active user.** Today session revocation only happens as a side effect of deactivating or deleting the account. There is no standalone "revoke this user's sessions" action for an account that should otherwise stay active (e.g. suspected compromised credentials).
- Fixed as part of this review: `POST /api/settings/user/password/confirm` had no code-expiry check at all (an OTP sent once would stay valid indefinitely) and no rate limit on the confirm attempt. Both are fixed — a 10-minute expiry (matching the forgot-password OTP TTL) and a 10/min limit on the confirm endpoint.
