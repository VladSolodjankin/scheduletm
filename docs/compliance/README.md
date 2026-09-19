# Compliance Documentation

Last updated: 2026-05-13

This directory separates public-facing policy documents from technical review artifacts.

## Public-facing policies

These documents are suitable for customer, partner, or reviewer access and are written to reflect the current production-intended behavior of the application.

- `privacy-policy.md`
- `security-policy.md`
- `security-policy-access-control.md`
- `security-policy-vulnerability-management.md`
- `security-policy-incident-response.md`
- `vulnerability-management.md`
- `incident-response.md`

## Internal runbooks

Operational procedures for privileged, DB-level changes that have no in-app path by design. Not customer-facing.

- `runbook-first-product-admin.md`

## Internal assessments

Point-in-time technical decisions, not standing policy — revisit when the stated trigger conditions change.

- `error-monitoring-assessment.md`

## Technical evidence packages

Technical evidence, scan summaries, and Zoom Marketplace review artifacts are maintained separately:

- `zoom-beta/README.md`
- `zoom-beta/index.md`
- `zoom-beta/tls-1.2-evidence.md`
- `zoom-beta/sast-latest.md`
- `zoom-beta/dast-latest.md`
- `zoom-beta/evidence/`

## Publishing note

Public policies should stay aligned with the implemented product behavior. Technical evidence may include ongoing remediation details and should be reviewed separately before making formal assurance or release-signoff claims.
