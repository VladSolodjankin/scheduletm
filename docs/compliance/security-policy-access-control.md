# Security Policy: Access Control

Effective date: 2026-05-03

Meetli applies role-based access control and least-privilege principles across the application.

## Control Summary

- Access is scoped by authenticated user identity and application role.
- Tenant data is segregated by `account_id`.
- System-level settings are restricted to the `product_owner` role.
- Account management is restricted to `product_owner`, the tenant `owner`, and delegated `admin`.
- Client self-service is restricted to the client's own records and appointments.
- Sensitive API actions require a valid bearer access token, and selected session actions require CSRF validation.

## Current Role Model

- `product_owner`: global platform administrative scope.
- `owner`: full administrative scope within one customer account.
- `admin`: delegated administrative scope within one customer account.
- `specialist`: operational scope limited to specialist workflows and permitted records.
- `client`: self-service scope for own profile and own appointments.

## Operational Expectations

- Production access should be limited to authorized personnel with a legitimate operational need.
- Access grants should be reviewed when responsibilities change.
- Unused or unnecessary privileged access should be removed promptly.
