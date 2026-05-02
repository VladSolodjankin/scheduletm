# Zoom Beta compliance evidence (work in progress)

Last updated: 2026-05-02.

This directory stores redacted artifacts for Zoom Beta review.

## Status

- [x] TLS 1.2+ evidence for `www.meetli.cc` and `dev.meetli.cc` is collected in `evidence/tls-check-latest.txt` and `evidence/tls-summary-latest.md`.
- [x] DAST baseline evidence on staging is collected in `evidence/zap-report.md` and `evidence/zap-report.json` (current result: `High=0`, `Medium=2`).
- [x] Zoom Beta evidence package (structure) — SSDLC, Privacy Policy, security policy documents, and index were added.
- [~] Full compliance-block closure — findings remediation is tracked in `evidence/remediation-plan-2026-05-02.md`.

## Artifact index

- `index.md` — consolidated evidence table and current status.
- `tls-1.2-evidence.md` — TLS verification method and results.
- `dast-latest.md` — DAST baseline method and latest status.
- `sast-latest.md` — SAST report template and latest status.
- `privacy-policy.md` — privacy controls (redacted).
- `security-policy-access-control.md` — policy: access control and least privilege.
- `security-policy-vulnerability-management.md` — policy: vulnerability and patch management.
- `security-policy-incident-response.md` — policy: incident response and escalation.
- `evidence/tls-check-latest.txt` — latest raw output of TLS verification commands.
- `evidence/npm-audit-latest.json` — latest production dependency vulnerability report.
- `evidence/semgrep-latest.json` — latest SAST findings export.
- `evidence/zap-report.md` and `evidence/zap-report.json` — latest DAST findings.
- `evidence/remediation-plan-2026-05-02.md` — prioritized remediation plan based on current findings.

## GitHub Actions automation

A CI workflow is available at `.github/workflows/zoom-beta-compliance.yml` to automate:
- TLS evidence collection (`scripts/compliance/tls_evidence.sh`),
- DAST baseline run (OWASP ZAP action),
- SAST run (CodeQL).

Recommended repository variables:
- `ZOOM_EVIDENCE_PROD_HOST` (default: `www.meetli.cc`)
- `ZOOM_EVIDENCE_STAGE_HOST` (default: `dev.meetli.cc`)
- `ZOOM_EVIDENCE_DAST_TARGET` (default: `https://dev.meetli.cc`)

Compatibility docs for CI docs-check:
- `security-policy.md`
- `incident-response.md`
- `vulnerability-management.md`
- `sast-latest.md`
- `dast-latest.md`
- `tls-1.2-evidence.md`
