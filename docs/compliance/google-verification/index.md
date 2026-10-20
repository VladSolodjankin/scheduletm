# Google Verification Evidence Index

Last updated: 2026-10-20

| Control / requirement | Artifact | Status | Notes |
|---|---|---|---|
| Privacy policy | `../privacy-policy.md` | Ready for external review | Section 6 "Google Calendar integration data" covers availability lookups, owner-only live display of the user's own event titles, automatic event writing, retention and deletion behavior, and the Google API Services User Data Policy Limited Use statement. The public copy lives in `web/src/content/legal/privacy-policy.md` and must stay identical. |
| Security policy overview | `../security-policy.md` | Ready for external review | Public-facing overview with transparent control posture. |
| OAuth scope minimality (Google) | `oauth-scope-review.md` | Reviewed, compliant | One consent requests `openid`, `userinfo.email`, `calendar.freebusy`, `calendar.events.owned`. No full `calendar`, Gmail, Drive, or People scope. |
| Sensitive vs. restricted classification | `oauth-scope-review.md` | Confirmed in Cloud Console 2026-10-20 | `openid`, `userinfo.email`, `calendar.freebusy` non-sensitive; `calendar.events.owned` sensitive; none restricted, so standard verification applies and CASA is not required. |
| Write permission handling | `oauth-scope-review.md` | Implemented | Write permission is required for the integration; if the user unticks it on Google's consent screen the connection fails (`reason=calendar_write_required`) and nothing is kept. |
| Owner-only event titles | `oauth-scope-review.md` | Implemented | Titles read live via `events.list` only for the connected user viewing their own appointments calendar; never cached, stored, logged, or shown to anyone else. |
| Event content minimization | `oauth-scope-review.md` | Implemented | Service name, time, location or meeting link, internal appointment id only. No client PII, no attendees, `sendUpdates=none`. |
| Token caching/refresh-before-expiry | `oauth-scope-review.md` | Reviewed, compliant | Shared helper reuses the cached token and refreshes ~30s before expiry. |
| Integration secret encryption at rest | `../../../server/docs/integration-secrets.md` | Completed 2026-09-15 | Google tokens in `web_user_integrations` are AES-256-GCM encrypted (issue #228). Google scope, event-sync, and owner-title design are described in the same document. |
| Cloud Console configuration | — | Partly done 2026-10-20 | Branding, links, scopes, and the production redirect URI are set. Remaining: logo, domain verification in Search Console, publishing status. |

## Remaining before submission

- Cloud Console: upload the logo, verify `meetli.cc` in Search Console, publishing status "In production".
- Verify the flow in Testing with a test account.
- Record the demo video (script in `oauth-scope-review.md`).
- Submit for standard verification (CASA not required) and respond to Google's reviewer.

## Definition of Done for External Sharing

1. Public-facing policy documents contain no placeholders, TODO items, secrets, or unsupported claims.
2. Policy language matches the implemented product behavior closely enough to avoid misleading users or reviewers.
3. Formal verification submission is made only after consent screen branding and the demo video are ready.
