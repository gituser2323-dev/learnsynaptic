# ADR-0005: Four separate encryption keys, one per credential purpose

**Status: Accepted, implemented (Module 6.3 onward).**

## Context

This app encrypts several genuinely different classes of sensitive
data at rest: per-organization integration credentials (Module 8.2),
outbound webhook endpoint secrets (Module 6.5), Calendar/Meeting OAuth
tokens (Module 6.3), and MFA TOTP secrets (RC-1). The simplest
implementation would reuse one existing secret (e.g.
`JWT_ACCESS_TOKEN_SECRET`) for all of them.

## Decision

Four independent AES-256-GCM keys, one per purpose:
`TENANT_CREDENTIAL_ENCRYPTION_SECRET`, `WEBHOOK_SECRET_ENCRYPTION_SECRET`,
`CALENDAR_TOKEN_ENCRYPTION_SECRET`, `MFA_ENCRYPTION_SECRET`. Never
share one value across two of them.

## Consequences

- **Key-hygiene isolation**: a leak of one purpose's key never
  compromises another's. If `WEBHOOK_SECRET_ENCRYPTION_SECRET` were
  ever exposed (e.g. in a misconfigured log), an attacker gains
  nothing toward decrypting MFA secrets or tenant AI/WhatsApp
  credentials.
- Four secrets to provision and protect instead of one — a real,
  accepted operational cost. Each falls back to a dev-only, checked-
  into-source value when unset (never safe for production);
  `lib/startupValidation.ts` logs a loud error at boot if any is
  missing in production.
- **No key-versioning/rotation mechanism exists today** — a disclosed,
  known gap (RC-5's own DR runbook). Rotating any one of these four
  keys today requires a full, coordinated re-encryption migration of
  everything it encrypted, not a config change. A future `keyVersion`
  field per encrypted record is the documented path to fixing this,
  not yet built.
- Decryption fails loudly on a wrong key (never silently returns
  garbage) — verified directly as part of RC-5's own credential-
  recovery audit.
