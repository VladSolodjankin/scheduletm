# TLS 1.2+ evidence

Date: 2026-05-02.

## Scope

- `www.meetli.cc`
- `dev.meetli.cc`

## Commands

```bash
openssl s_client -connect www.meetli.cc:443 -servername www.meetli.cc -tls1_2
openssl s_client -connect dev.meetli.cc:443 -servername dev.meetli.cc -tls1_2
openssl s_client -connect www.meetli.cc:443 -servername www.meetli.cc -tls1_1
openssl s_client -connect dev.meetli.cc:443 -servername dev.meetli.cc -tls1_1
```

## Current run result

Raw log: `evidence/tls-check-2026-05-02.txt`.

Status: **Partial**.

Reason: the current environment returned `BIO_connect: Network is unreachable`, so this evidence cannot be treated as final.

## TODO (to close this item)

- Re-run the commands from a connected CI runner or staging bastion with outbound internet access.
- Capture:
  - successful TLS 1.2 handshake;
  - no support for TLS 1.0/1.1 (or a documented compensating control if those versions are enabled).
- Add timestamp, hostname, and commit SHA.
