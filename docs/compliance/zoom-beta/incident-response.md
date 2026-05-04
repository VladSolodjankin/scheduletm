# Incident Response

Effective date: 2026-05-03

This document summarizes Meetli's incident response process for public review.

The detailed policy is also maintained in:

- `security-policy-incident-response.md`

## 1. Objectives

Meetli's incident response process is designed to:

- Detect and confirm security incidents.
- Limit impact and prevent further harm.
- Restore service safely.
- Preserve enough evidence for investigation and follow-up.
- Learn from incidents and reduce recurrence risk.

## 2. Detection Sources

Potential incidents may be detected through:

- Application and infrastructure monitoring.
- Error logs and operational alerts.
- Security scan findings.
- Customer or third-party reports.
- Engineering investigation of suspicious behavior or abnormal access patterns.

## 3. Triage and Escalation

Meetli aims to begin triage quickly after detection. Early triage focuses on:

- Severity and scope.
- Affected data, users, or integrations.
- Whether the issue is active, contained, or historical.
- Required escalation to engineering or operational owners.

## 4. Containment and Recovery

Depending on the incident, Meetli may:

- Revoke sessions or credentials.
- Disable or disconnect an affected integration.
- Roll back or patch a defective release.
- Restrict access to affected workflows.
- Increase monitoring while recovery is underway.

Recovery actions are intended to restore service while preserving security and evidence quality.

## 5. Post-Incident Review

After a material incident, Meetli performs a follow-up review that may include:

- Root-cause analysis.
- Timeline reconstruction.
- Corrective and preventive actions.
- Documentation, test, or monitoring improvements.

## 6. Notification

Where required by law, contract, or risk level, Meetli will coordinate incident-related communications with affected customers and relevant stakeholders within a reasonable timeframe after confirming the nature and scope of the incident.
