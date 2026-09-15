# Zoom Beta Evidence Index

Last updated: 2026-09-15

| Control / requirement | Artifact | Status | Notes |
|---|---|---|---|
| Privacy policy | `../privacy-policy.md` | Ready for external review | Public-facing policy aligned to current product scope and integration workflow. |
| Security policy overview | `../security-policy.md` | Ready for external review | Public-facing overview with transparent control posture. |
| Access control policy | `../security-policy-access-control.md` | Ready for external review | RBAC, least privilege, tenant scoping, and session protections. |
| Vulnerability policy | `../security-policy-vulnerability-management.md`, `../vulnerability-management.md` | Ready for external review | Public-facing process and release-gate expectations. |
| Incident response policy | `../security-policy-incident-response.md`, `../incident-response.md` | Ready for external review | Public-facing response lifecycle summary. |
| TLS 1.2+ evidence | `tls-1.2-evidence.md`, `evidence/tls-check-latest.txt`, `evidence/tls-summary-latest.md` | Ready | Latest evidence files are present. |
| DAST on staging | `dast-latest.md`, `evidence/zap-report.md`, `evidence/zap-report.json` | Review with remediation plan | Evidence dated 2026-08-10; rerun the pipeline shortly before submission so the timestamp is current. |
| SAST and dependency review | `sast-latest.md`, `evidence/npm-audit-latest.json`, `evidence/semgrep-latest.json` | Review with remediation plan | Evidence dated 2026-08-10; a local `npm audit` on 2026-09-15 found 12 advisories, all in web-build devDependencies (vite/postcss/sharp/qs/nanoid), fixable via `npm audit fix` — none affect the deployed server runtime. Rerun the CI pipeline for a current signed-off snapshot. |
| OAuth scope minimality (Zoom) | `oauth-scope-and-token-handling.md` | Reviewed, compliant | Only `meeting:read:meeting`/`meeting:write:meeting` requested; no broader scopes. |
| Token caching/refresh-before-expiry (Zoom requirement) | `oauth-scope-and-token-handling.md` | Reviewed, compliant | `zoomService.ts` reuses the cached token and refreshes ~30s before expiry rather than on every call. The Google Calendar half of this audit (issue #234) is also resolved: `calendarAvailabilityService.ts` used the same cache/refresh pattern already, and a gap where a failed/missing Google refresh crashed availability lookups for unrelated specialists (instead of degrading gracefully) has been fixed — a specialist with revoked/expired Google access is now skipped with a logged warning rather than failing the whole request. |
| Integration secret encryption at rest | `../../../server/docs/integration-secrets.md` | Completed 2026-09-15 | Plaintext OAuth token columns removed from `web_user_integrations` (issue #228); all Google/Zoom/Telegram secrets in that table are now AES-256-GCM encrypted only. |
| On Behalf Of (OBF) token applicability | `oauth-scope-and-token-handling.md` | Resolved — not applicable | App uses the Meetings REST API only, never the Meeting SDK / joins meetings; OBF (effective 2026-03-02) is scoped to Meeting SDK apps joining outside their own account. State this explicitly in the Technical Design Review submission. |

## Definition of Done for External Sharing

1. Public-facing policy documents contain no placeholders, TODO items, secrets, or unsupported claims.
2. Policy language matches the implemented product behavior closely enough to avoid misleading users or reviewers.
3. Technical evidence files remain redacted and can be reviewed independently from the public policy set in `docs/compliance/`.
4. Formal production-readiness or compliance claims are made only after open findings in the evidence set are resolved or risk-accepted.
