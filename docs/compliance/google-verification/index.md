# Google Verification Evidence Index

Last updated: 2026-10-19

| Control / requirement | Artifact | Status | Notes |
|---|---|---|---|
| Privacy policy | `../privacy-policy.md` | Ready for external review | Section 6 "Google Calendar integration data" covers what is read and written, the opt-in write setting, retention and deletion behavior, and the Google API Services User Data Policy Limited Use statement. The public copy lives in `web/src/content/legal/privacy-policy.md` and must stay identical. |
| Security policy overview | `../security-policy.md` | Ready for external review | Public-facing overview with transparent control posture. |
| OAuth scope minimality (Google) | `oauth-scope-review.md` | Reviewed, compliant | Base scopes `openid`, `userinfo.email`, `calendar.freebusy`; `calendar.events.owned` only on demand when the user enables event writing. No full `calendar`, Gmail, Drive, or People scope. |
| Sensitive vs. restricted classification | `oauth-scope-review.md` | Reviewed — confirm in Cloud Console | Calendar scopes are sensitive-tier, none restricted, so standard verification applies and CASA is not required. The classification of `calendar.freebusy` and `calendar.events.owned` must be confirmed in the Cloud Console scope picker. |
| Opt-in for event writing | `oauth-scope-review.md` | Implemented | "Create appointments in my Google Calendar" switch, off by default; enabling without the write scope returns 409 and offers reconnect; granular consent respected. |
| Event content minimization | `oauth-scope-review.md` | Implemented | Service name, time, location or meeting link, internal appointment id only. No client PII, no attendees, `sendUpdates=none`. |
| Token caching/refresh-before-expiry | `oauth-scope-review.md` | Reviewed, compliant | Shared helper reuses the cached token and refreshes ~30s before expiry. |
| Integration secret encryption at rest | `../../../server/docs/integration-secrets.md` | Completed 2026-09-15 | Google tokens in `web_user_integrations` are AES-256-GCM encrypted (issue #228). Google scope, write-setting, and event-sync design are described in the same document. |

## Remaining before submission

- Cloud Console: confirm the two scopes and their classification, consent screen branding and links, authorized domain and Search Console verification, production redirect URI, publishing status "In production".
- Record the demo video (script in `oauth-scope-review.md`).
- Submit for standard verification (CASA not required) and respond to Google's reviewer.

## Definition of Done for External Sharing

1. Public-facing policy documents contain no placeholders, TODO items, secrets, or unsupported claims.
2. Policy language matches the implemented product behavior closely enough to avoid misleading users or reviewers.
3. Formal verification submission is made only after consent screen branding and the demo video are ready.
