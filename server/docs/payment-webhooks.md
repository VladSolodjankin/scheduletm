# Payment setup and payment webhooks

Account-level (business) payment setup. Meetli takes no commission or fee, issues no fiscal receipts (54-FZ is out of
scope in v1) and has no refunds/deposits. The account either connects an online provider (a callback marks the
appointment paid) or the specialist marks it paid manually (`mark-paid` / `mark-unpaid`).

## Data model (migration `20261024090000_create_payment_setup`)

| Table | Purpose |
|---|---|
| `account_payment_settings` | One row per account: `active_provider` (`stripe`/`yookassa`/`bog`/null), manual methods (bank transfer text, custom link title+URL, cash comment, each with an `*_enabled` flag). |
| `account_payment_providers` | Connected providers: non-secret `config_json` (shopId / clientId / Stripe account id), `secret_encrypted` (AES-256-GCM, see `integration-secrets.md`), `webhook_token_hash`. Unique `(account_id, provider)`. |
| `payment_orders` | One row per checkout attempt: amount (whole units), currency, status `pending/paid/failed/cancelled/duplicate/mismatch`, `redirect_url`. Unique `(provider, provider_order_id)`; partial unique index allows one `pending` order per appointment. |
| `payment_webhook_events` | `(provider, event_id)` idempotency with a lease (same shape as `zoom_webhook_events`). |
| `appointment_payment_tokens` | Client payment link tokens (random 32 bytes, base64url). Only the SHA-256 is stored. Expiry = appointment time + 30 days (min 7 days from issue). |
| `stripe_oauth_states` | Single-use Stripe OAuth state, 10 minute TTL (copy of the Zoom pattern). |

No backfill: existing accounts start with no method configured, so payment reminders pause until the owner configures
one (main menu > Payments).

## Amount rule

`appointments.price` (snapshot taken at creation; the specialist `price_override` wins over `services.price`, also for
admin-created appointments) if `> 0`; otherwise the current resolved service price if `> 0`; otherwise `0`.
**Amount 0 means no payment at all**: no Pay button, no manual details on the public page and no `payment_reminder`.

## Payment reminders

`payment_reminder` is sent only when the appointment is unpaid and not cancelled, the amount is `> 0` and the account has
at least one usable method (active+connected provider that supports the currency, or any enabled manual method).
The gate runs in the job **before** the unique `(appointment_id, type, channel)` notifications row is written
(otherwise a skipped reminder could never be sent later) and again defensively in `sendAppointmentNotificationByType`
(fresh `is_paid` re-read). Email and Telegram show the amount, the Pay link (`${APP_URL}/pay/${token}`, only for online
payable cases) and the enabled manual methods. Copy comes from `server/src/i18n/paymentCopy.ts`; the locale is the
account locale (`account_settings.locale`, `ru-*` -> ru, `en-*` -> en, fallback ru). `POST /api/settings/payments/test-reminder`
sends the same email with a sample amount only to the requesting user and does not write `notifications`.

## Providers

| Provider | Currency | Connect | Checkout | Notification |
|---|---|---|---|---|
| Stripe (Standard connected account) | USD, EUR, GBP, GEL, PLN, CZK, CHF, CAD, AUD, NZD, SEK, NOK, DKK | OAuth (`/api/integrations/stripe/oauth/start` + callback) | Checkout Session, direct charge with `Stripe-Account`, no application fee | `POST /api/integrations/stripe/webhook`, `Stripe-Signature` HMAC over the raw body, 5 min tolerance, `event.account` must match the connected account |
| YooKassa | RUB | shop id + secret key, validated with `GET /v3/me` | `POST /v3/payments` (redirect confirmation) | `POST /api/integrations/yookassa/webhook/:accountToken` - **not signed**: the body is only a trigger; the payment is re-fetched with the account credentials and status/amount/currency are checked |
| Bank of Georgia (Payment API, not iPay) | GEL, USD, EUR, GBP | client id + secret, validated by a token request | `POST /payments/v1/ecommerce/orders` with `callback_url` and `Idempotency-Key` | `POST /api/integrations/bog/callback/:accountToken`, `Callback-Signature` = SHA256withRSA over the raw body with BOG's published public key (constant in `bogAdapter.ts`) |

Platform env (all optional; Stripe is usable only when ALL four are set - otherwise OAuth start answers 503 with the missing names, the Pay button is hidden and checkout answers 409, so a charge can never happen without a webhook to mark it paid): `STRIPE_CLIENT_ID`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_OAUTH_REDIRECT_URI`. YooKassa and BOG need no platform env.

Per-account URLs for YooKassa/BOG contain an opaque token derived as `HMAC-SHA256(APP_ENCRYPTION_KEY, "payment-webhook:<provider>:<accountId>")`
so the URL can be shown again in Settings; only its SHA-256 is stored for lookup. Rotating `APP_ENCRYPTION_KEY`
therefore changes these URLs (re-save the provider and update the URL in the provider dashboard). The token segment is
masked in access logs (`utils/logMasking.ts`).

Setup in the provider dashboards:
- Stripe: Connect webhook endpoint -> `<API_BASE_URL>/api/integrations/stripe/webhook`, events `checkout.session.completed`,
  `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.
- YooKassa: Integration -> HTTP notifications -> the account's `webhookUrl` from Settings, event `payment.succeeded` (and `payment.canceled`).
- BOG: the `callback_url` is sent with every order; nothing to configure in the dashboard.

## Webhook processing rules

1. Raw bytes are captured per path in `app.ts` (`express.json({ verify })`) before the global parser.
2. Signature (Stripe, BOG) or provider re-fetch (YooKassa) is verified before anything else: invalid -> `401`, no state change.
3. The order is resolved **only** through our `payment_orders` row; the account comes from the row (and must equal the URL-token account / Stripe account). A verified event for an order we do not have (yet) -> `404`, so the provider retries; an order of another account -> `200`, ignored.
4. `(provider, event_id)` lease: replays and in-flight duplicates return `200` without effect; on an internal error the lease is released and `500` makes the provider retry.
5. One transaction: amount/currency must equal the order, otherwise status `mismatch` (appointment NOT paid, logged). An already paid order or an already paid appointment -> `duplicate`, no state change. Success -> order `paid`, `appointments.is_paid = true`, audit event `payment-received` (`actor_web_user_id = null`, provider in metadata).
6. `mark-unpaid` and `mark-paid` are audit actions `mark-unpaid` / `mark-paid`; `appointment_events.action` has no DB CHECK.

## Public payment link

`GET /api/public/payments/:token` and `POST /api/public/payments/:token/checkout` are unauthenticated and rate-limited per IP.
Checkout reuses a still-pending order (same provider/amount/currency, younger than 10 minutes) instead of creating duplicates.

Return URLs are cosmetic (`/pay/:token?status=success|fail`, never trusted for state). Manual `mark-paid` cancels the appointment's pending orders in the same transaction, so a later payment on an old link is stored as `duplicate`. `payment_orders.amount` has `CHECK (amount > 0)` (migration `20261024100000_add_payment_orders_amount_check`).
BOG: `request_amount` is what we asked for, `transfer_amount` what was processed; if they differ the processed amount is reported and the order becomes `mismatch`.
