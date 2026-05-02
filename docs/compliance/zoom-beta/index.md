# Zoom Beta evidence index

| Control / requirement | Artifact | Status | Notes |
|---|---|---|---|
| SSDLC | `ssdlc.md` | ✅ Ready | Redacted summary. |
| Privacy Policy | `privacy-policy.md` | ✅ Ready | Policy mapping + TODO link to the public legal page. |
| Security policy #1 | `security-policy-access-control.md` | ✅ Ready | RBAC, MFA, least privilege. |
| Security policy #2 | `security-policy-vulnerability-management.md` | ✅ Ready | SAST/DAST, patch SLA. |
| Security policy #3 | `security-policy-incident-response.md` | ✅ Ready | Detection/triage/escalation/RCA. |
| TLS 1.2+ evidence | `tls-1.2-evidence.md`, `evidence/tls-check-latest.txt`, `evidence/tls-summary-latest.md` | ✅ Ready | Latest run: 2026-05-02. |
| DAST on staging | `dast-latest.md`, `evidence/zap-report.md`, `evidence/zap-report.json` | ⚠️ In progress | Latest run: High=0, Medium=1; hardening still required. |
| SAST in CI | `sast-latest.md`, `evidence/npm-audit-latest.json`, `evidence/semgrep-latest.json` | ⚠️ In progress | Findings must be closed or risk-accepted. |

## Definition of Done

1. TLS evidence contains successful checks for production + staging endpoints, including Zoom OAuth callback/API path.
2. DAST report on staging contains date, commit, tool version, and High/Critical findings status (`High=0`, `Critical=0`).
3. SAST report from CI contains date, commit, and High/Critical findings status (`High=0`, `Critical=0`).
4. All documents in this directory are redacted (no secrets, tokens, or personal data).
