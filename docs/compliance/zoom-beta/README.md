# Zoom Beta compliance evidence (work in progress)

Last updated: 2026-05-02.

This directory stores redacted artifacts for Zoom Beta review.

## Status

- [~] TLS 1.2+ evidence for `www.meetli.cc` and `dev.meetli.cc` — commands and logs were added, but the current CI/container has no outbound access (`Network is unreachable`); rerun is required in a staging/prod connected runner.
- [~] DAST evidence on staging — a minimal report template and run command were added; the actual scan must be executed from an environment with network access to `dev.meetli.cc`.
- [x] Zoom Beta evidence package (structure) — SSDLC, Privacy Policy, security policy documents, and index were added.
- [ ] Full compliance-block closure — pending real SAST/DAST/TLS runs from a connected runner.

## Artifact index

- `index.md` — consolidated evidence table and current status.
- `tls-evidence.md` — TLS verification method and results.
- `dast-evidence.md` — DAST baseline method and results.
- `sast-evidence.md` — SAST report template and requirements.
- `ssdlc.md` — SSDLC summary for Zoom Beta.
- `privacy-policy.md` — privacy controls (redacted).
- `security-policy-access-control.md` — policy: access control and least privilege.
- `security-policy-vulnerability-management.md` — policy: vulnerability and patch management.
- `security-policy-incident-response.md` — policy: incident response and escalation.
- `evidence/tls-check-2026-05-02.txt` — raw output of TLS verification commands in this environment.


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
