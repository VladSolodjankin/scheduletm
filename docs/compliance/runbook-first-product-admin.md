# Runbook: assigning the `product_admin` role

Internal operational runbook, per #215. `product_admin` is Meetli's global superuser role — it has cross-account access to every workspace and all system settings (see `docs/compliance/security-policy-access-control.md`). There is deliberately no path to create it through the application: `canCreateUserRole` (`server/src/policies/rolePermissions.ts`) refuses to let any role, including an existing `product_admin`, create another `product_admin` or `owner` via the Users API. The role is assigned only by a controlled, logged database operation, as already stated in `server/docs/rbac.md`.

This document exists so that the procedure doesn't get improvised ad hoc by whoever happens to have DB access that day.

## When this applies

- Bootstrapping the very first `product_admin` for a new environment.
- Granting `product_admin` to an additional trusted operator later.
- Recovery: the last known `product_admin` account is locked out and no one else can grant the role through the app (by design — there is no in-app path either way).

## Who may do this

This is **not** a routine action for any engineer with database credentials. It must be:

- Requested and approved by whoever owns production access decisions for Meetli (documented approval — a ticket, a signed-off message, whatever your team already uses for privileged changes — not just a Slack "go ahead").
- Performed by someone with direct database access, with the approval reference at hand.
- Logged: keep the approval reference, who ran it, when, and which account/email it targeted, somewhere durable (an incident/ops log, not just shell history).

## Procedure

1. **Get the target user's existing account.** The person must already have registered normally through the app (self-registration creates them as `owner` of a new account) or otherwise already exist as a `web_users` row. Do not hand-craft a new user row via SQL — `password_hash`/`password_salt` are PBKDF2 (`hashPassword` in `server/src/utils/crypto.js`, 310,000 iterations, SHA-256) with a per-user random salt; getting this right outside the app risks a weak or broken credential.

2. **Confirm identity before touching anything.** Look the row up by both id and email, and read it back to a human for confirmation — do not match on email alone if there's any chance of ambiguity:

   ```sql
   SELECT id, account_id, email, role, is_active, is_deleted
   FROM web_users
   WHERE email = 'the-persons-email@example.com';
   ```

3. **Promote the role, scoped to that exact row, inside a transaction:**

   ```sql
   BEGIN;

   UPDATE web_users
   SET role = 'product_admin', updated_at = now()
   WHERE id = <id from step 2> AND email = 'the-persons-email@example.com';
   -- Expect exactly 1 row updated. If it's not 1, ROLLBACK and investigate.

   COMMIT;
   ```

4. **No session action is needed afterward.** Sessions are opaque DB tokens, not JWTs — `resolveUserByAccessToken`/`refreshAccess` re-read the user's role from `web_users` on every request (see `server/docs/sessions-and-tokens.md`), so the new role takes effect on the person's very next request. If they're currently logged in, nothing needs to be revoked or reissued.

5. **Record the change** in your ops/incident log: timestamp, who ran it, the approval reference, and the target account's id/email.

## What NOT to do

- Don't do this from a personal/local psql session against production without an audit trail of the approval.
- Don't grant `product_admin` "just in case" — it's cross-tenant, treat it like root.
- Don't try to do this by inserting a brand-new row with a hand-picked password hash (see step 1).
