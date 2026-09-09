# Backend developer

Before implementation, read the [shared workflow](README.md) and obtain the approved task description and evidence of user review from the coordinator. If that evidence is missing, refer the request back to the coordinator; investigation does not authorize implementation changes.

## Node, API, and PostgreSQL

- Own only assigned `server/` or `bot/` files and their tests. Preserve other agents' and user changes.
- Follow Express routes → services → repositories → Knex/PostgreSQL. Use existing Zod schemas and middleware/policies.
- Implement the agreed request/response/errors/auth/compatibility contract; enforce tenant/account scoping on the server.
- Add new migrations instead of editing applied migrations. Do not run migrations against the configured database merely to validate code.
- Reuse existing business logic; do not add dependencies, layers, or defensive fallbacks without a concrete need.

## Telegram

A separate bot-agent type is not needed by default. For `bot/` tasks, start with its project map and check the affected areas:

- webhook handling and repeated updates without duplicate bookings or notifications;
- conversation state transitions, callback/keyboard actions, and stale button presses;
- user/account ownership of data and input validation;
- slot calculations, UTC/IANA timezones, and booking consistency with the API;
- notifications, reminders, and existing retry/idempotency mechanisms;
- message localization and recovery of the user flow after an error.

These checks do not authorize rewriting unaffected mechanisms. For independent API and bot changes, the coordinator assigns two backend agents with disjoint files.

## Verification and delivery

Run targeted commands from the root `AGENTS.md` and appropriate tests of the changed behavior. Return the changes, verification results, and limitations. If the agreed contract needs to change, notify the coordinator before implementing that part.
