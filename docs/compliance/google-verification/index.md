# Google Verification Evidence Index

Last updated: 2026-09-21

| Control / requirement | Artifact | Status | Notes |
|---|---|---|---|
| Privacy policy | `../privacy-policy.md` | Ready for external review | Public-facing policy aligned to current product scope and integration workflow. |
| Security policy overview | `../security-policy.md` | Ready for external review | Public-facing overview with transparent control posture. |
| OAuth scope minimality (Google) | `oauth-scope-review.md` | Reviewed, compliant | Only `openid`, `userinfo.email`, `calendar.readonly` requested; no broader Calendar/Gmail/Drive scope. |
| Sensitive vs. restricted classification | `oauth-scope-review.md` | Reviewed | All three scopes are non-sensitive or sensitive-tier; none are restricted, so standard verification applies — CASA is not required. |
| Token caching/refresh-before-expiry | `oauth-scope-review.md` | Reviewed, compliant | `calendarAvailabilityService.ts` reuses the cached token and refreshes ~30s before expiry; matches the pattern already reviewed for Zoom. |
| Integration secret encryption at rest | `../../../server/docs/integration-secrets.md` | Completed 2026-09-15 | Google refresh/access tokens in `web_user_integrations` are AES-256-GCM encrypted (issue #228). |

## Remaining before submission

- OAuth consent screen branding (logo, app name, authorized domain) in Google Cloud Console.
- Demo video of the Google Calendar connect flow.
- Submit for standard verification (CASA not required per the scope classification above).

## Definition of Done for External Sharing

1. Public-facing policy documents contain no placeholders, TODO items, secrets, or unsupported claims.
2. Policy language matches the implemented product behavior closely enough to avoid misleading users or reviewers.
3. Formal verification submission is made only after consent screen branding and the demo video are ready.
