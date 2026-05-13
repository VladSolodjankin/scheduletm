# Zoom Beta Evidence Index

Last updated: 2026-05-13

| Control / requirement | Artifact | Status | Notes |
|---|---|---|---|
| Privacy policy | `../privacy-policy.md` | Ready for external review | Public-facing policy aligned to current product scope and integration workflow. |
| Security policy overview | `../security-policy.md` | Ready for external review | Public-facing overview with transparent control posture. |
| Access control policy | `../security-policy-access-control.md` | Ready for external review | RBAC, least privilege, tenant scoping, and session protections. |
| Vulnerability policy | `../security-policy-vulnerability-management.md`, `../vulnerability-management.md` | Ready for external review | Public-facing process and release-gate expectations. |
| Incident response policy | `../security-policy-incident-response.md`, `../incident-response.md` | Ready for external review | Public-facing response lifecycle summary. |
| TLS 1.2+ evidence | `tls-1.2-evidence.md`, `evidence/tls-check-latest.txt`, `evidence/tls-summary-latest.md` | Ready | Latest evidence files are present. |
| DAST on staging | `dast-latest.md`, `evidence/zap-report.md`, `evidence/zap-report.json` | Review with remediation plan | Evidence is present; current findings status should be checked before making formal assurance claims. |
| SAST and dependency review | `sast-latest.md`, `evidence/npm-audit-latest.json`, `evidence/semgrep-latest.json` | Review with remediation plan | Evidence is present; open findings must be evaluated before release sign-off. |

## Definition of Done for External Sharing

1. Public-facing policy documents contain no placeholders, TODO items, secrets, or unsupported claims.
2. Policy language matches the implemented product behavior closely enough to avoid misleading users or reviewers.
3. Technical evidence files remain redacted and can be reviewed independently from the public policy set in `docs/compliance/`.
4. Formal production-readiness or compliance claims are made only after open findings in the evidence set are resolved or risk-accepted.
