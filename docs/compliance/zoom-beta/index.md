# Zoom Beta evidence index

| Control / requirement | Artifact | Status | Notes |
|---|---|---|---|
| SSDLC | `ssdlc.md` | ✅ Ready | Redacted summary. |
| Privacy Policy | `privacy-policy.md` | ✅ Ready | Policy mapping + TODO link to the public legal page. |
| Security policy #1 | `security-policy-access-control.md` | ✅ Ready | RBAC, MFA, least privilege. |
| Security policy #2 | `security-policy-vulnerability-management.md` | ✅ Ready | SAST/DAST, patch SLA. |
| Security policy #3 | `security-policy-incident-response.md` | ✅ Ready | Detection/triage/escalation/RCA. |
| TLS 1.2+ evidence | `tls-evidence.md`, `evidence/tls-check-2026-05-02.txt` | ⚠️ Partial | No outbound network in current container; verify in connected runner. |
| DAST on staging | `dast-evidence.md` | ⚠️ Partial | Real run is required against `dev.meetli.cc`. |
| SAST in CI | `sast-evidence.md` | ⚠️ Partial | Actual CI report + commit hash required. |

## Definition of Done

1. TLS evidence contains successful checks for production + staging endpoints, including Zoom OAuth callback/API path.
2. DAST report on staging contains date, commit, tool version, and high/critical findings status.
3. SAST report from CI contains date, commit, and high/critical findings status.
4. All documents in this directory are redacted (no secrets, tokens, or personal data).
