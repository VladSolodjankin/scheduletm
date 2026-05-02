# DAST evidence (staging)

Date: 2026-05-02.

## Target

- `https://dev.meetli.cc`

## Minimal baseline (KISS)

Recommended baseline tool: OWASP ZAP baseline scan (or equivalent in current CI).

Example command:

```bash
zap-baseline.py -t https://dev.meetli.cc -r dast-report.html -J dast-report.json
```

## Current status

**Partial**: DAST tools are not available in the current container (`zap-baseline.py`, `docker`) and there is no outbound network access for external scanning.

## TODO for full closure

1. Run baseline DAST in a CI/staging runner with network access.
2. Attach artifacts (`.html/.json`) in CI and add a redacted summary to this directory.
3. Record high/critical findings = 0, or provide a mitigation plan with due dates.
