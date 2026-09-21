# Zoom Beta Evidence Index

Last updated: 2026-09-21

| Control / requirement | Artifact | Status | Notes |
|---|---|---|---|
| Privacy policy | `../privacy-policy.md` | Ready for external review | Public-facing policy aligned to current product scope and integration workflow. |
| Security policy overview | `../security-policy.md` | Ready for external review | Public-facing overview with transparent control posture. |
| Access control policy | `../security-policy-access-control.md` | Ready for external review | RBAC, least privilege, tenant scoping, and session protections. |
| Vulnerability policy | `../security-policy-vulnerability-management.md`, `../vulnerability-management.md` | Ready for external review | Public-facing process and release-gate expectations. |
| Incident response policy | `../security-policy-incident-response.md`, `../incident-response.md` | Ready for external review | Public-facing response lifecycle summary. |
| TLS 1.2+ evidence | `tls-1.2-evidence.md`, `evidence/tls-check-latest.txt`, `evidence/tls-summary-latest.md` | Ready | Evidence dated 2026-09-21. TLS 1.2 accepted and TLS 1.1 rejected on both hosts. The weekly CI check had been silently failing since 2026-08-17 on modern OpenSSL (client could no longer even attempt a TLS 1.1 handshake); `scripts/compliance/tls_evidence.sh` was fixed to handle that case. |
| DAST on staging | `dast-latest.md`, `evidence/zap-report.md`, `evidence/zap-report.json` | Ready | Evidence dated 2026-09-21. 0 high/critical OWASP ZAP alerts against `https://dev.meetli.cc`. |
| SAST and dependency review | `sast-latest.md`, `evidence/npm-audit-latest.json`, `evidence/semgrep-latest.json` | Ready | Evidence dated 2026-09-21. 0 high/critical npm audit findings, 0 Semgrep ERROR findings. Six prior Semgrep findings were false positives (`node-child-process-shell-with-variable` matched `RegExp.exec()` calls; the codebase has no `child_process` usage at all) — the rule in `scripts/compliance/semgrep.yml` was scoped to require an actual `child_process` import. `authTagLength: 16` was also made explicit on the AES-256-GCM cipher/decipher calls (functionally a no-op; Node already defaults to 16 and the code already rejects non-16-byte tags). |
| OAuth scope minimality (Zoom) | `oauth-scope-and-token-handling.md` | Reviewed, compliant | Only `meeting:read:meeting`/`meeting:write:meeting` requested; no broader scopes. |
| Token caching/refresh-before-expiry (Zoom requirement) | `oauth-scope-and-token-handling.md` | Reviewed, compliant | `zoomService.ts` reuses the cached token and refreshes ~30s before expiry rather than on every call. The Google Calendar half of this audit (issue #234) is also resolved: `calendarAvailabilityService.ts` used the same cache/refresh pattern already, and a gap where a failed/missing Google refresh crashed availability lookups for unrelated specialists (instead of degrading gracefully) has been fixed — a specialist with revoked/expired Google access is now skipped with a logged warning rather than failing the whole request. |
| Integration secret encryption at rest | `../../../server/docs/integration-secrets.md` | Completed 2026-09-15 | Plaintext OAuth token columns removed from `web_user_integrations` (issue #228); all Google/Zoom/Telegram secrets in that table are now AES-256-GCM encrypted only. |
| On Behalf Of (OBF) token applicability | `oauth-scope-and-token-handling.md` | Resolved — not applicable | App uses the Meetings REST API only, never the Meeting SDK / joins meetings; OBF (effective 2026-03-02) is scoped to Meeting SDK apps joining outside their own account. State this explicitly in the Technical Design Review submission. |

## Definition of Done for External Sharing

1. Public-facing policy documents contain no placeholders, TODO items, secrets, or unsupported claims.
2. Policy language matches the implemented product behavior closely enough to avoid misleading users or reviewers.
3. Technical evidence files remain redacted and can be reviewed independently from the public policy set in `docs/compliance/`.
4. Formal production-readiness or compliance claims are made only after open findings in the evidence set are resolved or risk-accepted.
